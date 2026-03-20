/**
 * Intent Classifier — LLM-based fallback classifier for ambiguous prompts.
 *
 * Uses `claude -p` CLI subprocess to classify user intent when regex-based
 * scoring lands in the ambiguous zone (score 30-60). Provides disk caching
 * with SHA256 hashing and 1-hour TTL.
 *
 * Intents: 'code-modify', 'question', 'chat', 'ambiguous'
 *
 * Feature flag: LLM_CLASSIFIER_ENABLED (opt-in, default: disabled)
 * Fail-open: any error returns { intent: 'ambiguous', confidence: 0 }.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const FEATURE_FLAG = 'LLM_CLASSIFIER_ENABLED';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const AMBIGUOUS_RESULT = Object.freeze({ intent: 'ambiguous', confidence: 0 });

const CLASSIFICATION_PROMPT = `You are an intent classifier for a code assistant. Classify the user's message into one of:
- code-modify: User wants to create, modify, fix, refactor, or deploy code
- question: User is asking about code, concepts, or how something works
- chat: Greeting, acknowledgment, or casual conversation
- ambiguous: Cannot determine with confidence

User message: "{prompt}"

{context_section}

Respond with JSON only: {"intent": "...", "confidence": 0.0-1.0}`;

export class IntentClassifier {
  #cacheDir;
  #timeoutMs;
  #maxTokens;

  /**
   * @param {object} [options]
   * @param {string} [options.cacheDir] — directory for cached classification results
   * @param {number} [options.timeoutMs=2000] — max subprocess timeout in ms
   * @param {number} [options.maxTokens=50] — max output tokens for classification
   */
  constructor(options = {}) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    this.#cacheDir = options.cacheDir || path.join(home, '.claude', 'hooks', 'state', 'intent-cache');
    this.#timeoutMs = options.timeoutMs || 2000;
    this.#maxTokens = options.maxTokens || 50;
  }

  /**
   * Whether the classifier is enabled via feature flag.
   */
  get enabled() {
    return process.env[FEATURE_FLAG] === 'true';
  }

  /**
   * Classify the intent of a user prompt.
   *
   * @param {string} prompt — the user's message
   * @param {Array<{score: number, matchedKeywords: string[], prompt_prefix: string}>} [conversationContext]
   * @returns {Promise<{intent: string, confidence: number}>}
   */
  async classify(prompt, conversationContext) {
    try {
      if (!this.enabled) return { ...AMBIGUOUS_RESULT };
      if (!prompt || typeof prompt !== 'string') return { ...AMBIGUOUS_RESULT };

      // Check cache first
      const promptHash = this.#hashPrompt(prompt);
      const cached = this._getCached(promptHash);
      if (cached) return cached;

      // Build the classification prompt
      const contextSection = this.#buildContextSection(conversationContext);
      const fullPrompt = CLASSIFICATION_PROMPT
        .replace('{prompt}', prompt.replace(/'/g, "\\'").slice(0, 200))
        .replace('{context_section}', contextSection);

      // Call claude -p subprocess
      const result = this.#callClaude(fullPrompt);
      if (!result) return { ...AMBIGUOUS_RESULT };

      // Parse response
      const parsed = this.#parseResponse(result);

      // Cache the result
      this._setCache(promptHash, parsed);

      return parsed;
    } catch {
      return { ...AMBIGUOUS_RESULT };
    }
  }

  /**
   * Clear all cached classification results.
   */
  clearCache() {
    try {
      if (!fs.existsSync(this.#cacheDir)) return;
      const files = fs.readdirSync(this.#cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            fs.unlinkSync(path.join(this.#cacheDir, file));
          } catch { /* ignore */ }
        }
      }
    } catch {
      // fail-open
    }
  }

  // ─── Cache Methods ─────────────────────────────────────────────────

  /**
   * Check disk cache for a previously classified prompt.
   * @param {string} promptHash
   * @returns {{ intent: string, confidence: number }|null}
   */
  _getCached(promptHash) {
    try {
      const cachePath = path.join(this.#cacheDir, `${promptHash}.json`);
      if (!fs.existsSync(cachePath)) return null;

      const raw = fs.readFileSync(cachePath, 'utf-8');
      const data = JSON.parse(raw);

      // Check TTL
      if (data.timestamp && (Date.now() - data.timestamp) > CACHE_TTL_MS) {
        // Expired — remove and return null
        try { fs.unlinkSync(cachePath); } catch { /* ignore */ }
        return null;
      }

      return { intent: data.intent, confidence: data.confidence };
    } catch {
      return null;
    }
  }

  /**
   * Write a classification result to disk cache.
   * @param {string} promptHash
   * @param {{ intent: string, confidence: number }} result
   */
  _setCache(promptHash, result) {
    try {
      if (!fs.existsSync(this.#cacheDir)) {
        fs.mkdirSync(this.#cacheDir, { recursive: true });
      }

      const cachePath = path.join(this.#cacheDir, `${promptHash}.json`);
      const data = {
        intent: result.intent,
        confidence: result.confidence,
        timestamp: Date.now(),
      };

      const tmpPath = cachePath + `.tmp.${process.pid}`;
      fs.writeFileSync(tmpPath, JSON.stringify(data));
      fs.renameSync(tmpPath, cachePath);
    } catch {
      // fail-open
    }
  }

  // ─── Private Helpers ───────────────────────────────────────────────

  /**
   * Hash a prompt string using SHA256.
   * @param {string} prompt
   * @returns {string}
   */
  #hashPrompt(prompt) {
    return crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16);
  }

  /**
   * Build the context section for the classification prompt.
   * @param {Array} conversationContext
   * @returns {string}
   */
  #buildContextSection(conversationContext) {
    if (!Array.isArray(conversationContext) || conversationContext.length === 0) {
      return '';
    }

    const summaries = conversationContext.slice(-3).map((turn, i) => {
      const keywords = (turn.matchedKeywords || []).join(', ');
      return `Turn ${i + 1}: score=${turn.score || 0}, keywords=[${keywords}]`;
    });

    return `Recent context (last ${summaries.length} turns):\n${summaries.join('\n')}`;
  }

  /**
   * Call claude -p CLI subprocess for classification.
   * @param {string} prompt
   * @returns {string|null}
   */
  #callClaude(prompt) {
    try {
      // Escape single quotes for shell
      const escaped = prompt.replace(/'/g, "'\\''");

      const result = execSync(
        `echo '${escaped}' | claude -p --max-tokens ${this.#maxTokens}`,
        {
          timeout: this.#timeoutMs,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );

      return result ? result.trim() : null;
    } catch {
      // CLI not available or timeout — fail-open
      return null;
    }
  }

  /**
   * Parse the LLM response into a classification result.
   * @param {string} response
   * @returns {{ intent: string, confidence: number }}
   */
  #parseResponse(response) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[^}]+\}/);
      if (!jsonMatch) return { ...AMBIGUOUS_RESULT };

      const parsed = JSON.parse(jsonMatch[0]);
      const validIntents = ['code-modify', 'question', 'chat', 'ambiguous'];
      const intent = validIntents.includes(parsed.intent) ? parsed.intent : 'ambiguous';
      const confidence = typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0;

      return { intent, confidence };
    } catch {
      return { ...AMBIGUOUS_RESULT };
    }
  }
}
