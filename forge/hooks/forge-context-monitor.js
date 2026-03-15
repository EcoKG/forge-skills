/**
 * Forge Context Monitor — PostToolUse Hook
 *
 * Monitors context window usage and injects advisory warnings
 * when remaining context drops below thresholds.
 *
 * Install: Add to .claude/settings.json hooks section
 * Trigger: PostToolUse (runs after every tool call)
 *
 * Thresholds:
 *   - 35% remaining → WARNING (suggest summarizing)
 *   - 25% remaining → CRITICAL (suggest new session)
 *   - Debounce: 5 tool uses between warnings
 */

const fs = require("fs");
const path = require("path");

// Configuration
const WARN_THRESHOLD = 0.35; // 35% remaining
const CRITICAL_THRESHOLD = 0.25; // 25% remaining
const DEBOUNCE_COUNT = 5; // min tool uses between warnings

// State file for cross-invocation tracking
const STATE_DIR = "/tmp";

function getStateFile(sessionId) {
  return path.join(STATE_DIR, `forge-ctx-${sessionId || "default"}.json`);
}

function readState(sessionId) {
  try {
    const data = fs.readFileSync(getStateFile(sessionId), "utf8");
    return JSON.parse(data);
  } catch {
    return { toolUseCount: 0, lastWarnAt: 0, level: "ok" };
  }
}

function writeState(sessionId, state) {
  try {
    fs.writeFileSync(getStateFile(sessionId), JSON.stringify(state));
  } catch {
    // Silently fail — monitoring is advisory only
  }
}

function detectForgeProject(cwd) {
  // Check if .forge/project.json or .forge/state.md exists
  const projectJson = path.join(cwd, ".forge", "project.json");
  const stateMd = path.join(cwd, ".forge", "state.md");

  const hasProject = fs.existsSync(projectJson);
  const hasState = fs.existsSync(stateMd);

  return { hasProject, hasState };
}

function getProjectStatus(cwd) {
  try {
    const stateMd = fs.readFileSync(
      path.join(cwd, ".forge", "state.md"),
      "utf8"
    );
    const phaseMatch = stateMd.match(
      /\*\*Phase:\*\*\s*(\d+)\s*of\s*(\d+)\s*\(([^)]+)\)/
    );
    const statusMatch = stateMd.match(/\*\*Phase Status:\*\*\s*(\w+)/);
    const nextMatch = stateMd.match(/## Next Action\n(.+)/);

    return {
      phase: phaseMatch ? `${phaseMatch[1]}/${phaseMatch[2]}` : "?",
      phaseName: phaseMatch ? phaseMatch[3] : "unknown",
      status: statusMatch ? statusMatch[1] : "unknown",
      next: nextMatch ? nextMatch[1].trim() : "",
    };
  } catch {
    return null;
  }
}

// Main hook handler
module.exports = async ({ tool_name, tool_input, result, session_id, cwd }) => {
  const state = readState(session_id);
  state.toolUseCount++;

  // Skip if debounce hasn't elapsed
  if (state.toolUseCount - state.lastWarnAt < DEBOUNCE_COUNT) {
    writeState(session_id, state);
    return {};
  }

  // Estimate context usage from conversation length
  // This is approximate — actual measurement would need API support
  const resultLength = typeof result === "string" ? result.length : 0;
  state.totalChars = (state.totalChars || 0) + resultLength;

  // Rough estimate: 1M context ≈ 750k chars ≈ 4 chars per token
  const estimatedTokens = state.totalChars / 4;
  const maxTokens = 1000000; // 1M context for Opus
  const remainingRatio = 1 - estimatedTokens / maxTokens;

  let additionalContext = "";

  if (remainingRatio <= CRITICAL_THRESHOLD) {
    state.level = "critical";
    state.lastWarnAt = state.toolUseCount;

    const forgeInfo = detectForgeProject(cwd || ".");
    let saveMsg = "";
    if (forgeInfo.hasProject) {
      saveMsg =
        " Forge project state is persisted in .forge/state.md — safe to start a new session.";
    }

    additionalContext = `⚠️ CONTEXT CRITICAL (est. ${Math.round(remainingRatio * 100)}% remaining). Consider starting a new session to prevent quality degradation.${saveMsg} Write any important findings to files before context is compressed.`;
  } else if (remainingRatio <= WARN_THRESHOLD) {
    state.level = "warning";
    state.lastWarnAt = state.toolUseCount;

    additionalContext = `⚡ Context pressure MEDIUM (est. ${Math.round(remainingRatio * 100)}% remaining). Summarize completed work to files. Avoid loading large files into context.`;
  }

  writeState(session_id, state);

  if (additionalContext) {
    return { additionalContext };
  }

  return {};
};
