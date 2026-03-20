#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { RulesMatcher } from './rules-matcher.js';
import { SessionTracker } from './session-tracker.js';
import { ContextAccumulator } from './context-accumulator.js';
import { AdaptiveEngine } from './adaptive-engine.js';

const require = createRequire(import.meta.url);
const { getSkillStateFilePath } = require('../shared/pipeline.js');

const MAX_SUGGESTIONS = 3;

// Minimum score to write state file (ASK or BLOCK)
const SCORE_THRESHOLD = 50;

// Feature flag: graduated confidence (BLOCK/ASK/PASS)
const GRADUATED_CONFIDENCE_ENABLED = process.env.GRADUATED_CONFIDENCE_ENABLED !== 'false';

// Default graduated thresholds
const DEFAULT_THRESHOLDS = { block: 80, ask: 50, pass: 0 };

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
        // Load adaptive weights (if available)
        let adaptiveWeights = null;
        let thresholds = DEFAULT_THRESHOLDS;
        try {
            const adaptiveEngine = new AdaptiveEngine();
            adaptiveWeights = adaptiveEngine.getAdaptiveWeights();
            if (adaptiveWeights?.thresholds) {
                thresholds = { ...DEFAULT_THRESHOLDS, ...adaptiveWeights.thresholds };
            }
        } catch {
            // fail-open: use defaults
        }

        // Match prompt (pass adaptive weights to matcher for dynamic scoring)
        const matcher = new RulesMatcher(rules, adaptiveWeights);
        let matches = matcher.matchPrompt(input.prompt);
        // Filter already-suggested skills (session tracking)
        if (input.session_id && matches.length > 0) {
            const home = process.env['HOME'] || process.env['USERPROFILE'] || '';
            const stateDir = path.join(home, '.claude', 'hooks', 'state');

            // Context accumulator (feature flag: CONTEXT_ACCUMULATOR_ENABLED)
            const accumulator = new ContextAccumulator(stateDir);
            const useAccumulator = accumulator.enabled;

            if (useAccumulator) {
                // Accumulator replaces SessionTracker for suggestion dedup + cleanup
                accumulator.cleanup();

                matches = matches.filter(m => {
                    if (m.rule.skipConditions?.sessionSkillUsed && accumulator.wasSkillSuggested(input.session_id, m.skillName)) {
                        return false;
                    }
                    return true;
                });

                for (const m of matches.slice(0, MAX_SUGGESTIONS)) {
                    accumulator.markSkillSuggested(input.session_id, m.skillName);
                }
            } else {
                // Legacy path: use SessionTracker
                const tracker = new SessionTracker(stateDir);
                tracker.cleanupOldSessions();

                matches = matches.filter(m => {
                    if (m.rule.skipConditions?.sessionSkillUsed && tracker.wasSuggested(input.session_id, m.skillName)) {
                        return false;
                    }
                    return true;
                });

                for (const m of matches.slice(0, MAX_SUGGESTIONS)) {
                    tracker.markSuggested(input.session_id, m.skillName);
                }
            }

            // Score accumulation (only when accumulator is enabled)
            let effectiveScore = 0;
            if (matches.length > 0) {
                const primary = matches[0];
                const totalScore = primary.score || primary.smartScore?.total || 0;

                if (useAccumulator) {
                    // Accumulate turn score with multi-turn decay
                    const turnScore = {
                        score: totalScore,
                        matchedKeywords: primary.matchedKeywords || [],
                        negativeSignal: primary.smartScore?.negative || 0,
                        prompt_prefix: input.prompt?.substring(0, 80) || '',
                    };
                    const ctx = accumulator.accumulateScore(input.session_id, turnScore);
                    effectiveScore = ctx ? Math.max(totalScore, ctx.cumulativeScore) : totalScore;
                } else {
                    effectiveScore = totalScore;
                }
            }

            // Graduated confidence: determine action level
            const blockThreshold = thresholds.block;
            const askThreshold = thresholds.ask;
            const isBlock = GRADUATED_CONFIDENCE_ENABLED
                ? effectiveScore >= blockThreshold
                : effectiveScore >= SCORE_THRESHOLD;
            const isAsk = GRADUATED_CONFIDENCE_ENABLED
                && effectiveScore >= askThreshold
                && effectiveScore < blockThreshold;
            const confidence = isBlock ? 'high' : isAsk ? 'ask' : 'low';

            // Output
            const output = formatOutput(matches);
            if (output) {
                // Write state file for PreToolUse guard when enforcement is 'block'
                // BLOCK: score >= blockThreshold — full blocking enforcement
                // ASK: askThreshold <= score < blockThreshold — suggestion only (guard passes through)
                if (matches.length > 0 && input.session_id) {
                    const primary = matches[0];

                    if (primary.rule.enforcement === 'block' && (isBlock || isAsk)) {
                        try {
                            // Legacy state file (backward compatibility)
                            const stateFile = getSkillStateFilePath(input.session_id);
                            if (stateFile) {
                                const legacyStateDir = path.dirname(stateFile);
                                fs.mkdirSync(legacyStateDir, { recursive: true });
                                fs.writeFileSync(stateFile, JSON.stringify({
                                    skill: primary.skillName,
                                    timestamp: Date.now(),
                                    confidence,
                                    score: effectiveScore,
                                    prompt: input.prompt?.substring(0, 100)
                                }));
                            }

                            // Accumulator skill state (parallel write)
                            if (useAccumulator) {
                                accumulator.updateSkillState(input.session_id, {
                                    skill: primary.skillName,
                                    score: effectiveScore,
                                    confidence,
                                    prompt: input.prompt?.substring(0, 100),
                                });
                            }
                        } catch {
                            // Fail-open: state file write failure should not block activation output
                        }
                    }
                }

                // For block enforcement with high confidence, output ONLY the JSON systemMessage
                if (matches.length > 0 && matches[0].rule.enforcement === 'block' && isBlock) {
                    const primary = matches[0];
                    const skillName = primary.skillName;
                    if (useAccumulator) accumulator.flush();
                    process.stdout.write(JSON.stringify({
                        systemMessage: `SKILL ACTIVATION: ${skillName} required \u2014 call Skill("${skillName}") first`
                    }) + '\n');
                    process.exit(0);
                    return;
                }

                // ASK mode or below-threshold: output text banner (non-blocking suggestion)
                if (useAccumulator) accumulator.flush();
                process.stdout.write(output);
            } else {
                // No output but accumulator may have pending writes
                if (useAccumulator) accumulator.flush();
            }
        } else {
            // No session_id or no matches — just output if any
            const output = formatOutput(matches);
            if (output) {
                process.stdout.write(output);
            }
        }
    }
    catch {
        // Fail-open: any error -> exit 0 with no output
    }
    process.exit(0);
}
main();
