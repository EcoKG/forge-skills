/**
 * Adaptive Engine — Feedback collection and adaptive weight management.
 *
 * Records session outcomes (TP/FP/FN/TN) for offline calibration.
 * Provides adaptive weights loading for rules-matcher weight overrides.
 *
 * Features:
 *   - Append-only feedback log (JSONL format, max 10000 lines with rotation)
 *   - Adaptive weights loading from adaptive-weights.json
 *   - Verdict classification (TP/FP/FN/TN)
 *   - Atomic file writes via .tmp.{pid} + rename
 *   - Feature flag: FEEDBACK_COLLECTION_ENABLED
 *
 * Fail-open: any error returns null/defaults, never throws.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const MAX_FEEDBACK_LINES = 10000;
const ROTATE_KEEP_LINES = 5000;
const MAX_PROMPT_LENGTH = 200;
const FEATURE_FLAG = 'FEEDBACK_COLLECTION_ENABLED';

export class AdaptiveEngine {
  #stateDir;
  #feedbackLogPath;
  #weightsPath;

  /**
   * @param {string} [stateDir] — directory for feedback-log.jsonl and adaptive-weights.json
   */
  constructor(stateDir) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    this.#stateDir = stateDir || path.join(home, '.claude', 'hooks', 'state');
    this.#feedbackLogPath = path.join(this.#stateDir, 'feedback-log.jsonl');
    this.#weightsPath = path.join(this.#stateDir, 'adaptive-weights.json');
  }

  /**
   * Whether feedback collection is enabled via feature flag.
   */
  get enabled() {
    return process.env[FEATURE_FLAG] !== 'false';
  }

  /**
   * Record a session outcome for the feedback loop.
   *
   * @param {string} sessionId
   * @param {object} outcome — { prompt, score, triggered, userInvokedSkill, skillName, timestamp }
   *   - prompt: user prompt text (truncated to 200 chars)
   *   - score: numeric activation score
   *   - triggered: boolean — did the system trigger/suggest skill?
   *   - userInvokedSkill: boolean — did the user actually invoke the skill?
   *   - skillName: which skill was involved
   *   - timestamp: epoch ms (defaults to Date.now())
   */
  recordOutcome(sessionId, outcome) {
    if (!this.enabled) return;
    if (!sessionId || !outcome) return;

    try {
      // Ensure directory exists
      if (!fs.existsSync(this.#stateDir)) {
        fs.mkdirSync(this.#stateDir, { recursive: true });
      }

      const entry = {
        sessionId,
        prompt: (outcome.prompt || '').slice(0, MAX_PROMPT_LENGTH),
        score: outcome.score || 0,
        triggered: Boolean(outcome.triggered),
        userInvokedSkill: Boolean(outcome.userInvokedSkill),
        skillName: outcome.skillName || 'forge',
        verdict: AdaptiveEngine.classifyVerdict(outcome),
        timestamp: outcome.timestamp || Date.now(),
      };

      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.#feedbackLogPath, line);

      // Rotate if exceeds max lines
      this.#rotateFeedbackLog();
    } catch {
      // fail-open: silently ignore errors
    }
  }

  /**
   * Convenience wrapper: record a True Positive outcome.
   * System triggered and user confirmed by invoking the skill.
   *
   * @param {string} sessionId
   * @param {string} prompt
   * @param {number} score
   * @param {string} [skillName='forge']
   */
  recordTP(sessionId, prompt, score, skillName = 'forge') {
    this.recordOutcome(sessionId, {
      prompt,
      score,
      triggered: true,
      userInvokedSkill: true,
      skillName,
    });
  }

  /**
   * Convenience wrapper: record a False Positive outcome.
   * System triggered but user did NOT invoke the skill (e.g., TTL expired).
   *
   * @param {string} sessionId
   * @param {string} prompt
   * @param {number} score
   * @param {string} [skillName='forge']
   */
  recordFP(sessionId, prompt, score, skillName = 'forge') {
    this.recordOutcome(sessionId, {
      prompt,
      score,
      triggered: true,
      userInvokedSkill: false,
      skillName,
    });
  }

  /**
   * Convenience wrapper: record a False Negative outcome.
   * System did NOT trigger but user manually invoked the skill.
   *
   * @param {string} sessionId
   * @param {string} prompt
   * @param {number} score
   * @param {string} [skillName='forge']
   */
  recordFN(sessionId, prompt, score, skillName = 'forge') {
    this.recordOutcome(sessionId, {
      prompt,
      score,
      triggered: false,
      userInvokedSkill: true,
      skillName,
    });
  }

  /**
   * Load adaptive weights from adaptive-weights.json.
   * Returns the parsed weights object, or null if the file is missing or invalid.
   *
   * @returns {object|null} — { version, weights, thresholds, ... } or null
   */
  getAdaptiveWeights() {
    try {
      if (!fs.existsSync(this.#weightsPath)) return null;
      const raw = fs.readFileSync(this.#weightsPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      // fail-open: return null on any error
      return null;
    }
  }

  /**
   * Classify an outcome into TP, FP, FN, or TN.
   *
   * - TP (True Positive): system triggered AND user invoked skill
   * - FP (False Positive): system triggered BUT user did NOT invoke skill
   * - FN (False Negative): system did NOT trigger BUT user invoked skill
   * - TN (True Negative): system did NOT trigger AND user did NOT invoke skill
   *
   * @param {object} outcome — { triggered, userInvokedSkill }
   * @returns {'TP'|'FP'|'FN'|'TN'}
   */
  static classifyVerdict(outcome) {
    const triggered = Boolean(outcome?.triggered);
    const invoked = Boolean(outcome?.userInvokedSkill);

    if (triggered && invoked) return 'TP';
    if (triggered && !invoked) return 'FP';
    if (!triggered && invoked) return 'FN';
    return 'TN';
  }

  // ─── Private Helpers ────────────────────────────────────────────────

  /**
   * Rotate the feedback log if it exceeds MAX_FEEDBACK_LINES.
   * Keeps the most recent ROTATE_KEEP_LINES entries.
   */
  #rotateFeedbackLog() {
    try {
      if (!fs.existsSync(this.#feedbackLogPath)) return;

      const content = fs.readFileSync(this.#feedbackLogPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim().length > 0);

      if (lines.length <= MAX_FEEDBACK_LINES) return;

      // Keep only the most recent entries
      const kept = lines.slice(-ROTATE_KEEP_LINES);
      const tmpPath = this.#feedbackLogPath + `.tmp.${process.pid}`;

      fs.writeFileSync(tmpPath, kept.join('\n') + '\n');
      fs.renameSync(tmpPath, this.#feedbackLogPath);
    } catch {
      // fail-open: if rotation fails, the log just keeps growing
    }
  }
}
