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
    en: ['/clear', '/compact', 'hello', 'hi', 'thanks', 'thank you', 'ok', 'got it', 'sure', 'bye'],
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
      if (lower.includes(kw.toLowerCase())) hits += 1;
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
 * Classify prompt using Anthropic Haiku via child process.
 * Only called when GATEKEEPER_LLM_ENABLED=true.
 * @param {string} prompt
 * @param {string} skillCatalog
 * @returns {Promise<{ category: string, skill: string|null, confidence: number, reason: string }|null>}
 */
async function classifyWithLLM(prompt, skillCatalog) {
  try {
    const promptsPath = path.join(__dirname, '..', 'prompts', 'gatekeeper.md');
    let systemPrompt = fs.readFileSync(promptsPath, 'utf8');
    systemPrompt = systemPrompt.replace('{SKILL_CATALOG}', skillCatalog);

    const { execFile } = require('child_process');

    const script = `
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic();
      (async () => {
        try {
          const msg = await client.messages.create({
            model: 'claude-haiku-4-5',
            max_tokens: 256,
            system: ${JSON.stringify(systemPrompt)},
            messages: [{ role: 'user', content: ${JSON.stringify(prompt)} }],
          });
          const text = msg.content[0].text;
          const match = text.match(/\\{[^}]+\\}/s);
          if (match) {
            process.stdout.write(match[0]);
          }
        } catch (e) {
          process.exit(1);
        }
      })();
    `;

    return await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        try { child.kill(); } catch {}
        resolve(null);
      }, 3000);

      const child = execFile(process.execPath, ['-e', script], { timeout: 3500 }, (err, stdout) => {
        clearTimeout(timeout);
        if (err || !stdout) return resolve(null);
        try {
          const parsed = JSON.parse(stdout.trim());
          if (parsed.category) {
            resolve({
              category: parsed.category,
              skill: parsed.skill || null,
              confidence: parsed.confidence || 0.8,
              reason: parsed.reason || 'llm classification',
            });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });
  } catch {
    return null;
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
    const llmResult = await classifyWithLLM(prompt, catalog);
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
