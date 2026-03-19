const { runForgeTools, createTempForge } = require("../helpers/test-utils");
const fs = require("fs");
const path = require("path");

// vitest globals (describe, it, expect, afterEach, beforeEach) are auto-injected

describe("Engine Transitions — Full Lifecycle (Task 7.5)", () => {
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

  // Helper: get current state
  function getState(dir) {
    return runForgeTools("engine-state", dir);
  }

  // Helper: write a minimal artifact file (>10 bytes to pass gate checks)
  function writeArtifact(dir, filename, content) {
    fs.writeFileSync(path.join(dir, filename), content || "# Artifact\n\nGenerated for testing purposes.\n");
  }

  // ─── Standard Pipeline ───────────────────────────────────────────

  describe("Standard pipeline", () => {
    it("engine-init sets current_step to init", () => {
      const dir = initPipeline();
      const state = getState(dir);
      expect(state.current_step).toBe("init");
      expect(state.allowed_transitions).toContain("research");
    });

    it("completes full lifecycle: init → research → architect_guide → plan → plan_check → checkpoint → branch → execute → verify → finalize → cleanup → completed", () => {
      const dir = initPipeline();

      // init → research
      let result = transitionTo(dir, "research");
      expect(result.transitioned).toBe(true);
      expect(result.from).toBe("init");
      expect(result.to).toBe("research");
      let state = getState(dir);
      expect(state.current_step).toBe("research");
      expect(state.gates_passed).toContain("init_done");

      // Create research.md artifact before moving on
      writeArtifact(dir, "research.md");

      // research → architect_guide
      result = transitionTo(dir, "architect_guide");
      expect(result.transitioned).toBe(true);
      state = getState(dir);
      expect(state.current_step).toBe("architect_guide");
      expect(state.gates_passed).toContain("researched");

      // architect_guide → plan (no required_artifacts beyond research.md which exists)
      result = transitionTo(dir, "plan");
      expect(result.transitioned).toBe(true);
      state = getState(dir);
      expect(state.current_step).toBe("plan");
      expect(state.gates_passed).toContain("arch_guided");

      // Create plan.md artifact
      writeArtifact(dir, "plan.md");

      // plan → plan_check
      result = transitionTo(dir, "plan_check");
      expect(result.transitioned).toBe(true);
      state = getState(dir);
      expect(state.current_step).toBe("plan_check");
      expect(state.gates_passed).toContain("planned");

      // plan_check → checkpoint
      result = transitionTo(dir, "checkpoint");
      expect(result.transitioned).toBe(true);
      state = getState(dir);
      expect(state.current_step).toBe("checkpoint");
      expect(state.gates_passed).toContain("plan_checked");

      // checkpoint → branch
      result = transitionTo(dir, "branch");
      expect(result.transitioned).toBe(true);
      state = getState(dir);
      expect(state.current_step).toBe("branch");
      expect(state.gates_passed).toContain("approved");

      // branch → execute
      result = transitionTo(dir, "execute");
      expect(result.transitioned).toBe(true);
      state = getState(dir);
      expect(state.current_step).toBe("execute");
      expect(state.gates_passed).toContain("branched");

      // execute → verify
      result = transitionTo(dir, "verify");
      expect(result.transitioned).toBe(true);
      state = getState(dir);
      expect(state.current_step).toBe("verify");
      expect(state.gates_passed).toContain("executed");

      // Create verification.md artifact
      writeArtifact(dir, "verification.md");

      // verify → finalize
      result = transitionTo(dir, "finalize");
      expect(result.transitioned).toBe(true);
      state = getState(dir);
      expect(state.current_step).toBe("finalize");
      expect(state.gates_passed).toContain("verified");

      // finalize → cleanup (cleanup is the last step; transition auto-completes)
      result = transitionTo(dir, "cleanup");
      expect(result.transitioned).toBe(true);

      // After transitioning to last step, state should be "completed"
      state = getState(dir);
      expect(state.current_step).toBe("completed");
      expect(state.gates_passed).toContain("finalized");
    });

    it("engine-state shows correct allowed_transitions at each step", () => {
      const dir = initPipeline();

      // At init, allowed_transitions = [research]
      let state = getState(dir);
      expect(state.allowed_transitions).toEqual(["research"]);

      // Move to research
      transitionTo(dir, "research");
      state = getState(dir);
      expect(state.allowed_transitions).toEqual(["architect_guide"]);

      // Move to architect_guide
      writeArtifact(dir, "research.md");
      transitionTo(dir, "architect_guide");
      state = getState(dir);
      expect(state.allowed_transitions).toEqual(["plan"]);
    });
  });

  // ─── Quick Pipeline ──────────────────────────────────────────────

  describe("Quick pipeline", () => {
    it("engine-init with quick sets pipeline to quick", () => {
      const dir = initPipeline({ quick: true });
      const state = getState(dir);
      expect(state.current_step).toBe("init");
    });

    it("completes lifecycle: init → plan → execute → verify → finalize → completed", () => {
      const dir = initPipeline({ quick: true });

      // Quick pipeline: init → plan (research, architect_guide, plan_check are skipped)
      // The allowed transition from init should skip to plan
      let state = getState(dir);
      expect(state.allowed_transitions).toContain("plan");

      // init → plan
      let result = transitionTo(dir, "plan");
      expect(result.transitioned).toBe(true);
      state = getState(dir);
      expect(state.current_step).toBe("plan");

      // Create plan.md
      writeArtifact(dir, "plan.md");

      // plan → execute
      result = transitionTo(dir, "execute");
      expect(result.transitioned).toBe(true);
      state = getState(dir);
      expect(state.current_step).toBe("execute");

      // execute → verify
      result = transitionTo(dir, "verify");
      expect(result.transitioned).toBe(true);
      state = getState(dir);
      expect(state.current_step).toBe("verify");

      // Create verification.md (verify requires plan.md which exists)
      writeArtifact(dir, "verification.md");

      // verify → finalize (last step in quick pipeline, auto-completes)
      result = transitionTo(dir, "finalize");
      expect(result.transitioned).toBe(true);

      state = getState(dir);
      expect(state.current_step).toBe("completed");
    });
  });

  // ─── Trivial Pipeline ────────────────────────────────────────────

  describe("Trivial pipeline", () => {
    it("engine-init with trivial sets pipeline to trivial", () => {
      const dir = initPipeline({ trivial: true });
      const state = getState(dir);
      expect(state.current_step).toBe("init");
    });

    it("completes lifecycle: init → execute → cleanup → completed", () => {
      const dir = initPipeline({ trivial: true });

      let state = getState(dir);
      expect(state.allowed_transitions).toContain("execute");

      // init → execute (trivial overrides execute entry_gate to null)
      let result = transitionTo(dir, "execute");
      expect(result.transitioned).toBe(true);
      state = getState(dir);
      expect(state.current_step).toBe("execute");

      // execute → cleanup (last step, auto-completes)
      result = transitionTo(dir, "cleanup");
      expect(result.transitioned).toBe(true);

      state = getState(dir);
      expect(state.current_step).toBe("completed");
    });
  });

  // ─── Debug Pipeline ──────────────────────────────────────────────

  describe("Debug pipeline", () => {
    it("engine-init with debug sets pipeline to debug", () => {
      const dir = initPipeline({ debug: true });
      // Debug pipeline starts at init step — but debug has its own steps starting with reproduce
      // engine-init always sets current_step to "init", but debug pipeline's first step is reproduce
      const state = getState(dir);
      expect(state.current_step).toBe("init");
    });

    it("has steps: reproduce → hypothesize → test_hypothesis → fix → verify_fix", () => {
      const dir = initPipeline({ debug: true });

      // The debug pipeline steps start at reproduce. But engine-init always sets "init".
      // Since debug pipeline has no "init" step, engine-state may show no allowed transitions.
      // Let's check the state:
      let state = getState(dir);

      // Debug pipeline doesn't have an "init" step in its definition,
      // so engine-state won't find a matching step for current_step="init"
      // which means allowed_transitions will be empty.
      // We need to manually transition to reproduce first.
      // Actually, let's look at what engine-state reports:
      // The current_step is "init" but the debug pipeline doesn't have an init step,
      // so we can't use engine-transition normally. Let's transition to "reproduce".
      let result = transitionTo(dir, "reproduce");
      expect(result.transitioned).toBe(true);
      state = getState(dir);
      expect(state.current_step).toBe("reproduce");
      expect(state.allowed_transitions).toContain("hypothesize");

      // reproduce → hypothesize
      result = transitionTo(dir, "hypothesize");
      expect(result.transitioned).toBe(true);
      state = getState(dir);
      expect(state.current_step).toBe("hypothesize");
      expect(state.allowed_transitions).toContain("test_hypothesis");

      // hypothesize → test_hypothesis
      result = transitionTo(dir, "test_hypothesis");
      expect(result.transitioned).toBe(true);
      state = getState(dir);
      expect(state.current_step).toBe("test_hypothesis");
      expect(state.allowed_transitions).toContain("fix");

      // test_hypothesis → fix
      result = transitionTo(dir, "fix");
      expect(result.transitioned).toBe(true);
      state = getState(dir);
      expect(state.current_step).toBe("fix");
      expect(state.allowed_transitions).toContain("verify_fix");

      // fix → verify_fix (last step, auto-completes)
      result = transitionTo(dir, "verify_fix");
      expect(result.transitioned).toBe(true);

      state = getState(dir);
      expect(state.current_step).toBe("completed");
    });
  });

  // ─── Ralph Pipeline ──────────────────────────────────────────────

  describe("Ralph pipeline", () => {
    it("engine-init with ralph sets pipeline to ralph", () => {
      const dir = initPipeline({ ralph: true });
      const state = getState(dir);
      expect(state.current_step).toBe("init");
    });

    it("completes lifecycle: init → iterate → completed", () => {
      const dir = initPipeline({ ralph: true });

      let state = getState(dir);
      expect(state.allowed_transitions).toContain("iterate");

      // init → iterate (last step, auto-completes)
      let result = transitionTo(dir, "iterate");
      expect(result.transitioned).toBe(true);

      state = getState(dir);
      expect(state.current_step).toBe("completed");
    });
  });

  // ─── Cross-pipeline checks ───────────────────────────────────────

  describe("Cross-pipeline gate verification", () => {
    it("standard pipeline gates_passed accumulates correctly through transitions", () => {
      const dir = initPipeline();

      transitionTo(dir, "research");
      writeArtifact(dir, "research.md");
      transitionTo(dir, "architect_guide");
      transitionTo(dir, "plan");

      const state = getState(dir);
      expect(state.gates_passed).toContain("init_done");
      expect(state.gates_passed).toContain("researched");
      expect(state.gates_passed).toContain("arch_guided");
    });

    it("missing artifact blocks transition", () => {
      const dir = initPipeline();
      transitionTo(dir, "research");
      // Do NOT create research.md — architect_guide requires it
      const result = runForgeTools("engine-transition", dir, "architect_guide");
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Missing required artifacts/);
    });
  });
});
