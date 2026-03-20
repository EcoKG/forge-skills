/**
 * Task 9.2 — Variant Pipelines E2E Tests
 *
 * E2E for quick, trivial, and debug pipelines with gate enforcement.
 * Each pipeline variant is tested from init to completed, verifying
 * both engine transitions and gate-guard behavior.
 */

const { runForgeTools, runHook, createTempForge } = require("../helpers/test-utils");
const fs = require("fs");
const path = require("path");

// vitest globals (describe, it, expect, afterEach) are auto-injected

describe("Variant Pipelines E2E — Quick, Trivial, Debug", () => {
  let tempForge;

  afterEach(() => {
    if (tempForge) {
      tempForge.cleanup();
      tempForge = null;
    }
  });

  // ── Shared Helpers ────────────────────────────────────────────────

  function initPipeline(options = {}) {
    tempForge = createTempForge();
    const optJson = JSON.stringify(options);
    const result = runForgeTools(
      "engine-init", tempForge.artifactDir,
      "test request", "code", "small", optJson
    );
    expect(result.initialized).toBe(true);
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

  function recordResult(dir, role, taskId, verdict) {
    return runForgeTools("engine-record-result", dir, role, taskId, verdict);
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

  // ═══════════════════════════════════════════════════════════════════
  // QUICK PIPELINE E2E
  // ═══════════════════════════════════════════════════════════════════

  describe("Quick pipeline E2E", () => {
    it("completes full lifecycle: init -> plan -> execute -> verify -> finalize -> completed", () => {
      const dir = initPipeline({ quick: true });

      const raw = readRawState(dir);
      expect(raw.pipeline).toBe("quick");

      // ── init ──────────────────────────────────────────────
      let state = getState(dir);
      expect(state.current_step).toBe("init");
      // Quick pipeline only_steps: init, plan, execute, verify, finalize
      expect(state.allowed_transitions).toContain("plan");

      // ── init -> plan ──────────────────────────────────────
      transitionTo(dir, "plan");
      state = getState(dir);
      expect(state.current_step).toBe("plan");
      expect(state.gates_passed).toContain("init_done");

      // Create plan.md
      writeArtifact(dir, "plan.md", "# Plan\n\n## Tasks\n- Quick task 1\n");

      // ── plan -> execute ───────────────────────────────────
      transitionTo(dir, "execute");
      state = getState(dir);
      expect(state.current_step).toBe("execute");
      expect(state.gates_passed).toContain("planned");

      // Record task before leaving execute
      recordResult(dir, "implementer", "task-1", "PASS");

      // Record task before leaving execute
      recordResult(dir, "implementer", "task-1", "PASS");

      // ── execute -> verify ─────────────────────────────────
      transitionTo(dir, "verify");
      state = getState(dir);
      expect(state.current_step).toBe("verify");
      expect(state.gates_passed).toContain("executed");

      // Create verification.md
      writeArtifact(dir, "verification.md", "# Verification\n\nQuick check complete.\n");

      // ── verify -> finalize (last step, auto-completes) ────
      transitionTo(dir, "finalize");
      state = getState(dir);
      expect(state.current_step).toBe("completed");
      expect(state.gates_passed).toContain("verified");
    });

    it("gate-guard allows code edits at execute step in quick pipeline", () => {
      const dir = initPipeline({ quick: true });

      // Fast-forward to execute
      transitionTo(dir, "plan");
      writeArtifact(dir, "plan.md", "# Plan\n\n## Tasks\n- Task 1\n");
      transitionTo(dir, "execute");

      const state = getState(dir);
      expect(state.current_step).toBe("execute");

      // Gate-guard should ALLOW code edit at execute
      const gg = gateGuard("Edit", {
        file_path: "/tmp/src/handler.js",
        old_string: "return null",
        new_string: "return data",
      });
      expect(gg.exitCode).toBe(0);
    });

    it("gate-guard blocks code edits at plan step in quick pipeline", () => {
      const dir = initPipeline({ quick: true });

      // Transition to plan
      transitionTo(dir, "plan");
      const state = getState(dir);
      expect(state.current_step).toBe("plan");

      // Gate-guard should BLOCK code edit at plan step
      const gg = gateGuard("Edit", {
        file_path: "/tmp/src/handler.js",
        old_string: "return null",
        new_string: "return data",
      });
      expect(gg.exitCode).toBe(2);
      expect(gg.stderr).toContain("GATE 2 BLOCKED");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TRIVIAL PIPELINE E2E
  // ═══════════════════════════════════════════════════════════════════

  describe("Trivial pipeline E2E", () => {
    it("completes full lifecycle: init -> execute -> cleanup -> completed", () => {
      const dir = initPipeline({ trivial: true });

      const raw = readRawState(dir);
      expect(raw.pipeline).toBe("trivial");

      // ── init ──────────────────────────────────────────────
      let state = getState(dir);
      expect(state.current_step).toBe("init");
      expect(state.allowed_transitions).toContain("execute");

      // ── init -> execute ───────────────────────────────────
      transitionTo(dir, "execute");
      state = getState(dir);
      expect(state.current_step).toBe("execute");

      // Record task before leaving execute
      recordResult(dir, "implementer", "task-1", "PASS");

      // Record task before leaving execute
      recordResult(dir, "implementer", "task-1", "PASS");

      // ── execute -> cleanup (last step, auto-completes) ────
      transitionTo(dir, "cleanup");
      state = getState(dir);
      expect(state.current_step).toBe("completed");
    });

    it("Gate 5T blocks >3 line edits during trivial pipeline execute", () => {
      const dir = initPipeline({ trivial: true });

      // Advance to execute
      transitionTo(dir, "execute");
      const state = getState(dir);
      expect(state.current_step).toBe("execute");

      // Gate 5T: trivial pipeline limits edits to max 3 lines
      // An edit with >3 lines should be BLOCKED
      const gg = gateGuard("Edit", {
        file_path: "/tmp/src/config.js",
        old_string: "line1\nline2\nline3\nline4",
        new_string: "newline1\nnewline2\nnewline3\nnewline4",
      });
      expect(gg.exitCode).toBe(2);
      expect(gg.stderr).toContain("GATE 5T BLOCKED");
      expect(gg.stderr).toContain("3 lines");
    });

    it("Gate 5T allows <=3 line edits during trivial pipeline execute", () => {
      const dir = initPipeline({ trivial: true });

      // Advance to execute
      transitionTo(dir, "execute");

      // An edit with exactly 3 lines should be ALLOWED
      const gg = gateGuard("Edit", {
        file_path: "/tmp/src/config.js",
        old_string: "line1\nline2\nline3",
        new_string: "new1\nnew2\nnew3",
      });
      expect(gg.exitCode).toBe(0);
    });

    it("Gate 5T allows single-line edits during trivial pipeline execute", () => {
      const dir = initPipeline({ trivial: true });

      // Advance to execute
      transitionTo(dir, "execute");

      // Single-line edit should be fine
      const gg = gateGuard("Edit", {
        file_path: "/tmp/src/index.js",
        old_string: "const x = 1",
        new_string: "const x = 2",
      });
      expect(gg.exitCode).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DEBUG PIPELINE E2E
  // ═══════════════════════════════════════════════════════════════════

  describe("Debug pipeline E2E", () => {
    it("completes full lifecycle: reproduce -> hypothesize -> test_hypothesis -> fix -> verify_fix -> completed", () => {
      const dir = initPipeline({ debug: true });

      const raw = readRawState(dir);
      expect(raw.pipeline).toBe("debug");

      // ── init (engine always starts at init) ───────────────
      let state = getState(dir);
      expect(state.current_step).toBe("init");

      // ── init -> reproduce ─────────────────────────────────
      // Debug pipeline has no "init" step in its definition, but
      // engine-init sets current_step to "init". We transition to
      // the first debug step: reproduce.
      transitionTo(dir, "reproduce");
      state = getState(dir);
      expect(state.current_step).toBe("reproduce");
      expect(state.allowed_transitions).toContain("hypothesize");

      // ── reproduce -> hypothesize ──────────────────────────
      transitionTo(dir, "hypothesize");
      state = getState(dir);
      expect(state.current_step).toBe("hypothesize");
      expect(state.gates_passed).toContain("reproduced");
      expect(state.allowed_transitions).toContain("test_hypothesis");

      // ── hypothesize -> test_hypothesis ────────────────────
      transitionTo(dir, "test_hypothesis");
      state = getState(dir);
      expect(state.current_step).toBe("test_hypothesis");
      expect(state.gates_passed).toContain("hypothesized");
      expect(state.allowed_transitions).toContain("fix");

      // ── test_hypothesis -> fix ────────────────────────────
      transitionTo(dir, "fix");
      state = getState(dir);
      expect(state.current_step).toBe("fix");
      expect(state.gates_passed).toContain("hypothesis_tested");
      expect(state.allowed_transitions).toContain("verify_fix");

      // Record task before leaving fix
      recordResult(dir, "implementer", "fix-1", "PASS");

      // Record task before leaving fix
      recordResult(dir, "implementer", "fix-1", "PASS");

      // ── fix -> verify_fix (last step, auto-completes) ─────
      transitionTo(dir, "verify_fix");
      state = getState(dir);
      expect(state.current_step).toBe("completed");
      expect(state.gates_passed).toContain("fixed");
      expect(state.gates_passed).toContain("verified");
    });

    it("debug pipeline gates accumulate correctly", () => {
      const dir = initPipeline({ debug: true });

      transitionTo(dir, "reproduce");
      transitionTo(dir, "hypothesize");
      transitionTo(dir, "test_hypothesis");
      transitionTo(dir, "fix");
      recordResult(dir, "implementer", "fix-1", "PASS");
      transitionTo(dir, "verify_fix");

      const raw = readRawState(dir);
      expect(raw.current_step).toBe("completed");
      expect(raw.gates_pending).toEqual([]);

      const expectedGates = [
        "reproduced", "hypothesized", "hypothesis_tested", "fixed", "verified"
      ];
      for (const gate of expectedGates) {
        expect(raw.gates_passed).toContain(gate);
      }
    });

    it("debug pipeline rejects backward transitions", () => {
      const dir = initPipeline({ debug: true });

      transitionTo(dir, "reproduce");
      transitionTo(dir, "hypothesize");
      transitionTo(dir, "test_hypothesis");

      // Try to go backward to reproduce from test_hypothesis
      const result = runForgeTools("engine-transition", dir, "reproduce");
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Cannot go backward/);
    });
  });
});
