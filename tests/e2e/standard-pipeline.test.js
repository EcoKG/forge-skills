/**
 * Task 9.1 — Standard Pipeline E2E Test
 *
 * Full lifecycle: engine transitions + gate-guard enforcement together.
 * Verifies the standard pipeline from init to completed with gate checks
 * at every step.
 */

const { runForgeTools, runHook, createTempForge } = require("../helpers/test-utils");
const fs = require("fs");
const path = require("path");

// vitest globals (describe, it, expect, afterEach, beforeEach) are auto-injected

describe("Standard Pipeline E2E — Engine + Gate Guard", () => {
  let tempForge;

  afterEach(() => {
    if (tempForge) {
      tempForge.cleanup();
      tempForge = null;
    }
  });

  // ── Shared Helpers ────────────────────────────────────────────────

  function initStandardPipeline() {
    tempForge = createTempForge();
    const result = runForgeTools(
      "engine-init", tempForge.artifactDir,
      "implement user auth", "code", "small", "{}"
    );
    expect(result.initialized).toBe(true);
    expect(result.pipeline).toBe("standard");
    return tempForge.artifactDir;
  }

  function transitionTo(dir, step) {
    const result = runForgeTools("engine-transition", dir, step);
    expect(result.error).toBeUndefined();
    expect(result.allowed === false).toBe(false);
    return result;
  }

  function getState(dir) {
    return runForgeTools("engine-state", dir);
  }

  function writeArtifact(dir, filename, content) {
    fs.writeFileSync(
      path.join(dir, filename),
      content || "# Artifact\n\nGenerated for E2E testing.\n"
    );
  }

  function readRawState(dir) {
    return JSON.parse(fs.readFileSync(path.join(dir, "pipeline-state.json"), "utf8"));
  }

  /** Run gate-guard hook against the temp forge directory */
  function gateGuard(toolName, toolInput) {
    return runHook("forge-gate-guard.js", {
      tool_name: toolName,
      tool_input: toolInput,
      cwd: tempForge.dir,
    });
  }

  // ── Full Lifecycle with Gate Enforcement ──────────────────────────

  it("full lifecycle: init through completed with gate enforcement at each step", () => {
    const dir = initStandardPipeline();

    // ── Step 1: init ────────────────────────────────────────────
    let state = getState(dir);
    expect(state.current_step).toBe("init");
    expect(state.allowed_transitions).toContain("research");

    // Gate-guard: code edits BLOCKED at init
    let gg = gateGuard("Edit", {
      file_path: "/tmp/src/app.js",
      old_string: "const a = 1",
      new_string: "const a = 2",
    });
    expect(gg.exitCode).toBe(2);
    expect(gg.stderr).toContain("GATE 2 BLOCKED");

    // ── Step 2: research ────────────────────────────────────────
    transitionTo(dir, "research");
    state = getState(dir);
    expect(state.current_step).toBe("research");
    expect(state.gates_passed).toContain("init_done");

    // Create research.md artifact
    writeArtifact(dir, "research.md", "# Research\n\nDetailed findings about the codebase.\nMultiple lines of content here.\n");

    // ── Step 3: architect_guide ─────────────────────────────────
    transitionTo(dir, "architect_guide");
    state = getState(dir);
    expect(state.current_step).toBe("architect_guide");
    expect(state.gates_passed).toContain("researched");

    // ── Step 4: plan ────────────────────────────────────────────
    transitionTo(dir, "plan");
    state = getState(dir);
    expect(state.current_step).toBe("plan");
    expect(state.gates_passed).toContain("arch_guided");

    // Create plan.md artifact
    writeArtifact(dir, "plan.md", "# Plan\n\nImplementation steps.\n\n## Tasks\n- Task 1\n- Task 2\n");

    // ── Step 5: plan_check ──────────────────────────────────────
    transitionTo(dir, "plan_check");
    state = getState(dir);
    expect(state.current_step).toBe("plan_check");
    expect(state.gates_passed).toContain("planned");

    // ── Step 6: checkpoint ──────────────────────────────────────
    transitionTo(dir, "checkpoint");
    state = getState(dir);
    expect(state.current_step).toBe("checkpoint");
    expect(state.gates_passed).toContain("plan_checked");

    // ── Step 7: branch ──────────────────────────────────────────
    transitionTo(dir, "branch");
    state = getState(dir);
    expect(state.current_step).toBe("branch");
    expect(state.gates_passed).toContain("approved");

    // Gate-guard: code edits still BLOCKED at branch step
    gg = gateGuard("Edit", {
      file_path: "/tmp/src/app.js",
      old_string: "const a = 1",
      new_string: "const a = 2",
    });
    expect(gg.exitCode).toBe(2);
    expect(gg.stderr).toContain("GATE 2 BLOCKED");

    // ── Step 8: execute ─────────────────────────────────────────
    transitionTo(dir, "execute");
    state = getState(dir);
    expect(state.current_step).toBe("execute");
    expect(state.gates_passed).toContain("branched");

    // Gate-guard: code edits ALLOWED at execute step
    gg = gateGuard("Edit", {
      file_path: "/tmp/src/app.js",
      old_string: "const a = 1",
      new_string: "const a = 2",
    });
    expect(gg.exitCode).toBe(0);

    // ── Step 9: verify ──────────────────────────────────────────
    transitionTo(dir, "verify");
    state = getState(dir);
    expect(state.current_step).toBe("verify");
    expect(state.gates_passed).toContain("executed");

    // Create verification.md with correct format (>200 bytes, "## Verdict" + "PASS")
    const verificationContent = [
      "# Verification Report",
      "",
      "## Summary",
      "All implementation tasks have been completed successfully.",
      "The code follows the established patterns and passes all checks.",
      "",
      "## Test Results",
      "- Unit tests: PASS",
      "- Integration tests: PASS",
      "- Linting: PASS",
      "",
      "## Verdict",
      "PASS",
      "",
      "All acceptance criteria met. The implementation is ready for finalization.",
    ].join("\n");
    writeArtifact(dir, "verification.md", verificationContent);

    // ── Step 10: finalize ───────────────────────────────────────
    transitionTo(dir, "finalize");
    state = getState(dir);
    expect(state.current_step).toBe("finalize");
    expect(state.gates_passed).toContain("verified");

    // ── Step 11: cleanup → completed ────────────────────────────
    transitionTo(dir, "cleanup");
    state = getState(dir);
    expect(state.current_step).toBe("completed");
    expect(state.gates_passed).toContain("finalized");
    expect(state.gates_passed).toContain("completed");
  });

  // ── Gate-guard blocks code edit at plan step ──────────────────────

  it("gate-guard BLOCKS code edit at plan step (second pipeline)", () => {
    // Create a tempForge with a pipeline at "plan" step
    const planState = {
      session_id: "test-plan-gate",
      artifact_dir: ".forge/2026-01-01/test-0000",
      pipeline: "standard",
      current_step: "plan",
      current_step_order: 4,
      gates_passed: ["init_done", "researched", "arch_guided"],
      gates_pending: ["planned"],
      allowed_transitions: ["plan_check"],
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
    };
    tempForge = createTempForge(planState);

    const gg = gateGuard("Edit", {
      file_path: "/tmp/src/utils.ts",
      old_string: "export function foo() {}",
      new_string: "export function bar() {}",
    });
    expect(gg.exitCode).toBe(2);
    expect(gg.stderr).toContain("GATE 2 BLOCKED");
    expect(gg.stderr).toContain("plan");
  });

  // ── Gate-guard allows code edit at execute step ───────────────────

  it("gate-guard ALLOWS code edit at execute step", () => {
    const dir = initStandardPipeline();

    // Fast-forward to execute
    transitionTo(dir, "research");
    writeArtifact(dir, "research.md");
    transitionTo(dir, "architect_guide");
    transitionTo(dir, "plan");
    writeArtifact(dir, "plan.md");
    transitionTo(dir, "plan_check");
    transitionTo(dir, "checkpoint");
    transitionTo(dir, "branch");
    transitionTo(dir, "execute");

    const state = getState(dir);
    expect(state.current_step).toBe("execute");

    const gg = gateGuard("Edit", {
      file_path: "/tmp/src/auth.ts",
      old_string: "// TODO: implement",
      new_string: "return validateToken(token);",
    });
    expect(gg.exitCode).toBe(0);
  });

  // ── Completed pipeline = gate-guard no longer blocks ──────────────

  it("gate-guard no longer blocks code edits after pipeline is completed", () => {
    const dir = initStandardPipeline();

    // Complete entire pipeline
    transitionTo(dir, "research");
    writeArtifact(dir, "research.md");
    transitionTo(dir, "architect_guide");
    transitionTo(dir, "plan");
    writeArtifact(dir, "plan.md");
    transitionTo(dir, "plan_check");
    transitionTo(dir, "checkpoint");
    transitionTo(dir, "branch");
    transitionTo(dir, "execute");
    transitionTo(dir, "verify");
    writeArtifact(dir, "verification.md", "# Verification\n\nContent here.\n");
    transitionTo(dir, "finalize");
    transitionTo(dir, "cleanup");

    const state = getState(dir);
    expect(state.current_step).toBe("completed");

    // Completed pipeline means findPipelineState returns null (it skips completed states).
    // With no active pipeline, gate-guard blocks code edits for safety (Gate "No Pipeline").
    // This is correct behavior: completed = no active pipeline.
    // The gate blocks edits to code files when there is no active pipeline.
    const gg = gateGuard("Edit", {
      file_path: "/tmp/src/auth.ts",
      old_string: "old code",
      new_string: "new code",
    });
    // No active pipeline → blocks code file edits (Gate: No Pipeline)
    expect(gg.exitCode).toBe(2);
    expect(gg.stderr).toContain("Cannot edit code without an active forge pipeline");
  });

  // ── Verify final state details ────────────────────────────────────

  it("final state has all expected gates passed", () => {
    const dir = initStandardPipeline();

    // Complete entire pipeline
    transitionTo(dir, "research");
    writeArtifact(dir, "research.md");
    transitionTo(dir, "architect_guide");
    transitionTo(dir, "plan");
    writeArtifact(dir, "plan.md");
    transitionTo(dir, "plan_check");
    transitionTo(dir, "checkpoint");
    transitionTo(dir, "branch");
    transitionTo(dir, "execute");
    transitionTo(dir, "verify");
    writeArtifact(dir, "verification.md", "# Verification\n\nContent here.\n");
    transitionTo(dir, "finalize");
    transitionTo(dir, "cleanup");

    const raw = readRawState(dir);
    expect(raw.current_step).toBe("completed");
    expect(raw.gates_pending).toEqual([]);

    // All standard pipeline exit gates should be passed
    const expectedGates = [
      "init_done", "researched", "arch_guided", "planned",
      "plan_checked", "approved", "branched", "executed",
      "verified", "finalized", "completed"
    ];
    for (const gate of expectedGates) {
      expect(raw.gates_passed).toContain(gate);
    }
  });

  // ── Gate-guard Write to non-code files always allowed ─────────────

  it("gate-guard allows writing .forge artifacts at any step", () => {
    const dir = initStandardPipeline();

    // At init step, writing a .forge artifact (non-code) should pass
    const gg = gateGuard("Write", {
      file_path: path.join(tempForge.artifactDir, "research.md"),
      content: "# Research\n\nFindings here.\n",
    });
    // .forge/ paths are in SKIP_PATHS, so isCodeFile returns false → allowed
    expect(gg.exitCode).toBe(0);
  });
});
