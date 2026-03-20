/**
 * Context Accumulator — Multi-turn context tracking for forge hook scoring.
 *
 * Replaces 3 separate state files (skill-required-*, skills-used-*, forge-tracker-*)
 * with a single unified context-{sessionId}.json per session.
 *
 * Features:
 *   - Multi-turn score accumulation with exponential decay (factor 0.7)
 *   - Tool usage tracking and pattern detection
 *   - Skill suggestion dedup (replaces SessionTracker)
 *   - Atomic file writes via .tmp.{pid} + rename
 *   - Write coalescing via #pendingWrite
 *   - Legacy migration from 3 old files
 *   - Feature flag: CONTEXT_ACCUMULATOR_ENABLED
 *
 * Fail-open: any error returns null/defaults, never throws.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const DECAY_FACTOR = 0.7;
const MAX_TURNS = 20;
const STATE_SCHEMA_VERSION = 1;

const FEATURE_FLAG = 'CONTEXT_ACCUMULATOR_ENABLED';

// Tool pattern definitions: { name, condition(toolUsage, ctx), bonus, windowMs? }
const TOOL_PATTERNS = [
  {
    name: 'edit-attempt',
    bonus: 35,
    detect(toolUsage) {
      const readCount = toolUsage.Read?.count || 0;
      const editCount = (toolUsage.Edit?.count || 0) + (toolUsage.Write?.count || 0);
      return readCount >= 3 && editCount >= 1;
    },
  },
  {
    name: 'investigation',
    bonus: 25,
    windowMs: 3 * 60 * 1000,
    detect(toolUsage, _ctx, now) {
      const readInfo = toolUsage.Read;
      if (!readInfo || readInfo.count < 8) return false;
      if (this.windowMs && readInfo.firstAt) {
        return (now - readInfo.firstAt) <= this.windowMs;
      }
      return true;
    },
  },
  {
    name: 'search-heavy',
    bonus: 20,
    windowMs: 2 * 60 * 1000,
    detect(toolUsage, _ctx, now) {
      const grepCount = toolUsage.Grep?.count || 0;
      const globCount = toolUsage.Glob?.count || 0;
      const total = grepCount + globCount;
      if (total < 5) return false;
      if (this.windowMs) {
        const earliest = Math.min(
          toolUsage.Grep?.firstAt || Infinity,
          toolUsage.Glob?.firstAt || Infinity
        );
        if (earliest !== Infinity && (now - earliest) > this.windowMs) return false;
      }
      return true;
    },
  },
  {
    name: 'multi-file-read',
    bonus: 15,
    detect(toolUsage) {
      const distinctFiles = toolUsage.Read?.distinctFiles;
      return distinctFiles && distinctFiles.size >= 3;
    },
  },
];

/**
 * Create a blank context object for a new session.
 */
function createEmptyContext(sessionId) {
  return {
    version: STATE_SCHEMA_VERSION,
    sessionId,
    turns: [],
    cumulativeScore: 0,
    toolUsage: {},
    toolPatternBonus: 0,
    detectedPatterns: [],
    skillState: null,
    suggestedSkills: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export class ContextAccumulator {
  #stateDir;
  #pendingWrite = new Map(); // sessionId -> context

  /**
   * @param {string} [stateDir] — directory for context-*.json files
   */
  constructor(stateDir) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    this.#stateDir = stateDir || path.join(home, '.claude', 'hooks', 'state');
  }

  /**
   * Whether the accumulator is enabled via feature flag.
   */
  get enabled() {
    return process.env[FEATURE_FLAG] !== 'false';
  }

  /**
   * Returns the file path for a session's unified context file.
   * @param {string} sessionId
   * @returns {string}
   */
  getContextFilePath(sessionId) {
    const safeId = (sessionId || '').replace(/[^a-zA-Z0-9\-_]/g, '_');
    return path.join(this.#stateDir, `context-${safeId}.json`);
  }

  /**
   * Read the unified context for a session.
   * Falls back to legacy migration if unified file doesn't exist.
   * @param {string} sessionId
   * @returns {object|null}
   */
  getContext(sessionId) {
    if (!sessionId) return null;
    try {
      const filePath = this.getContextFilePath(sessionId);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const ctx = JSON.parse(raw);
        // Restore Set for distinctFiles
        if (ctx.toolUsage) {
          for (const [, info] of Object.entries(ctx.toolUsage)) {
            if (info.distinctFiles && Array.isArray(info.distinctFiles)) {
              info.distinctFiles = new Set(info.distinctFiles);
            }
          }
        }
        return ctx;
      }
      // Try legacy migration
      return this.#readLegacyFiles(sessionId);
    } catch {
      return null;
    }
  }

  /**
   * Accumulate a turn score with decay.
   *
   * Decay model: most recent turn gets full score, previous turns decay
   * by 0.7^distance. FIFO max 20 turns.
   *
   * @param {string} sessionId
   * @param {object} turnScore — { score, matchedKeywords?, negativeSignal?, timestamp?, prompt_prefix? }
   * @returns {object|null} — updated context or null on error / flag off
   */
  accumulateScore(sessionId, turnScore) {
    if (!sessionId || !turnScore) return null;

    try {
      let ctx = this.#pendingWrite.get(sessionId)
        || this.getContext(sessionId)
        || createEmptyContext(sessionId);

      if (!this.enabled) {
        // Feature flag off: return single-turn score only, no accumulation
        return { ...ctx, cumulativeScore: turnScore.score || 0 };
      }

      // Add turn (FIFO)
      const turn = {
        score: turnScore.score || 0,
        matchedKeywords: turnScore.matchedKeywords || [],
        negativeSignal: turnScore.negativeSignal || 0,
        timestamp: turnScore.timestamp || Date.now(),
        prompt_prefix: turnScore.prompt_prefix || '',
      };
      ctx.turns.push(turn);
      if (ctx.turns.length > MAX_TURNS) {
        ctx.turns = ctx.turns.slice(-MAX_TURNS);
      }

      // Calculate cumulative score with decay
      // Most recent turn (last) gets full score, earlier turns decay
      const numTurns = ctx.turns.length;
      let decayedSum = 0;
      for (let i = 0; i < numTurns; i++) {
        const distance = numTurns - 1 - i; // 0 for latest turn
        const decayMultiplier = Math.pow(DECAY_FACTOR, distance);
        decayedSum += ctx.turns[i].score * decayMultiplier;
      }

      ctx.cumulativeScore = decayedSum + (ctx.toolPatternBonus || 0);
      ctx.updatedAt = Date.now();

      // Write coalescing
      this.#pendingWrite.set(sessionId, ctx);
      return ctx;
    } catch {
      return null;
    }
  }

  /**
   * Record a tool use for pattern detection.
   * @param {string} sessionId
   * @param {string} toolName
   * @param {object} [toolInput]
   */
  recordToolUse(sessionId, toolName, toolInput) {
    if (!sessionId || !toolName) return null;
    try {
      let ctx = this.#pendingWrite.get(sessionId)
        || this.getContext(sessionId)
        || createEmptyContext(sessionId);

      if (!ctx.toolUsage) ctx.toolUsage = {};
      if (!ctx.toolUsage[toolName]) {
        ctx.toolUsage[toolName] = { count: 0, firstAt: Date.now(), lastAt: Date.now() };
      }

      const info = ctx.toolUsage[toolName];
      info.count += 1;
      info.lastAt = Date.now();

      // Track distinct files for Read tool
      if (toolName === 'Read' && toolInput?.file_path) {
        if (!info.distinctFiles) info.distinctFiles = new Set();
        // Handle both Set and Array (from deserialization)
        if (Array.isArray(info.distinctFiles)) {
          info.distinctFiles = new Set(info.distinctFiles);
        }
        info.distinctFiles.add(toolInput.file_path);
      }

      ctx.updatedAt = Date.now();
      this.#pendingWrite.set(sessionId, ctx);
      return ctx;
    } catch {
      return null;
    }
  }

  /**
   * Detect tool usage patterns and set toolPatternBonus.
   * Returns the detected pattern name (or null).
   * @param {string} sessionId
   * @returns {string|null} — detected pattern name or null
   */
  detectToolPattern(sessionId) {
    if (!sessionId) return null;
    try {
      let ctx = this.#pendingWrite.get(sessionId)
        || this.getContext(sessionId);
      if (!ctx || !ctx.toolUsage) return null;

      const now = Date.now();
      let maxBonus = 0;
      let detectedName = null;
      const detected = [];

      for (const pattern of TOOL_PATTERNS) {
        if (pattern.detect(ctx.toolUsage, ctx, now)) {
          detected.push(pattern.name);
          if (pattern.bonus > maxBonus) {
            maxBonus = pattern.bonus;
            detectedName = pattern.name;
          }
        }
      }

      ctx.toolPatternBonus = maxBonus;
      ctx.detectedPatterns = detected;
      // Recalculate cumulative score with new bonus
      if (ctx.turns.length > 0) {
        const numTurns = ctx.turns.length;
        let decayedSum = 0;
        for (let i = 0; i < numTurns; i++) {
          const distance = numTurns - 1 - i;
          decayedSum += ctx.turns[i].score * Math.pow(DECAY_FACTOR, distance);
        }
        ctx.cumulativeScore = decayedSum + maxBonus;
      }
      ctx.updatedAt = Date.now();
      this.#pendingWrite.set(sessionId, ctx);
      return detectedName;
    } catch {
      return null;
    }
  }

  /**
   * Update arbitrary skill state data for a session.
   * @param {string} sessionId
   * @param {object} stateData
   */
  updateSkillState(sessionId, stateData) {
    if (!sessionId) return null;
    try {
      let ctx = this.#pendingWrite.get(sessionId)
        || this.getContext(sessionId)
        || createEmptyContext(sessionId);
      ctx.skillState = { ...(ctx.skillState || {}), ...stateData, timestamp: Date.now() };
      ctx.updatedAt = Date.now();
      this.#pendingWrite.set(sessionId, ctx);
      return ctx;
    } catch {
      return null;
    }
  }

  /**
   * Mark a skill as suggested for this session (dedup).
   * @param {string} sessionId
   * @param {string} skillName
   */
  markSkillSuggested(sessionId, skillName) {
    if (!sessionId || !skillName) return;
    try {
      let ctx = this.#pendingWrite.get(sessionId)
        || this.getContext(sessionId)
        || createEmptyContext(sessionId);
      if (!ctx.suggestedSkills) ctx.suggestedSkills = [];
      if (!ctx.suggestedSkills.includes(skillName)) {
        ctx.suggestedSkills.push(skillName);
      }
      ctx.updatedAt = Date.now();
      this.#pendingWrite.set(sessionId, ctx);
    } catch {
      // fail-open
    }
  }

  /**
   * Check if a skill was already suggested in this session.
   * @param {string} sessionId
   * @param {string} skillName
   * @returns {boolean}
   */
  wasSkillSuggested(sessionId, skillName) {
    if (!sessionId || !skillName) return false;
    try {
      const ctx = this.#pendingWrite.get(sessionId)
        || this.getContext(sessionId);
      if (!ctx || !ctx.suggestedSkills) return false;
      return ctx.suggestedSkills.includes(skillName);
    } catch {
      return false;
    }
  }

  /**
   * Flush all pending writes to disk atomically.
   * Uses .tmp.{pid} + rename for crash safety.
   */
  flush() {
    if (this.#pendingWrite.size === 0) return;
    try {
      // Ensure directory exists
      if (!fs.existsSync(this.#stateDir)) {
        fs.mkdirSync(this.#stateDir, { recursive: true });
      }

      for (const [sessionId, ctx] of this.#pendingWrite) {
        const filePath = this.getContextFilePath(sessionId);
        const tmpPath = filePath + `.tmp.${process.pid}`;

        // Serialize: convert Sets to Arrays for JSON
        const serializable = this.#toSerializable(ctx);

        try {
          fs.writeFileSync(tmpPath, JSON.stringify(serializable, null, 2));
          fs.renameSync(tmpPath, filePath);
        } catch {
          // Clean up tmp file on failure
          try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
        }
      }
      this.#pendingWrite.clear();
    } catch {
      // fail-open
    }
  }

  /**
   * Remove expired context files and legacy files.
   * @param {number} [maxAgeMs=86400000] — max age in milliseconds (default 24h)
   */
  cleanup(maxAgeMs = 86400000) {
    try {
      if (!fs.existsSync(this.#stateDir)) return;

      const now = Date.now();
      const files = fs.readdirSync(this.#stateDir);
      const prefixes = ['context-', 'skill-required-', 'skills-used-', 'forge-tracker-'];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const matchesPrefix = prefixes.some(p => file.startsWith(p));
        if (!matchesPrefix) continue;

        const filePath = path.join(this.#stateDir, file);
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(raw);
          const ts = data.updatedAt || data.timestamp || data.createdAt;
          if (ts && (now - ts) > maxAgeMs) {
            fs.unlinkSync(filePath);
          }
        } catch {
          // Corrupted file — remove it
          try { fs.unlinkSync(filePath); } catch { /* ignore */ }
        }
      }
    } catch {
      // fail-open
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────

  /**
   * Read and merge legacy 3-file state into unified context.
   * Legacy files: skill-required-{id}.json, skills-used-{id}.json, forge-tracker-{id}.json
   * @param {string} sessionId
   * @returns {object|null}
   */
  #readLegacyFiles(sessionId) {
    try {
      const safeId = (sessionId || '').replace(/[^a-zA-Z0-9\-_]/g, '_');
      const skillRequiredPath = path.join(this.#stateDir, `skill-required-${safeId}.json`);
      const skillsUsedPath = path.join(this.#stateDir, `skills-used-${safeId}.json`);
      const trackerPath = path.join(this.#stateDir, `forge-tracker-${safeId}.json`);

      let hasLegacy = false;
      const ctx = createEmptyContext(sessionId);

      // skill-required-{id}.json: { skill, score, timestamp }
      try {
        if (fs.existsSync(skillRequiredPath)) {
          const data = JSON.parse(fs.readFileSync(skillRequiredPath, 'utf-8'));
          hasLegacy = true;
          if (data.skill) {
            ctx.skillState = { skill: data.skill, score: data.score, timestamp: data.timestamp };
          }
          if (data.score) {
            ctx.turns.push({
              score: data.score,
              matchedKeywords: [],
              negativeSignal: 0,
              timestamp: data.timestamp || Date.now(),
              prompt_prefix: '',
            });
          }
        }
      } catch { /* ignore */ }

      // skills-used-{id}.json: { skills: [...], timestamp }
      try {
        if (fs.existsSync(skillsUsedPath)) {
          const data = JSON.parse(fs.readFileSync(skillsUsedPath, 'utf-8'));
          hasLegacy = true;
          ctx.suggestedSkills = data.skills || [];
        }
      } catch { /* ignore */ }

      // forge-tracker-{id}.json: { toolUseCount, lastWarnAt, agentDispatches, lastTypeCheckAt }
      try {
        if (fs.existsSync(trackerPath)) {
          const data = JSON.parse(fs.readFileSync(trackerPath, 'utf-8'));
          hasLegacy = true;
          if (data.toolUseCount) {
            ctx.toolUsage._legacy = { count: data.toolUseCount };
          }
        }
      } catch { /* ignore */ }

      if (!hasLegacy) return null;

      // Recalculate cumulative score
      if (ctx.turns.length > 0) {
        ctx.cumulativeScore = ctx.turns.reduce((sum, t) => sum + t.score, 0);
      }

      // Save migrated context as unified file
      this.#pendingWrite.set(sessionId, ctx);

      return ctx;
    } catch {
      return null;
    }
  }

  /**
   * Convert context to JSON-serializable form (Sets → Arrays).
   */
  #toSerializable(ctx) {
    const clone = { ...ctx };
    if (clone.toolUsage) {
      clone.toolUsage = { ...clone.toolUsage };
      for (const [tool, info] of Object.entries(clone.toolUsage)) {
        if (info && info.distinctFiles instanceof Set) {
          clone.toolUsage[tool] = { ...info, distinctFiles: [...info.distinctFiles] };
        }
      }
    }
    return clone;
  }
}
