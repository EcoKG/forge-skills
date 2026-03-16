#!/usr/bin/env node
/**
 * Forge Context Monitor — PostToolUse Hook
 *
 * Monitors context window usage and injects advisory warnings.
 * WARNING at 35% remaining, CRITICAL at 25% remaining.
 *
 * stdin: JSON { tool_name, tool_input, result, session_id }
 * stdout: text to inject (or empty)
 */

const fs = require("fs");
const path = require("path");

const WARN_THRESHOLD = 0.35;
const CRITICAL_THRESHOLD = 0.25;
const DEBOUNCE_COUNT = 5;

function getStateFile(sessionId) {
  return path.join("/tmp", `forge-ctx-${sessionId || "default"}.json`);
}

function readState(sessionId) {
  try { return JSON.parse(fs.readFileSync(getStateFile(sessionId), "utf8")); }
  catch { return { toolUseCount: 0, lastWarnAt: 0, totalChars: 0 }; }
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
    state.toolUseCount++;

    if (state.toolUseCount - state.lastWarnAt < DEBOUNCE_COUNT) {
      writeState(input.session_id, state);
      process.exit(0);
    }

    const resultLen = typeof input.result === "string" ? input.result.length : 0;
    state.totalChars = (state.totalChars || 0) + resultLen;

    const estimatedTokens = state.totalChars / 4;
    const maxTokens = 1000000;
    const remainingRatio = 1 - estimatedTokens / maxTokens;

    if (remainingRatio <= CRITICAL_THRESHOLD) {
      state.lastWarnAt = state.toolUseCount;
      writeState(input.session_id, state);
      process.stdout.write(`⚠️ CONTEXT CRITICAL (est. ${Math.round(remainingRatio * 100)}% remaining). Start a new session to prevent quality degradation. State is persisted in .forge/state.md.`);
    } else if (remainingRatio <= WARN_THRESHOLD) {
      state.lastWarnAt = state.toolUseCount;
      writeState(input.session_id, state);
      process.stdout.write(`⚡ Context pressure MEDIUM (est. ${Math.round(remainingRatio * 100)}% remaining). Summarize completed work to files.`);
    } else {
      writeState(input.session_id, state);
    }
  } catch {}
  process.exit(0);
}

main();
