/**
 * User Profile — Cross-session learning and personalized threshold management.
 *
 * Tracks user interaction patterns across sessions to provide:
 *   - Personalized threshold adjustments based on TP/FP/FN history
 *   - Auto-negative pattern detection from frequent FP prompts
 *   - Language preference tracking
 *
 * Data stored in: profileDir/user-profile.json
 *
 * Feature flag: USER_PROFILE_ENABLED (opt-in, default: disabled)
 * Fail-open: any error returns defaults, never throws.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

const FEATURE_FLAG = 'USER_PROFILE_ENABLED';
const FP_PATTERN_THRESHOLD = 4; // FP pattern must appear N+ times to auto-register
const MAX_THRESHOLD_ADJUSTMENT = 10;
const MIN_THRESHOLD_ADJUSTMENT = -10;

/**
 * Create a default profile object.
 * @param {string} userId
 * @returns {object}
 */
function createDefaultProfile(userId) {
  return {
    version: 1,
    userId: userId || 'default',
    created: Date.now(),
    updated: Date.now(),
    interactions: {
      total: 0,
      tp: 0,
      fp: 0,
      fn: 0,
    },
    languages: {},
    fpPatterns: [],
    thresholdBias: 0,
  };
}

/**
 * Detect language of a text based on character analysis.
 * @param {string} text
 * @returns {'ko'|'en'|'mixed'|null}
 */
function detectLanguage(text) {
  if (!text) return null;
  const koreanChars = (text.match(/[\uAC00-\uD7AF\u3130-\u318F]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  if (koreanChars > 0 && latinChars > 0) return 'mixed';
  if (koreanChars > 0) return 'ko';
  if (latinChars > 0) return 'en';
  return null;
}

/**
 * Normalize a prompt to a pattern for FP tracking.
 * Strips numbers/punctuation and lowercases.
 * @param {string} prompt
 * @returns {string}
 */
function normalizePrompt(prompt) {
  if (!prompt) return '';
  return prompt
    .toLowerCase()
    .replace(/[0-9]+/g, '#')
    .replace(/[^\w\s가-힣#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

export class UserProfile {
  #profileDir;
  #profilePath;

  /**
   * @param {string} [profileDir] — directory for profile data
   */
  constructor(profileDir) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    this.#profileDir = profileDir || path.join(home, '.claude', 'hooks', 'state', 'profiles');
    this.#profilePath = path.join(this.#profileDir, 'user-profile.json');
  }

  /**
   * Whether the profile engine is enabled via feature flag.
   */
  get enabled() {
    return process.env[FEATURE_FLAG] === 'true';
  }

  /**
   * Load or create user profile.
   * @param {string} [userId='default']
   * @returns {object} — profile object or defaults
   */
  getProfile(userId = 'default') {
    try {
      if (!this.enabled) return createDefaultProfile(userId);

      if (fs.existsSync(this.#profilePath)) {
        const raw = fs.readFileSync(this.#profilePath, 'utf-8');
        const profile = JSON.parse(raw);
        if (profile && profile.version === 1) return profile;
      }

      return createDefaultProfile(userId);
    } catch {
      return createDefaultProfile(userId);
    }
  }

  /**
   * Record an interaction for learning.
   *
   * @param {string} userId
   * @param {object} data — { prompt, score, triggered, verdict, language }
   *   - verdict: 'TP' | 'FP' | 'FN' | 'TN'
   */
  recordInteraction(userId, data) {
    if (!this.enabled) return;
    if (!data) return;

    try {
      const profile = this.getProfile(userId);

      // Update interaction counts
      profile.interactions.total += 1;
      const verdict = (data.verdict || '').toUpperCase();
      if (verdict === 'TP') profile.interactions.tp += 1;
      else if (verdict === 'FP') profile.interactions.fp += 1;
      else if (verdict === 'FN') profile.interactions.fn += 1;

      // Track language
      const lang = data.language || detectLanguage(data.prompt);
      if (lang) {
        profile.languages[lang] = (profile.languages[lang] || 0) + 1;
      }

      // Track FP patterns for auto-negative detection
      if (verdict === 'FP' && data.prompt) {
        const pattern = normalizePrompt(data.prompt);
        if (pattern.length >= 3) {
          const existing = profile.fpPatterns.find(p => p.pattern === pattern);
          if (existing) {
            existing.count += 1;
          } else {
            profile.fpPatterns.push({ pattern, count: 1 });
          }
        }
      }

      // Recalculate threshold bias
      profile.thresholdBias = this.#calculateBias(profile);
      profile.updated = Date.now();

      // Persist
      this.#saveProfile(profile);
    } catch {
      // fail-open
    }
  }

  /**
   * Get personalized threshold adjustment.
   * Positive = raise threshold (reduce triggers), negative = lower threshold.
   *
   * @param {string} [userId='default']
   * @returns {number} — adjustment between -10 and +10
   */
  getThresholdAdjustment(userId = 'default') {
    try {
      if (!this.enabled) return 0;
      const profile = this.getProfile(userId);
      return profile.thresholdBias || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get auto-negative patterns from frequent FP prompts.
   * Returns patterns that appeared FP_PATTERN_THRESHOLD+ times.
   *
   * @param {string} [userId='default']
   * @returns {string[]} — array of prompt patterns
   */
  getAutoNegatives(userId = 'default') {
    try {
      if (!this.enabled) return [];
      const profile = this.getProfile(userId);
      return (profile.fpPatterns || [])
        .filter(p => p.count >= FP_PATTERN_THRESHOLD)
        .map(p => p.pattern);
    } catch {
      return [];
    }
  }

  // ─── Private Helpers ───────────────────────────────────────────────

  /**
   * Calculate threshold bias from interaction history.
   * High FP rate → positive bias (raise threshold).
   * High FN rate → negative bias (lower threshold).
   *
   * @param {object} profile
   * @returns {number}
   */
  #calculateBias(profile) {
    const { tp, fp, fn } = profile.interactions;
    const total = tp + fp + fn;
    if (total < 10) return 0; // Not enough data

    const fpRate = fp / total;
    const fnRate = fn / total;

    let bias = 0;
    // High FP rate → raise threshold (positive bias)
    if (fpRate > 0.3) bias += Math.round((fpRate - 0.2) * 20);
    // High FN rate → lower threshold (negative bias)
    if (fnRate > 0.2) bias -= Math.round((fnRate - 0.1) * 20);

    return Math.max(MIN_THRESHOLD_ADJUSTMENT, Math.min(MAX_THRESHOLD_ADJUSTMENT, bias));
  }

  /**
   * Persist profile to disk atomically.
   * @param {object} profile
   */
  #saveProfile(profile) {
    try {
      if (!fs.existsSync(this.#profileDir)) {
        fs.mkdirSync(this.#profileDir, { recursive: true });
      }

      const tmpPath = this.#profilePath + `.tmp.${process.pid}`;
      fs.writeFileSync(tmpPath, JSON.stringify(profile, null, 2));
      fs.renameSync(tmpPath, this.#profilePath);
    } catch {
      // fail-open
    }
  }
}
