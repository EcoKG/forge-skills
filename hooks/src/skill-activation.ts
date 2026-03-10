#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { RulesMatcher } from './rules-matcher.js';
import { SessionTracker } from './session-tracker.js';
import type { HookInput, MatchResult, SkillRules } from './types.js';

const MAX_SUGGESTIONS = 3;

export function parseInput(raw: string): HookInput | null {
  try {
    if (!raw || raw.trim().length === 0) return null;
    return JSON.parse(raw.trim()) as HookInput;
  } catch {
    return null;
  }
}

export function formatOutput(matches: MatchResult[]): string {
  if (matches.length === 0) return '';

  const top = matches.slice(0, MAX_SUGGESTIONS);
  const lines: string[] = [
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '  SKILL ACTIVATION CHECK',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    'RECOMMENDED SKILLS:',
  ];

  for (const m of top) {
    const tags: string[] = [];
    if (m.matchedKeywords.length > 0) tags.push(`keywords: ${m.matchedKeywords.join(', ')}`);
    if (m.matchedIntents.length > 0) tags.push(`intents: ${m.matchedIntents.length}`);
    lines.push(`  → ${m.skillName} [${m.rule.priority}] (${tags.join('; ')})`);
  }

  lines.push('');
  lines.push('ACTION: Consider using the Skill tool for the above skill(s) if relevant.');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  return lines.join('\n');
}

function loadRules(rulesPath: string): SkillRules | null {
  try {
    const raw = fs.readFileSync(rulesPath, 'utf-8');
    return JSON.parse(raw) as SkillRules;
  } catch {
    return null;
  }
}

function findRulesFile(cwd?: string): string | null {
  // Search order: project .claude/skills/skill-rules.json → global ~/.claude/skills/skill-rules.json
  const candidates: string[] = [];

  if (cwd) {
    candidates.push(path.join(cwd, '.claude', 'skills', 'skill-rules.json'));
  }

  const home = process.env['HOME'] || process.env['USERPROFILE'] || '';
  if (home) {
    candidates.push(path.join(home, '.claude', 'skills', 'skill-rules.json'));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

async function main(): Promise<void> {
  try {
    // Read stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
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
  } catch {
    // Fail-open: any error → exit 0 with no output
  }

  process.exit(0);
}

main();
