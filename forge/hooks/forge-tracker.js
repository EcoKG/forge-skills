#!/usr/bin/env node
/**
 * Forge Tracker — PostToolUse Hook (v6.0 Ironclad)
 *
 * After EVERY tool call:
 * 1. Track tool use count (context pressure)
 * 2. Detect Agent dispatches → auto-record in trace.jsonl
 * 3. Detect build/test commands → record results in pipeline-state.json
 * 4. Detect forge-engine.js calls → update hook state cache
 *
 * stdin: JSON { tool_name, tool_input, result, session_id }
 * stdout: advisory text (or empty)
 */

const fs = require("fs");
const path = require("path");

const CWD = process.cwd();
const FORGE_DIR = path.join(CWD, ".forge");
const STATE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, ".claude", "hooks", "state");
try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}

// Context pressure thresholds
const WARN_TOOL_COUNT = 120;
const CRITICAL_TOOL_COUNT = 160;
const DEBOUNCE_COUNT = 8;

// Build/test command patterns
const BUILD_PATTERNS = [
  /npm run build/, /npx tsc/, /go build/, /cargo build/, /mvn compile/,
  /gradle build/, /dotnet build/, /make\b/, /cmake --build/
];
const TEST_PATTERNS = [
  /npm test/, /npx jest/, /go test/, /pytest/, /python -m pytest/,
  /cargo test/, /mvn test/, /gradle test/, /dotnet test/
];

function getStateFile(sessionId) {
  return path.join(STATE_DIR, `forge-tracker-${sessionId || "default"}.json`);
}

function readState(sessionId) {
  try { return JSON.parse(fs.readFileSync(getStateFile(sessionId), "utf8")); }
  catch { return { toolUseCount: 0, lastWarnAt: 0, agentDispatches: 0 }; }
}

function writeState(sessionId, state) {
  try { fs.writeFileSync(getStateFile(sessionId), JSON.stringify(state)); } catch {}
}

function findActivePipelineState() {
  try {
    const entries = fs.readdirSync(FORGE_DIR);
    const dateDirs = entries.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
    for (const dateDir of dateDirs) {
      const datePath = path.join(FORGE_DIR, dateDir);
      try {
        const slugDirs = fs.readdirSync(datePath)
          .filter(d => { try { return fs.statSync(path.join(datePath, d)).isDirectory(); } catch { return false; } })
          .sort().reverse();
        for (const slugDir of slugDirs) {
          const statePath = path.join(datePath, slugDir, "pipeline-state.json");
          if (fs.existsSync(statePath)) {
            const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
            if (state.current_step !== "completed") return { state, path: statePath, dir: path.join(datePath, slugDir) };
          }
        }
      } catch {}
    }
  } catch {}
  return null;
}

function updatePipelineState(statePath, updater) {
  try {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    updater(state);
    state.updated_at = new Date().toISOString();
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch {}
}

function main() {
  try {
    const raw = fs.readFileSync(0, "utf8").trim();
    if (!raw) { process.exit(0); return; }
    const input = JSON.parse(raw);

    const state = readState(input.session_id);
    state.toolUseCount = (state.toolUseCount || 0) + 1;
    let output = "";

    // === 1. Context Pressure Monitor ===
    if (state.toolUseCount - (state.lastWarnAt || 0) >= DEBOUNCE_COUNT) {
      if (state.toolUseCount >= CRITICAL_TOOL_COUNT) {
        state.lastWarnAt = state.toolUseCount;
        output += `⚠ CONTEXT CRITICAL (${state.toolUseCount} tool uses). Start a new session. State is in .forge/pipeline-state.json.\n`;
      } else if (state.toolUseCount >= WARN_TOOL_COUNT) {
        state.lastWarnAt = state.toolUseCount;
        output += `⚡ Context pressure MEDIUM (${state.toolUseCount} tool uses). Summarize work to files.\n`;
      }
    }

    // === 2. Agent Dispatch Detection ===
    if (input.tool_name === "Agent") {
      state.agentDispatches = (state.agentDispatches || 0) + 1;

      // Auto-record in trace.jsonl if pipeline is active
      const pipeline = findActivePipelineState();
      if (pipeline) {
        const traceEntry = {
          timestamp: new Date().toISOString(),
          agent: "agent-dispatch",
          dispatch_number: state.agentDispatches,
          result_length: (input.result || "").length
        };
        const tracePath = path.join(pipeline.dir, "trace.jsonl");
        try { fs.appendFileSync(tracePath, JSON.stringify(traceEntry) + "\n"); } catch {}
      }
    }

    // === 3. Build/Test Result Detection ===
    if (input.tool_name === "Bash") {
      const cmd = input.tool_input?.command || "";
      const result = input.result || "";
      const pipeline = findActivePipelineState();

      if (pipeline) {
        // Detect build commands
        for (const pattern of BUILD_PATTERNS) {
          if (pattern.test(cmd)) {
            const passed = !result.includes("error") && !result.includes("FAIL") && !result.includes("Error");
            updatePipelineState(pipeline.path, (s) => {
              s.last_build_result = passed ? "pass" : "fail";
            });
            break;
          }
        }

        // Detect test commands
        for (const pattern of TEST_PATTERNS) {
          if (pattern.test(cmd)) {
            const passed = !result.includes("FAIL") && !result.includes("failed") && !result.includes("Error");
            updatePipelineState(pipeline.path, (s) => {
              s.last_test_result = passed ? "pass" : "fail";
            });
            break;
          }
        }
      }
    }

    writeState(input.session_id, state);

    if (output) {
      process.stdout.write(output);
    }
  } catch {}
  process.exit(0);
}

main();
