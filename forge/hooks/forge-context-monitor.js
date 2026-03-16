#!/usr/bin/env node
/**
 * Forge Context Monitor — PostToolUse Hook
 *
 * Monitors context window usage and injects advisory warnings.
 * Uses tool-use count instead of naive char/4 estimation.
 * WARNING at 120 tool uses (60%), CRITICAL at 160 tool uses (80%).
 *
 * stdin: JSON { tool_name, tool_input, result, session_id }
 * stdout: text to inject (or empty)
 */

const fs = require("fs");
const path = require("path");

// Instead of tracking totalChars/4, track tool use count
// Empirical thresholds based on typical Claude Code sessions:
// - Average session: ~200 tool uses before quality degrades
// - WARNING at 120 tool uses (60%)
// - CRITICAL at 160 tool uses (80%)

const WARN_TOOL_COUNT = 120;
const CRITICAL_TOOL_COUNT = 160;
const DEBOUNCE_COUNT = 8; // warn every 8 tool uses, not every 5

const STATE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, ".claude", "hooks", "state");
try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}

function getStateFile(sessionId) {
  return path.join(STATE_DIR, `forge-ctx-${sessionId || "default"}.json`);
}

function readState(sessionId) {
  try { return JSON.parse(fs.readFileSync(getStateFile(sessionId), "utf8")); }
  catch { return { toolUseCount: 0, lastWarnAt: 0 }; }
}

function writeState(sessionId, state) {
  try { fs.writeFileSync(getStateFile(sessionId), JSON.stringify(state)); } catch {}
}

function main() {
  try {
    const raw = fs.readFileSync(0, "utf8").trim();
    if (!raw) { process.exit(0); }
    const input = JSON.parse(raw);

    const state = readState(input.session_id);
    state.toolUseCount = (state.toolUseCount || 0) + 1;

    // Debounce
    if (state.toolUseCount - (state.lastWarnAt || 0) < DEBOUNCE_COUNT) {
      writeState(input.session_id, state);
      process.exit(0);
    }

    if (state.toolUseCount >= CRITICAL_TOOL_COUNT) {
      state.lastWarnAt = state.toolUseCount;
      writeState(input.session_id, state);
      process.stdout.write(
        `⚠️ CONTEXT CRITICAL (${state.toolUseCount} tool uses). ` +
        `Start a new session to prevent quality degradation. ` +
        `Project state is persisted in .forge/state.md.`
      );
    } else if (state.toolUseCount >= WARN_TOOL_COUNT) {
      state.lastWarnAt = state.toolUseCount;
      writeState(input.session_id, state);
      process.stdout.write(
        `⚡ Context pressure MEDIUM (${state.toolUseCount} tool uses). ` +
        `Summarize completed work to files. Avoid loading large files.`
      );
    } else {
      writeState(input.session_id, state);
    }
  } catch {}
  process.exit(0);
}

main();
