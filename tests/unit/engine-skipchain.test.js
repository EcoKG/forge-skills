const { runForgeTools, createTempForge } = require("../helpers/test-utils");
const fs = require("fs");
const path = require("path");

// vitest globals (describe, it, expect, afterEach) are auto-injected

describe("Engine Skip Chain & Revision Logic (Task 7.6)", () => {
  let tempForge;

  afterEach(() => {
    if (tempForge) {
      tempForge.cleanup();
      tempForge = null;
    }
  });

  // Helper: init pipeline and return artifact dir
  function initPipeline(options = {}) {
    tempForge = createTempForge();
    const optJson = Object.keys(options).length > 0 ? JSON.stringify(options) : "{}";
    const result = runForgeTools("engine-init", tempForge.artifactDir, "test request", "code", "small", optJson);
    expect(result.initialized).toBe(true);
    return tempForge.artifactDir;
  }

  // Helper: transition and assert success
  function transitionTo(dir, step) {
    const result = runForgeTools("engine-transition", dir, step);
    expect(result.error).toBeUndefined();
    expect(result.allowed === false).toBe(false);
    return result;
  }

  function recordResult(dir, role, taskId, verdict) {
    return runForgeTools("engine-record-result", dir, role, taskId, verdict);
  }

  // Helper: get current state
  function getState(dir) {
    return runForgeTools("engine-state", dir);
  }

  // Helper: write artifact
  function writeArtifact(dir, filename, content) {
    fs.writeFileSync(path.join(dir, filename), content || "# Artifact\n\nGenerated for testing purposes.\n");
  }

  // Helper: read raw pipeline-state.json
  function readRawState(dir) {
    return JSON.parse(fs.readFileSync(path.join(dir, "pipeline-state.json"), "utf8"));
  }

  // ─── Skip Chain with direct option ──────────────────────────────

  describe("Skip chain with direct option", () => {
    it("init with direct=true skips research, architect_guide, plan_check", () => {
      const dir = initPipeline({ direct: true });
      const raw = readRawState(dir);
      expect(raw.skipped_steps).toContain("research");
      expect(raw.skipped_steps).toContain("architect_guide");
      expect(raw.skipped_steps).toContain("plan_check");
    });

    it("transition from init skips over research and architect_guide to plan", () => {
      const dir = initPipeline({ direct: true });

      // From init, the next step is "research" but it's skipped.
      // allowed_transitions should show plan (skipping research + architect_guide).
      let state = getState(dir);
      expect(state.allowed_transitions).toContain("plan");

      // Transitioning to plan should work (skip chain resolves through research → architect_guide → plan)
      const result = transitionTo(dir, "plan");
      expect(result.transitioned).toBe(true);
      state = getState(dir);
      expect(state.current_step).toBe("plan");
    });

    it("skipped steps' exit gates are auto-passed when transitioning through skipped step", () => {
      const dir = initPipeline({ direct: true });

      // Transition to "research" (the natural next step from init, which is skipped).
      // The engine walks the skip chain: research → architect_guide → plan,
      // recording exit gates for each skipped step along the way.
      transitionTo(dir, "research");

      const raw = readRawState(dir);
      expect(raw.current_step).toBe("plan");
      expect(raw.gates_passed).toContain("init_done");
      expect(raw.gates_passed).toContain("researched");
      expect(raw.gates_passed).toContain("arch_guided");
    });

    it("after plan, plan_check is also skipped; transitions to checkpoint via skip chain", () => {
      const dir = initPipeline({ direct: true });

      // Use skip chain: transition to "research" which auto-walks to plan
      transitionTo(dir, "research");
      writeArtifact(dir, "plan.md");

      // plan_check is skipped, allowed_transitions should show checkpoint
      let state = getState(dir);
      expect(state.allowed_transitions).toContain("checkpoint");

      // Transition to "plan_check" (skipped), engine walks to checkpoint and records gate
      const result = transitionTo(dir, "plan_check");
      expect(result.transitioned).toBe(true);
      state = getState(dir);
      expect(state.current_step).toBe("checkpoint");

      // plan_check gate should be auto-passed via skip chain
      const raw = readRawState(dir);
      expect(raw.gates_passed).toContain("planned");
      expect(raw.gates_passed).toContain("plan_checked");
    });
  });

  // ─── Revision Loop ──────────────────────────────────────────────

  describe("Revision loop recording", () => {
    it("engine-record-revision records scoped key for plan type", () => {
      const dir = initPipeline();

      // Advance to plan_check step
      transitionTo(dir, "research");
      writeArtifact(dir, "research.md");
      transitionTo(dir, "architect_guide");
      transitionTo(dir, "plan");
      writeArtifact(dir, "plan.md");
      transitionTo(dir, "plan_check");

      // Record a plan revision
      const result = runForgeTools("engine-record-revision", dir, "plan");
      expect(result.recorded).toBe(true);
      expect(result.count).toBe(1);

      // Verify scoped key exists in raw state
      const raw = readRawState(dir);
      expect(raw.revision_counts["plan_check:plan"]).toBe(1);
      // Backward-compat unscoped key too
      expect(raw.revision_counts["plan"]).toBeGreaterThanOrEqual(1);
    });

    it("multiple revisions increment the scoped counter", () => {
      const dir = initPipeline();

      transitionTo(dir, "research");
      writeArtifact(dir, "research.md");
      transitionTo(dir, "architect_guide");
      transitionTo(dir, "plan");
      writeArtifact(dir, "plan.md");
      transitionTo(dir, "plan_check");

      // Record multiple revisions
      runForgeTools("engine-record-revision", dir, "plan");
      const result = runForgeTools("engine-record-revision", dir, "plan");
      expect(result.recorded).toBe(true);
      expect(result.count).toBe(2);

      const raw = readRawState(dir);
      expect(raw.revision_counts["plan_check:plan"]).toBe(2);
    });
  });

  // ─── Backward Transition Rejection ──────────────────────────────

  describe("Backward transition rejection", () => {
    it("rejects backward transition from execute to research", () => {
      const dir = initPipeline();

      // Advance to execute step
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

      // Try backward transition to research
      const result = runForgeTools("engine-transition", dir, "research");
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Cannot go backward/);
    });

    it("rejects backward transition from verify to plan", () => {
      const dir = initPipeline();

      transitionTo(dir, "research");
      writeArtifact(dir, "research.md");
      transitionTo(dir, "architect_guide");
      transitionTo(dir, "plan");
      writeArtifact(dir, "plan.md");
      transitionTo(dir, "plan_check");
      transitionTo(dir, "checkpoint");
      transitionTo(dir, "branch");
      transitionTo(dir, "execute");
      recordResult(dir, "implementer", "task-1", "PASS");
      transitionTo(dir, "verify");

      const result = runForgeTools("engine-transition", dir, "plan");
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Cannot go backward/);
    });

    it("engine-can-transition also rejects backward transitions", () => {
      const dir = initPipeline();

      transitionTo(dir, "research");
      writeArtifact(dir, "research.md");
      transitionTo(dir, "architect_guide");
      transitionTo(dir, "plan");
      writeArtifact(dir, "plan.md");
      transitionTo(dir, "plan_check");
      transitionTo(dir, "checkpoint");
      transitionTo(dir, "branch");
      transitionTo(dir, "execute");

      const canResult = runForgeTools("engine-can-transition", dir, "init");
      expect(canResult.allowed).toBe(false);
      expect(canResult.reason).toMatch(/Cannot go backward/);
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────

  describe("Edge cases", () => {
    it("transition to unknown step is rejected", () => {
      const dir = initPipeline();
      const result = runForgeTools("engine-transition", dir, "nonexistent_step");
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Unknown step/);
    });

    it("quick pipeline skips research, architect_guide, plan_check, checkpoint, branch", () => {
      const dir = initPipeline({ quick: true });
      const raw = readRawState(dir);
      expect(raw.skipped_steps).toContain("research");
      expect(raw.skipped_steps).toContain("architect_guide");
      expect(raw.skipped_steps).toContain("plan_check");
      // Quick pipeline uses only_steps so checkpoint and branch aren't even in the pipeline
    });
  });
});
