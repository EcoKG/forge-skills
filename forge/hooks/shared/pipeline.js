/**
 * Shared pipeline state helpers for forge hooks.
 * Single source of truth — do NOT duplicate in individual hooks.
 */

const fs = require("fs");
const path = require("path");

const STALE_MS = 86400000; // 24 hours

/**
 * Find the most recent active (non-completed) pipeline-state.json.
 * @param {string} forgeDir — absolute path to .forge/ directory
 * @returns {{ state: object, path: string, dir: string } | null}
 */
function findActivePipeline(forgeDir) {
  try {
    const entries = fs.readdirSync(forgeDir);
    const dateDirs = entries.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
    for (const dateDir of dateDirs) {
      const datePath = path.join(forgeDir, dateDir);
      try {
        const slugDirs = fs.readdirSync(datePath)
          .filter(d => { try { return fs.statSync(path.join(datePath, d)).isDirectory(); } catch { return false; } })
          .sort().reverse();
        for (const slugDir of slugDirs) {
          const statePath = path.join(datePath, slugDir, "pipeline-state.json");
          if (fs.existsSync(statePath)) {
            const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
            if (state.current_step !== "completed") {
              // Staleness check: flag pipelines not updated in 24 hours but don't skip
              const updatedAt = state.updated_at || state.created_at;
              if (updatedAt) {
                const age = Date.now() - new Date(updatedAt).getTime();
                if (age > STALE_MS) {
                  state._stale = true; // Flag but don't skip — gates still apply
                }
              }
              return { state, path: statePath, dir: path.join(datePath, slugDir) };
            }
          }
        }
      } catch {}
    }
  } catch {}
  return null;
}

/**
 * Boolean convenience: is there an active pipeline under cwd?
 * @param {string} cwd — project root
 * @returns {boolean}
 */
function hasActivePipeline(cwd) {
  if (!cwd) return false;
  const forgeDir = path.join(cwd, ".forge");
  return findActivePipeline(forgeDir) !== null;
}

/**
 * Returns the path to the skill-required state file for a given session.
 * @param {string} sessionId
 * @returns {string|null}
 */
function getSkillStateFilePath(sessionId) {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  if (!home || !sessionId) return null;
  return path.join(home, ".claude", "hooks", "state", `skill-required-${sessionId}.json`);
}

/**
 * Returns the path to the unified context state file for a given session.
 * @param {string} sessionId
 * @returns {string|null}
 */
function getContextFilePath(sessionId) {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  if (!home || !sessionId) return null;
  const safeId = (sessionId || "").replace(/[^a-zA-Z0-9\-_]/g, "_");
  return path.join(home, ".claude", "hooks", "state", `context-${safeId}.json`);
}

module.exports = {
  findActivePipeline,
  hasActivePipeline,
  getSkillStateFilePath,
  getContextFilePath,
};
