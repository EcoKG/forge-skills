#!/usr/bin/env node
/**
 * Forge Gate Guard — PreToolUse Hook (v6.0 Ironclad)
 *
 * Hard-blocks tool usage that violates pipeline state.
 * Reads .forge/pipeline-state.json for current state.
 * Exit(1) = hard block. Exit(0) = allow.
 *
 * 4 Critical Gates:
 *   Gate 1: research.md must exist before plan.md creation
 *   Gate 2: plan_check PASS before source code edits
 *   Gate 3: build/test must pass before git commit
 *   Gate 4: verification must exist before report.md creation
 *
 * stdin: JSON { tool_name, tool_input, session_id }
 * stdout: warning text (if any)
 */

const fs = require("fs");
const path = require("path");

const CWD = process.cwd();
const FORGE_DIR = path.join(CWD, ".forge");
const STATE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, ".claude", "hooks", "state");

const CODE_EXTENSIONS = new Set([
  ".js", ".ts", ".jsx", ".tsx", ".py", ".go", ".rs", ".java",
  ".c", ".cpp", ".h", ".hpp", ".cs", ".rb", ".php", ".swift",
  ".kt", ".scala", ".vue", ".svelte", ".ex", ".exs",
]);

const SKIP_PATHS = [".forge/", "node_modules/", ".git/", "package-lock.json", "yarn.lock"];

function isCodeFile(filePath) {
  if (!filePath) return false;
  for (const p of SKIP_PATHS) { if (filePath.includes(p)) return false; }
  return CODE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function findPipelineState() {
  // Find the most recent pipeline-state.json in .forge/
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
            // Only use active (non-completed) sessions
            if (state.current_step !== "completed") return state;
          }
        }
      } catch {}
    }
  } catch {}
  return null;
}

function findArtifactDir(state) {
  if (state && state.artifact_dir) {
    const fullPath = path.join(CWD, state.artifact_dir);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

function artifactExists(artifactDir, filename) {
  if (!artifactDir) return false;
  const filePath = path.join(artifactDir, filename);
  try {
    const stat = fs.statSync(filePath);
    return stat.size > 10; // Must have actual content, not just empty
  } catch { return false; }
}

// Check if forge was invoked (for non-forge edits)
function forgeWasInvoked(sessionId) {
  try {
    const flagFile = path.join(STATE_DIR, `forge-invoked-${sessionId || "default"}.json`);
    const data = JSON.parse(fs.readFileSync(flagFile, "utf8"));
    if (data.invoked === true) return true;
  } catch {}
  try {
    const entries = fs.readdirSync(FORGE_DIR);
    for (const entry of entries) {
      const stat = fs.statSync(path.join(FORGE_DIR, entry));
      if (Date.now() - stat.mtimeMs < 3600000) return true;
    }
  } catch {}
  return false;
}

function main() {
  try {
    const raw = fs.readFileSync(0, "utf8").trim();
    if (!raw) { process.exit(0); return; }
    const input = JSON.parse(raw);

    const toolName = input.tool_name;
    const toolInput = input.tool_input || {};
    const sessionId = input.session_id;

    // Only check Edit, Write, Bash
    if (!["Edit", "Write", "Bash"].includes(toolName)) { process.exit(0); return; }

    const state = findPipelineState();

    // If no active pipeline, fall back to basic forge-invoked check
    if (!state) {
      if (["Edit", "Write"].includes(toolName)) {
        const filePath = toolInput.file_path || "";
        if (isCodeFile(filePath) && !forgeWasInvoked(sessionId)) {
          process.stdout.write(
            "⚠ FORGE GATE: Editing code without forge. Consider /forge for complex changes."
          );
        }
      }
      process.exit(0);
      return;
    }

    const artifactDir = findArtifactDir(state);
    const currentStep = state.current_step;
    const stepOrder = state.current_step_order || 0;

    // === GATE 1: research.md must exist before plan.md ===
    if (toolName === "Write") {
      const filePath = toolInput.file_path || "";
      const basename = path.basename(filePath);
      if (basename === "plan.md" && filePath.includes(".forge/")) {
        if (!artifactExists(artifactDir, "research.md")) {
          // Check if research is skipped via pipeline flags
          const skipped = state.skipped_steps || [];
          if (!skipped.includes("research")) {
            process.stdout.write(
              "🚫 GATE 1 BLOCKED: Cannot create plan.md — research.md does not exist.\n" +
              "Complete research first, or use --direct to skip.\n" +
              "Run: forge-engine.js transition research"
            );
            process.exit(1);
            return;
          }
        }
      }
    }

    // === GATE 2: plan_check PASS before source code edits ===
    if (["Edit", "Write"].includes(toolName)) {
      const filePath = toolInput.file_path || "";
      if (isCodeFile(filePath) && stepOrder < 7) {
        // Allow if step is execute (7) or later
        const allowedSteps = ["execute", "verify", "finalize", "completed"];
        if (!allowedSteps.includes(currentStep)) {
          process.stdout.write(
            `🚫 GATE 2 BLOCKED: Cannot edit source code at step "${currentStep}" (order ${stepOrder}).\n` +
            `Code edits are only allowed at step 7 (execute) or later.\n` +
            `Current pipeline state requires: ${state.gates_pending?.join(", ") || "complete earlier steps"}`
          );
          process.exit(1);
          return;
        }
      }
    }

    // === GATE 3: build/test pass before git commit ===
    if (toolName === "Bash") {
      const cmd = toolInput.command || "";
      if (cmd.match(/git\s+commit/)) {
        const lastBuild = state.last_build_result;
        const lastTest = state.last_test_result;

        if (lastBuild === "fail") {
          process.stdout.write(
            "🚫 GATE 3 BLOCKED: Cannot git commit — last build FAILED.\n" +
            "Fix build errors first, then re-run: forge-engine.js verify-build <command>"
          );
          process.exit(1);
          return;
        }
        if (lastTest === "fail") {
          process.stdout.write(
            "🚫 GATE 3 BLOCKED: Cannot git commit — last test run FAILED.\n" +
            "Fix failing tests first, then re-run: forge-engine.js verify-tests <command>"
          );
          process.exit(1);
          return;
        }
      }
    }

    // === GATE 4: verification before report.md ===
    if (toolName === "Write") {
      const filePath = toolInput.file_path || "";
      const basename = path.basename(filePath);
      if (basename === "report.md" && filePath.includes(".forge/")) {
        if (!artifactExists(artifactDir, "verification.md")) {
          const skipped = state.skipped_steps || [];
          if (!skipped.includes("verify")) {
            process.stdout.write(
              "🚫 GATE 4 BLOCKED: Cannot create report.md — verification.md does not exist.\n" +
              "Complete verification first.\n" +
              "Run: forge-engine.js transition verify"
            );
            process.exit(1);
            return;
          }
        }
      }
    }

    // No gate violations — allow
  } catch (err) {
    // Fail-open: any error in gate logic → allow the tool call
    // Never block Claude due to our own bugs
  }
  process.exit(0);
}

main();
