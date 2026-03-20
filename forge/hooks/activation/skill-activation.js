#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { RulesMatcher } from './rules-matcher.js';
import { SessionTracker } from './session-tracker.js';

const require = createRequire(import.meta.url);
const { getSkillStateFilePath } = require('../shared/pipeline.js');

const MAX_SUGGESTIONS = 3;

// Minimum score to write state file and enforce blocking
const SCORE_THRESHOLD = 50;

// Meta-workflow exclusion patterns — these should never trigger forge activation
const META_WORKFLOW_PATTERNS = [
  /\bskill-creator\b/i,
  /\/skill-creator\b/i,
];

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
    lines.push('\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501');
    lines.push('  SKILL ACTIVATION');
    lines.push('\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501');
    lines.push('');
    for (const m of top) {
        const tags = [];
        if (m.matchedKeywords.length > 0)
            tags.push(`keywords: ${m.matchedKeywords.join(', ')}`);
        if (m.matchedIntents.length > 0)
            tags.push(`intents: ${m.matchedIntents.length}`);
        if (m.smartScore?.total > 0)
            tags.push(`smart: ${m.smartScore.total}pts`);
        lines.push(`  \u2192 ${m.skillName} [${m.rule.priority}] (${tags.join('; ')})`);
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
        lines.push('Do not analyze, implement, or modify code directly \u2014 the skill handles the full workflow.');
    }
    else {
        lines.push(`SUGGESTED: Use the "${primary.skillName}" skill for better results.`);
        lines.push(`Invoke with the Skill tool (skill: "${primary.skillName}") before proceeding.`);
    }
    lines.push('\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501');
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
    // Search order: project .claude/skills/skill-rules.json -> global ~/.claude/skills/skill-rules.json
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

function isMetaWorkflow(prompt) {
    if (!prompt) return false;
    for (const pattern of META_WORKFLOW_PATTERNS) {
        if (pattern.test(prompt)) return true;
    }
    return false;
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

        // Meta-workflow exclusion: skill-creator should not trigger forge
        if (isMetaWorkflow(input.prompt)) {
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
            // Write state file for PreToolUse guard when enforcement is 'block'
            // Only write when score meets threshold (meaningful match)
            if (matches.length > 0 && input.session_id) {
                const primary = matches[0];
                const totalScore = primary.score || primary.smartScore?.total || 0;

                if (primary.rule.enforcement === 'block' && totalScore >= SCORE_THRESHOLD) {
                    try {
                        const stateFile = getSkillStateFilePath(input.session_id);
                        if (stateFile) {
                            const stateDir = path.dirname(stateFile);
                            fs.mkdirSync(stateDir, { recursive: true });
                            // Always overwrite — refresh timestamp on every new activation
                            fs.writeFileSync(stateFile, JSON.stringify({
                                skill: primary.skillName,
                                timestamp: Date.now(),
                                confidence: totalScore >= 80 ? 'high' : totalScore >= 50 ? 'medium' : 'low',
                                score: totalScore,
                                prompt: input.prompt?.substring(0, 100)
                            }));
                        }
                    } catch {
                        // Fail-open: state file write failure should not block activation output
                    }
                }
            }

            // For block enforcement, output ONLY the JSON systemMessage (no redundant text)
            if (matches.length > 0 && matches[0].rule.enforcement === 'block') {
                const primary = matches[0];
                const totalScore = primary.score || primary.smartScore?.total || 0;
                if (totalScore >= SCORE_THRESHOLD) {
                    const skillName = primary.skillName;
                    process.stdout.write(JSON.stringify({
                        systemMessage: `SKILL ACTIVATION: ${skillName} required \u2014 call Skill("${skillName}") first`
                    }) + '\n');
                    // Skip text output — systemMessage is sufficient for block enforcement
                    process.exit(0);
                    return;
                }
            }

            // Non-block or below-threshold: output text banner
            process.stdout.write(output);
        }
    }
    catch {
        // Fail-open: any error -> exit 0 with no output
    }
    process.exit(0);
}
main();
