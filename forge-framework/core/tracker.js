#!/usr/bin/env node
/**
 * Forge Tracker — PostToolUse Hook (v7.0)
 *
 * After EVERY tool call:
 * 1. Track tool use count (context pressure)
 * 2. Detect Agent dispatches → auto-record in trace.jsonl
 * 3. Detect build/test commands → write signals to tracker-signals.json
 * 4. Auto type check after code file edits (signal on failure)
 * 5. Validate Agent output files (required sections check)
 * 6. Auto lint after code file edits (if config.backpressure.checks.lint=true)
 *
 * stdin: JSON { tool_name, tool_input, result, session_id }
 * stdout: advisory text (or empty)
 */

const fs = require("fs");
const path = require("path");
const { CODE_EXTENSIONS, SKIP_PATHS } = require("../shared/constants");
const { findActivePipeline } = require("../shared/pipeline");

// ContextAccumulator is ESM — loaded via dynamic import() in main()
let ContextAccumulator = null;

let CWD;
let FORGE_DIR;
const STATE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, ".claude", "hooks", "state");
try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}

// Context pressure thresholds
const WARN_TOOL_COUNT = 120;
const CRITICAL_TOOL_COUNT = 160;
const DEBOUNCE_COUNT = 8;
const TYPE_CHECK_DEBOUNCE_MS = 30000; // 30 seconds (was 5s — too aggressive per edit)

// Build/test command patterns
const BUILD_PATTERNS = [
  /npm run build/, /npx tsc/, /go build/, /cargo build/, /mvn compile/,
  /gradle build/, /dotnet build/, /make\b/, /cmake --build/
];
const TEST_PATTERNS = [
  /npm test/, /npx jest/, /npx vitest/, /vitest\b/, /go test/, /pytest/, /python -m pytest/,
  /cargo test/, /mvn test/, /gradle test/, /dotnet test/
];

// Type check command detection by project markers
const TYPE_CHECK_MAP = {
  "tsconfig.json": "npx tsc --noEmit",
  "go.mod": "go vet ./...",
  "Cargo.toml": "cargo check",
  "pyproject.toml": "python -m py_compile",
};

// Lint command detection by project markers
const LINT_MAP = {
  ".eslintrc": "npx eslint --quiet",
  ".eslintrc.js": "npx eslint --quiet",
  ".eslintrc.json": "npx eslint --quiet",
  "eslint.config.js": "npx eslint --quiet",
  ".golangci.yml": "golangci-lint run",
  "ruff.toml": "ruff check",
  "pyproject.toml": "ruff check",
};

// Required sections for agent output validation
const SUMMARY_REQUIRED_SECTIONS = ["## Status", "## Changes Made", "## Self-Check"];
const VERIFICATION_REQUIRED_SECTIONS = ["## Verdict"];
const ARCHITECT_REQUIRED_SECTIONS = ["## Overview"];

function isCodeFile(fp) {
  if (!fp) return false;
  for (const p of SKIP_PATHS) { if (fp.includes(p)) return false; }
  return CODE_EXTENSIONS.has(path.extname(fp).toLowerCase());
}

function detectCommand(markerMap) {
  for (const [marker, cmd] of Object.entries(markerMap)) {
    if (fs.existsSync(path.join(CWD, marker))) return cmd;
  }
  return null;
}

function runQuickCheck(command, timeout) {
  try {
    const { execSync } = require("child_process");
    const out = execSync(command, { cwd: CWD, encoding: "utf8", timeout: timeout || 10000, stdio: ["pipe", "pipe", "pipe"] });
    return { pass: true, output: "" };
  } catch (err) {
    const errOut = (err.stderr || err.stdout || "").trim();
    // Only return first 3 lines of errors to keep output concise
    const lines = errOut.split("\n").filter(l => l.includes("error") || l.includes("Error")).slice(0, 3);
    return { pass: false, output: lines.join("\n") };
  }
}

function getStateFile(sessionId) {
  return path.join(STATE_DIR, `forge-tracker-${sessionId || "default"}.json`);
}

function readState(sessionId) {
  try { return JSON.parse(fs.readFileSync(getStateFile(sessionId), "utf8")); }
  catch { return { toolUseCount: 0, lastWarnAt: 0, agentDispatches: 0, lastTypeCheckAt: 0 }; }
}

function writeState(sessionId, state) {
  try { fs.writeFileSync(getStateFile(sessionId), JSON.stringify(state)); } catch {}
}

function findActivePipelineState() {
  return findActivePipeline(FORGE_DIR);
}

function updatePipelineState(statePath, updater) {
  try {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    updater(state);
    state.updated_at = new Date().toISOString();
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch (err) { process.stderr.write("forge-tracker: updatePipelineState error: " + (err.message || String(err)) + "\n"); }
}

function writeTrackerSignal(forgeDir, signalType, data) {
  const signalPath = path.join(forgeDir, "tracker-signals.json");
  let signals = [];
  try { signals = JSON.parse(fs.readFileSync(signalPath, "utf8")); } catch {}
  signals.push({
    type: signalType,
    data: data,
    timestamp: new Date().toISOString()
  });
  // Keep only last 20 signals to prevent unbounded growth
  if (signals.length > 20) signals = signals.slice(-20);
  const tempPath = signalPath + ".tmp." + process.pid;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(signals, null, 2));
    fs.renameSync(tempPath, signalPath);
  } catch {
    try { fs.unlinkSync(tempPath); } catch {}
  }
}

async function main() {
  try {
    const raw = fs.readFileSync(0, "utf8").trim();
    if (!raw) { process.exit(0); return; }
    const input = JSON.parse(raw);
    if (!input.tool_name || !input.session_id) { process.exit(0); return; }

    CWD = input.cwd || process.cwd();
    FORGE_DIR = path.join(CWD, ".forge");

    const state = readState(input.session_id);
    state.toolUseCount = (state.toolUseCount || 0) + 1;
    let output = "";

    // === Context Accumulator: tool usage feed-in (feature flag guarded) ===
    if (process.env.CONTEXT_ACCUMULATOR_ENABLED !== 'false') {
      try {
        if (!ContextAccumulator) {
          const mod = await import("./activation/context-accumulator.js");
          ContextAccumulator = mod.ContextAccumulator;
        }
        const accumulator = new ContextAccumulator(STATE_DIR);
        accumulator.recordToolUse(input.session_id, input.tool_name, input.tool_input);
        accumulator.detectToolPattern(input.session_id);
        accumulator.flush();
      } catch {
        // Fail-open: accumulator errors should not affect tracker operation
      }
    }

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
            // Regex-based detection to avoid false positives on "0 errors", "Error handling", etc.
            let passed = null; // null = uncertain, don't update state
            const FAIL_PATTERNS = [
              /^ERROR\b/m,
              /Build failed/i,
              /Compilation failed/i,
              /FATAL ERROR/i,
              /Cannot find module/i,
              /SyntaxError:/,
              /TypeError:/,
            ];
            const PASS_PATTERNS = [
              /compiled?\s+successfully/i,
              /Build succeeded/i,
              /0\s+errors?\b/i,
              /webpack.*compiled/i,
            ];
            // Check fail patterns first
            if (FAIL_PATTERNS.some(p => p.test(result))) {
              passed = false;
            } else if (PASS_PATTERNS.some(p => p.test(result))) {
              passed = true;
            }

            if (passed !== null) {
              writeTrackerSignal(FORGE_DIR, "build_result", { result: passed ? "pass" : "fail", command: cmd });
            }
            break;
          }
        }

        // Detect test commands
        for (const pattern of TEST_PATTERNS) {
          if (pattern.test(cmd)) {
            let testPassed = null;
            const TEST_FAIL_PATTERNS = [
              /(\d+)\s+(?:failed|failing|failures)/i,
              /FAIL\s+\w/,
              /Tests?:.*\b[1-9]\d*\s+failed/i,
              /AssertionError/i,
            ];
            const TEST_PASS_PATTERNS = [
              /Tests?:.*\b0\s+failed/i,
              /All tests passed/i,
              /Tests?:\s+\d+\s+passed/i,
              /\d+\s+passing/i,
            ];
            // For test fail patterns with numbers, extract the count
            for (const p of TEST_FAIL_PATTERNS) {
              const m = result.match(p);
              if (m) {
                // If pattern captures a number, check it's > 0
                if (m[1] && parseInt(m[1]) === 0) continue;
                testPassed = false;
                break;
              }
            }
            if (testPassed === null && TEST_PASS_PATTERNS.some(p => p.test(result))) {
              testPassed = true;
            }

            if (testPassed !== null) {
              writeTrackerSignal(FORGE_DIR, "test_result", { result: testPassed ? "pass" : "fail", command: cmd });
            }
            break;
          }
        }
      }
    }

    // === 4. Auto Type Check after code file edit (Hook 1) ===
    if (["Edit", "Write"].includes(input.tool_name)) {
      const filePath = input.tool_input?.file_path || "";
      if (isCodeFile(filePath)) {
        const now = Date.now();
        if (now - (state.lastTypeCheckAt || 0) >= TYPE_CHECK_DEBOUNCE_MS) {
          const typeCheckCmd = detectCommand(TYPE_CHECK_MAP);
          if (typeCheckCmd) {
            state.lastTypeCheckAt = now;
            const result = runQuickCheck(typeCheckCmd, 5000);
            if (!result.pass) {
              output += `⚠ TYPE CHECK FAILED after editing ${path.basename(filePath)}:\n${result.output}\n`;
              // Signal type check failure
              writeTrackerSignal(FORGE_DIR, "typecheck_fail", { file: path.basename(filePath), output: result.output });
            }
          }
        }
      }
    }

    // === 5. Agent Output Validation (Hook 2) ===
    if (input.tool_name === "Agent") {
      const pipeline = findActivePipelineState();
      if (pipeline) {
        // Check for latest task summary or verification file
        try {
          const files = fs.readdirSync(pipeline.dir);

          // Validate task summaries
          const summaries = files.filter(f => f.startsWith("task-") && f.endsWith("-summary.md"));
          for (const summary of summaries.slice(-1)) { // Check only the latest
            const content = fs.readFileSync(path.join(pipeline.dir, summary), "utf8");
            const missing = SUMMARY_REQUIRED_SECTIONS.filter(s => !content.includes(s));
            if (missing.length > 0) {
              output += `⚠ AGENT OUTPUT INCOMPLETE: ${summary} is missing sections: ${missing.join(", ")}\n`;
            }
          }

          // Validate verification.md
          if (files.includes("verification.md")) {
            const content = fs.readFileSync(path.join(pipeline.dir, "verification.md"), "utf8");
            const missing = VERIFICATION_REQUIRED_SECTIONS.filter(s => !content.includes(s));
            if (missing.length > 0) {
              output += `⚠ VERIFICATION INCOMPLETE: missing sections: ${missing.join(", ")}\n`;
            }
          }

          // Validate architect output
          if (files.includes("architect-output.md")) {
            const content = fs.readFileSync(path.join(pipeline.dir, "architect-output.md"), "utf8");
            const missing = ARCHITECT_REQUIRED_SECTIONS.filter(s => !content.includes(s));
            if (missing.length > 0) {
              output += `⚠ ARCHITECT OUTPUT INCOMPLETE: architect-output.md is missing sections: ${missing.join(", ")}\n`;
            }
          }
        } catch {}
      }
    }

    // === 6. Auto Lint after code file edit (Hook 3) ===
    if (["Edit", "Write"].includes(input.tool_name)) {
      const filePath = input.tool_input?.file_path || "";
      if (isCodeFile(filePath)) {
        // Check if lint is enabled in config
        let lintEnabled = false;
        try {
          const configPath = path.join(FORGE_DIR, "config.json");
          if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
            lintEnabled = config?.backpressure?.checks?.lint === true;
          }
        } catch {}

        if (lintEnabled) {
          const lintCmd = detectCommand(LINT_MAP);
          if (lintCmd) {
            // Use execFileSync with array args to avoid shell injection via filePath
            const parts = lintCmd.split(/\s+/);
            try {
              const { execFileSync } = require("child_process");
              execFileSync(parts[0], [...parts.slice(1), filePath], { cwd: CWD, encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] });
            } catch (err) {
              const errOut = (err.stderr || err.stdout || "").trim();
              const lines = errOut.split("\n").filter(l => l.includes("error") || l.includes("Error")).slice(0, 3);
              if (lines.length > 0) {
                output += `⚡ LINT: ${lines.join("\n")}\n`;
              }
            }
          }
        }
      }
    }

    writeState(input.session_id, state);

    if (output) {
      process.stdout.write(output);
    }
  } catch (err) { process.stderr.write("forge-tracker: " + (err.message || String(err)) + "\n"); }
  process.exit(0);
}

main();
