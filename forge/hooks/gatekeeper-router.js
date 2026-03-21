#!/usr/bin/env node
/**
 * Gatekeeper Router — UserPromptSubmit Hook (v1.0)
 *
 * On EVERY user message:
 * 1. Classify the prompt into a routing category
 * 2. Write classification state to ~/.claude/hooks/state/gatekeeper-{session_id}.json
 * 3. Forge Orchestrator reads this state to decide whether to inject routing context
 *
 * stdin: JSON { session_id, prompt, cwd }
 * stdout: nothing (orchestrator reads state file; router does not inject directly)
 */

// Rollback guard — disable gatekeeper entirely when flag is set
if (process.env.GATEKEEPER_ENABLED === 'false') process.exit(0);

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'hooks', 'state');
const GATEKEEPER_LLM_ENABLED = process.env.GATEKEEPER_LLM_ENABLED === 'true';
const CONFIDENCE_THRESHOLD = 0.55; // below this → category: discuss (fail-safe)

// ---------------------------------------------------------------------------
// Routing table — inline replacement for skill-rules.json
// ---------------------------------------------------------------------------

const ROUTING_TABLE = {
  'code-modify': {
    skill: 'forge-dev',
    en: [
      'implement', 'build', 'add', 'create', 'make', 'write', 'fix', 'bug', 'error', 'crash', 'broken',
      'refactor', 'clean up', 'cleanup', 'restructure', 'audit', 'analyze', 'design',
      'migrate', 'deploy', 'docker', 'ci/cd', 'pipeline', 'infrastructure', 'infra', 'schema',
      'architecture', 'adr', 'security', 'owasp', 'vulnerability', 'remove', 'delete', 'update',
      'change', 'modify', 'patch', 'rewrite', 'optimize',
    ],
    ko: [
      '구현', '만들어', '만들기', '추가', '작성', '생성', '수정', '고쳐', '고치', '버그', '에러',
      '크래시', '리팩토링', '정리', '감사', '분석', '설계', '배포', '아키텍처', '스키마',
      '삭제', '변경', '최적화', '개선',
    ],
  },
  'discuss': {
    skill: null,
    en: [
      'what do you think', 'should we', 'opinion', 'approach', 'tradeoff', 'brainstorm',
      'discuss', 'thoughts on', 'pros and cons', 'which is better',
    ],
    ko: ['어떻게 생각', '의견', '토론', '논의', '고민', '브레인스토밍', '에 대해', '하자', '할까', '방향', '방법'],
  },
  'question': {
    skill: null,
    en: [
      'what is', 'what does', 'how does', 'how do', 'explain', 'describe', 'show me',
      'tell me', 'walk me through', 'what are', 'why does', 'why is', 'what happened',
    ],
    ko: ['뭐야', '뭐하는', '어떻게 하는', '설명', '뭐가', '왜', '어떤'],
  },
  'command': {
    skill: null,
    en: [
      'git log', 'git status', 'git diff', 'git show', 'ls ', 'cat ', 'find ', 'grep ',
      'npm install', 'yarn install', 'run ', 'execute', 'show output',
    ],
    ko: ['실행해', '보여줘', '출력해'],
  },
  'meta': {
    skill: null,
    en: ['/clear', '/compact', 'hello', 'thanks', 'thank you', 'got it', 'bye'],
    ko: ['안녕', '감사', '고마워', '알겠', 'ㅇㅋ'],
  },
};

// ---------------------------------------------------------------------------
// classifyLocal(prompt)
// ---------------------------------------------------------------------------

/**
 * Classify prompt using the local keyword routing table.
 * @param {string} prompt
 * @returns {{ category: string, skill: string|null, confidence: number, reason: string }}
 */
function classifyLocal(prompt) {
  const lower = prompt.toLowerCase();

  let bestCategory = 'discuss';
  let bestWeightedHits = 0;
  let bestSkill = null;
  let totalWeightedHitsAll = 0;

  // First pass: count raw hits per category
  const hitsByCategory = {};
  for (const [category, entry] of Object.entries(ROUTING_TABLE)) {
    const keywords = [...(entry.en || []), ...(entry.ko || [])];
    if (keywords.length === 0) continue;
    let hits = 0;
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      // For very short ASCII-only keywords (≤2 chars like "hi", "ok"), use word boundary
      // to avoid substring false positives. Korean keywords are always substring-matched.
      const isAsciiOnly = /^[a-z0-9 /]+$/i.test(kwLower);
      if (isAsciiOnly && kwLower.length <= 2) {
        const re = new RegExp(`(?:^|\\W)${kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|\\W)`, 'i');
        if (re.test(lower)) hits += 1;
      } else {
        if (lower.includes(kwLower)) hits += 1;
      }
    }
    hitsByCategory[category] = hits;
  }

  // Second pass: apply weights with cross-category suppression
  // If discuss/question keywords are present alongside code-modify,
  // the user is likely talking ABOUT code, not requesting changes
  const discussPresent = (hitsByCategory['discuss'] || 0) + (hitsByCategory['question'] || 0);

  for (const [category, entry] of Object.entries(ROUTING_TABLE)) {
    let hits = hitsByCategory[category] || 0;
    if (hits === 0) continue;

    let weightedHits = hits;
    if (category === 'code-modify') {
      // Boost code-modify by 1.5x, but suppress if discuss/question keywords coexist
      weightedHits = discussPresent > 0 ? hits * 0.8 : hits * 1.5;
    }
    totalWeightedHitsAll += weightedHits;

    if (weightedHits > bestWeightedHits) {
      bestWeightedHits = weightedHits;
      bestCategory = category;
      bestSkill = entry.skill;
    }
  }

  // Normalize confidence: winner's share of total weighted hits across all categories
  // If nothing matched at all (totalWeightedHitsAll === 0), confidence is 0
  const confidence = totalWeightedHitsAll > 0
    ? bestWeightedHits / totalWeightedHitsAll
    : 0;

  if (confidence < CONFIDENCE_THRESHOLD) {
    return {
      category: 'discuss',
      skill: null,
      confidence,
      reason: 'low confidence — defaulting to discuss',
    };
  }

  return {
    category: bestCategory,
    skill: bestSkill,
    confidence,
    reason: `matched category '${bestCategory}' with score ${confidence.toFixed(3)}`,
  };
}

// ---------------------------------------------------------------------------
// readSkillCatalog(sessionId)
// ---------------------------------------------------------------------------

/**
 * Read the skill catalog state file written by gatekeeper-init.js.
 * @param {string} sessionId
 * @returns {string} catalog string, or empty string if file missing
 */
function readSkillCatalog(sessionId) {
  try {
    const catalogFile = path.join(STATE_DIR, `skill-catalog-${sessionId}.json`);
    const raw = fs.readFileSync(catalogFile, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.catalog || '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// classifyWithLLM(prompt, skillCatalog)
// ---------------------------------------------------------------------------

/**
 * Classify prompt using claude -p (pipe mode) with haiku model.
 * Works with Claude subscription — no API key needed.
 * Only called when GATEKEEPER_LLM_ENABLED=true.
 * @param {string} prompt
 * @param {string} skillCatalog
 * @returns {{ category: string, skill: string|null, confidence: number, reason: string }|null}
 */
function classifyWithLLM(prompt, skillCatalog) {
  try {
    const gatekeeperPromptPath = path.join(__dirname, '..', 'prompts', 'gatekeeper.md');
    let systemPrompt = '';
    try {
      systemPrompt = fs.readFileSync(gatekeeperPromptPath, 'utf8');
      if (skillCatalog) {
        systemPrompt = systemPrompt.replace('{SKILL_CATALOG}', skillCatalog);
      }
    } catch {
      return null; // No prompt file → fall back to local
    }

    // Use claude -p (pipe mode) with haiku model
    // Works with subscription — no API key needed
    // Write both system prompt and user prompt to temp files to avoid shell quoting issues
    // Note: execSync `input` option is not compatible with claude -p; use cat pipe instead
    const { execSync } = require('child_process');
    const os = require('os');
    const crypto = require('crypto');
    const tmpId = crypto.randomBytes(6).toString('hex');
    const systemPromptFile = path.join(os.tmpdir(), `gatekeeper-sys-${tmpId}.txt`);
    const userPromptFile = path.join(os.tmpdir(), `gatekeeper-prompt-${tmpId}.txt`);

    try {
      fs.writeFileSync(systemPromptFile, systemPrompt, 'utf8');
      fs.writeFileSync(userPromptFile, prompt, 'utf8');

      const result = execSync(
        `cat '${userPromptFile}' | claude -p --model haiku --system-prompt-file '${systemPromptFile}' 2>/dev/null`,
        {
          timeout: 5000,
          encoding: 'utf8',
          env: process.env,
        }
      );

      // Parse JSON from response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.category) {
        return {
          category: parsed.category,
          skill: parsed.skill || null,
          confidence: parsed.confidence || 0.8,
          reason: parsed.reason || 'LLM classification',
        };
      }
      return null;
    } finally {
      try { fs.unlinkSync(systemPromptFile); } catch {}
      try { fs.unlinkSync(userPromptFile); } catch {}
    }
  } catch {
    return null; // Timeout, parse error, or claude not available → fall back to local
  }
}

// ---------------------------------------------------------------------------
// main()
// ---------------------------------------------------------------------------

async function main() {
  // Read stdin JSON
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    raw += chunk;
  }

  const input = JSON.parse(raw || '{}');
  const { session_id, prompt } = input;

  // If prompt is empty/missing: nothing to classify
  if (!prompt || !prompt.trim()) {
    process.exit(0);
  }

  // Ensure STATE_DIR exists
  try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}

  // Local classification
  let result = classifyLocal(prompt);

  // LLM fallback when enabled and local confidence is low
  if (GATEKEEPER_LLM_ENABLED && result.confidence < CONFIDENCE_THRESHOLD) {
    const catalog = readSkillCatalog(session_id || 'default');
    const llmResult = classifyWithLLM(prompt, catalog);
    if (llmResult) {
      result = llmResult;
    }
  }

  // Write state file
  const stateFile = path.join(STATE_DIR, `gatekeeper-${session_id || 'default'}.json`);
  fs.writeFileSync(stateFile, JSON.stringify({
    category: result.category,
    skill: result.skill,
    confidence: result.confidence,
    reason: result.reason,
    session_id: session_id,
    ts: Date.now(),
  }));

  // No stdout — orchestrator reads state file directly
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Entry point — fail-open on any unexpected error
// ---------------------------------------------------------------------------

main().catch((err) => {
  process.stderr.write(`[gatekeeper-router] error: ${err && err.message || String(err)}\n`);
  process.exit(0); // fail-open: never block Claude on classification error
});
