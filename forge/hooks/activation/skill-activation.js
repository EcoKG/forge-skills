#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { RulesMatcher } from './rules-matcher.js';
import { SessionTracker } from './session-tracker.js';
const MAX_SUGGESTIONS = 3;
export function parseInput(raw) {
    try {
        if (!raw || raw.trim().length === 0)
            return null;
        return JSON.parse(raw.trim());
    }
    catch {
        return null;
    }
}
export function formatOutput(matches) {
    if (matches.length === 0)
        return '';
    const top = matches.slice(0, MAX_SUGGESTIONS);
    const primary = top[0];
    const lines = [];
    // Determine action strength from enforcement + priority
    const isStrong = primary.rule.priority === 'critical' || primary.rule.priority === 'high';
    const isBlock = primary.rule.enforcement === 'block';
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('  SKILL ACTIVATION');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    for (const m of top) {
        const tags = [];
        if (m.matchedKeywords.length > 0)
            tags.push(`keywords: ${m.matchedKeywords.join(', ')}`);
        if (m.matchedIntents.length > 0)
            tags.push(`intents: ${m.matchedIntents.length}`);
        if (m.smartScore?.total > 0)
            tags.push(`smart: ${m.smartScore.total}pts`);
        lines.push(`  → ${m.skillName} [${m.rule.priority}] (${tags.join('; ')})`);
        if (m.rule.description) {
            lines.push(`    ${m.rule.description}`);
        }
    }
    lines.push('');
    if (isBlock) {
        lines.push(`BLOCKED: You must use the "${primary.skillName}" skill for this task.`);
        if (primary.rule.blockMessage) {
            lines.push(primary.rule.blockMessage);
        }
        lines.push(`Invoke it now: use the Skill tool with skill="${primary.skillName}".`);
        lines.push('Do not proceed without invoking this skill.');
    }
    else if (isStrong) {
        lines.push(`IMPORTANT: This task requires the "${primary.skillName}" skill.`);
        lines.push(`You MUST invoke it using the Skill tool (skill: "${primary.skillName}") BEFORE doing any other work.`);
        lines.push('Do not analyze, implement, or modify code directly — the skill handles the full workflow.');
    }
    else {
        lines.push(`SUGGESTED: Use the "${primary.skillName}" skill for better results.`);
        lines.push(`Invoke with the Skill tool (skill: "${primary.skillName}") before proceeding.`);
    }
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    return lines.join('\n');
}
function loadRules(rulesPath) {
    try {
        const raw = fs.readFileSync(rulesPath, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
function findRulesFile(cwd) {
    // Search order: project .claude/skills/skill-rules.json → global ~/.claude/skills/skill-rules.json
    const candidates = [];
    if (cwd) {
        candidates.push(path.join(cwd, '.claude', 'skills', 'skill-rules.json'));
    }
    const home = process.env['HOME'] || process.env['USERPROFILE'] || '';
    if (home) {
        candidates.push(path.join(home, '.claude', 'skills', 'skill-rules.json'));
    }
    for (const candidate of candidates) {
        if (fs.existsSync(candidate))
            return candidate;
    }
    return null;
}
async function main() {
    try {
        // Read stdin
        const chunks = [];
        for await (const chunk of process.stdin) {
            chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks).toString('utf-8');
        const input = parseInput(raw);
        if (!input || !input.prompt) {
            process.exit(0);
            return;
        }
        // Find and load rules
        const rulesPath = findRulesFile(input.cwd);
        if (!rulesPath) {
            process.exit(0);
            return;
        }
        const rules = loadRules(rulesPath);
        if (!rules) {
            process.exit(0);
            return;
        }
        // Match prompt
        const matcher = new RulesMatcher(rules);
        let matches = matcher.matchPrompt(input.prompt);
        // Filter already-suggested skills (session tracking)
        if (input.session_id && matches.length > 0) {
            const home = process.env['HOME'] || process.env['USERPROFILE'] || '';
            const stateDir = path.join(home, '.claude', 'hooks', 'state');
            const tracker = new SessionTracker(stateDir);
            // Clean up old sessions (once per run, cheap operation)
            tracker.cleanupOldSessions();
            // Filter out already-suggested skills
            matches = matches.filter(m => {
                if (m.rule.skipConditions?.sessionSkillUsed && tracker.wasSuggested(input.session_id, m.skillName)) {
                    return false;
                }
                return true;
            });
            // Mark newly suggested skills
            for (const m of matches.slice(0, MAX_SUGGESTIONS)) {
                tracker.markSuggested(input.session_id, m.skillName);
            }
        }
        // Output
        const output = formatOutput(matches);
        if (output) {
            process.stdout.write(output);
        }
    }
    catch {
        // Fail-open: any error → exit 0 with no output
    }
    process.exit(0);
}
main();
