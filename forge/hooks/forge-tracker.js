#!/usr/bin/env node
/**
 * Forge Tracker — PostToolUse Hook (v6.1)
 *
 * After EVERY tool call:
 * 1. Track tool use count (context pressure)
 * 2. Detect Agent dispatches → auto-record in trace.jsonl
 * 3. Detect build/test commands → record results in pipeline-state.json
 * 4. Auto type check after code file edits (typecheck pipeline-state update)
 * 5. Validate Agent output files (required sections check)
 * 6. Auto lint after code file edits (if config.backpressure.checks.lint=true)
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

const CODE_EXTENSIONS = new Set([
  ".js", ".ts", ".jsx", ".tsx", ".py", ".go", ".rs", ".java",
  ".c", ".cpp", ".cs", ".rb", ".php", ".vue", ".svelte",
]);

// Required sections for agent output validation
const SUMMARY_REQUIRED_SECTIONS = ["## Status", "## Changes Made", "## Self-Check"];
const VERIFICATION_REQUIRED_SECTIONS = ["## Verdict"];

function isCodeFile(fp) {
  if (!fp) return false;
  if (fp.includes("node_modules/") || fp.includes(".forge/") || fp.includes(".git/")) return false;
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

    // === 4. Auto Type Check after code file edit (Hook 1) ===
    if (["Edit", "Write"].includes(input.tool_name)) {
      const filePath = input.tool_input?.file_path || "";
      if (isCodeFile(filePath)) {
        const typeCheckCmd = detectCommand(TYPE_CHECK_MAP);
        if (typeCheckCmd) {
          const result = runQuickCheck(typeCheckCmd, 15000);
          if (!result.pass) {
            output += `⚠ TYPE CHECK FAILED after editing ${path.basename(filePath)}:\n${result.output}\n`;
            // Update pipeline state
            const pipeline = findActivePipelineState();
            if (pipeline) {
              updatePipelineState(pipeline.path, (s) => { s.last_build_result = "fail"; });
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
            const fullCmd = `${lintCmd} "${filePath}"`;
            const result = runQuickCheck(fullCmd, 10000);
            if (!result.pass && result.output) {
              output += `⚡ LINT: ${result.output}\n`;
            }
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
