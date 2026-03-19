/**
 * Forge Test Utilities
 *
 * Shared helpers for all test levels (unit, integration, e2e).
 * Provides: temp dirs, mock pipeline state, hook stdin simulation, cleanup.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const HOOKS_DIR = path.join(__dirname, "..", "..", "forge", "hooks");
const TEMPLATES_DIR = path.join(__dirname, "..", "..", "forge", "templates");

/**
 * Create a temporary .forge/ directory with optional pipeline state.
 * Returns { dir, forgeDir, artifactDir, cleanup }
 */
function createTempForge(pipelineState = null) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-test-"));
  const forgeDir = path.join(dir, ".forge");
  const dateDir = path.join(forgeDir, "2026-01-01");
  const artifactDir = path.join(dateDir, "test-0000");

  fs.mkdirSync(artifactDir, { recursive: true });

  if (pipelineState) {
    fs.writeFileSync(
      path.join(artifactDir, "pipeline-state.json"),
      JSON.stringify(pipelineState, null, 2)
    );
  }

  // Write minimal meta.json
  fs.writeFileSync(
    path.join(artifactDir, "meta.json"),
    JSON.stringify({ request: "test", type: "code", scale: "small", created_at: new Date().toISOString() })
  );

  return {
    dir,
    forgeDir,
    artifactDir,
    relativeArtifactDir: ".forge/2026-01-01/test-0000",
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

/**
 * Create a mock pipeline-state.json object.
 */
function mockPipelineState(overrides = {}) {
  return {
    session_id: "test-session",
    artifact_dir: ".forge/2026-01-01/test-0000",
    pipeline: "standard",
    current_step: "execute",
    current_step_order: 8,
    gates_passed: ["init_done", "researched", "arch_guided", "planned", "plan_checked", "approved", "branched"],
    gates_pending: ["executed"],
    allowed_transitions: ["verify"],
    skipped_steps: [],
    agents_dispatched: 0,
    revision_counts: {},
    last_build_result: null,
    last_test_result: null,
    wave_current: 0,
    wave_total: 0,
    tasks_completed: [],
    drift: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    request: "test request",
    type: "code",
    scale: "small",
    options: {},
    ...overrides,
  };
}

/**
 * Run a hook script with simulated stdin JSON.
 * Returns { exitCode, stdout, stderr }
 */
function runHook(hookName, stdinJson) {
  const hookPath = path.join(HOOKS_DIR, hookName);
  const input = typeof stdinJson === "string" ? stdinJson : JSON.stringify(stdinJson);

  try {
    const stdout = execFileSync(process.execPath, [hookPath], {
      input,
      encoding: "utf8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { exitCode: 0, stdout, stderr: "" };
  } catch (err) {
    return {
      exitCode: err.status || 1,
      stdout: err.stdout || "",
      stderr: err.stderr || "",
    };
  }
}

/**
 * Run forge-tools.js CLI command.
 * Returns parsed JSON or { error, exitCode, stderr }
 */
function runForgeTools(command, ...args) {
  const toolsPath = path.join(HOOKS_DIR, "forge-tools.js");
  try {
    const stdout = execFileSync(process.execPath, [toolsPath, command, ...args], {
      encoding: "utf8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    try { return JSON.parse(stdout.trim()); }
    catch { return { raw: stdout.trim() }; }
  } catch (err) {
    return {
      error: true,
      exitCode: err.status || 1,
      stdout: err.stdout || "",
      stderr: err.stderr || "",
    };
  }
}

module.exports = {
  HOOKS_DIR,
  TEMPLATES_DIR,
  createTempForge,
  mockPipelineState,
  runHook,
  runForgeTools,
};
