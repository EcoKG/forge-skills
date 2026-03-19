/**
 * Task 8.1 — Gate Guard Full Pipeline Integration Tests
 *
 * Full stdin -> exit code -> stderr pipeline integration tests.
 * Uses REAL temp .forge directories via createTempForge.
 */

const { runHook, createTempForge, mockPipelineState } = require("../helpers/test-utils");
const fs = require("fs");
const path = require("path");

describe("Gate Guard — Full Pipeline Integration", () => {
  let tempForge;

  afterEach(() => {
    if (tempForge) {
      tempForge.cleanup();
      tempForge = null;
    }
  });

  // ─── Scenario 1: Gate 2 — code edit blocked at init step ───────────
  describe("Gate 2: code edit blocked before execute step", () => {
    it("BLOCK: Edit .js file at 'init' step → exit(2)", () => {
      const state = mockPipelineState({
        current_step: "init",
        current_step_order: 1,
        gates_passed: [],
        gates_pending: ["init_done", "researched", "planned", "executed"],
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: "/tmp/src/app.js",
          old_string: "const x = 1",
          new_string: "const x = 2",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 2 BLOCKED");
    });
  });

  // ─── Scenario 2: code edit allowed at execute step ─────────────────
  describe("Gate 2: code edit allowed at execute step", () => {
    it("ALLOW: Edit .js file at 'execute' step → exit(0)", () => {
      const state = mockPipelineState({
        current_step: "execute",
        current_step_order: 8,
        gates_passed: ["init_done", "researched", "arch_guided", "planned", "plan_checked", "approved", "branched"],
        gates_pending: ["executed"],
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: "/tmp/src/app.js",
          old_string: "const x = 1",
          new_string: "const x = 2",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(0);
    });
  });

  // ─── Scenario 3: Gate 1 — plan.md blocked without research.md ──────
  describe("Gate 1: plan.md blocked without research.md", () => {
    it("BLOCK: Write plan.md with no research.md → exit(2)", () => {
      const state = mockPipelineState({
        current_step: "plan",
        current_step_order: 4,
        gates_passed: ["init_done"],
        gates_pending: ["planned"],
        skipped_steps: [],
      });
      tempForge = createTempForge(state);

      // No research.md exists in the artifact dir
      const result = runHook("forge-gate-guard.js", {
        tool_name: "Write",
        tool_input: {
          file_path: path.join(tempForge.artifactDir, "plan.md"),
          content: "# Implementation Plan\n\nSome plan content here.",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 1 BLOCKED");
    });
  });

  // ─── Scenario 4: Gate 1 — plan.md allowed with research.md ─────────
  describe("Gate 1: plan.md allowed when research.md exists", () => {
    it("ALLOW: Write plan.md with research.md present → exit(0)", () => {
      const state = mockPipelineState({
        current_step: "plan",
        current_step_order: 4,
        gates_passed: ["init_done", "researched"],
        gates_pending: ["planned"],
      });
      tempForge = createTempForge(state);

      // Create a research.md with real content (>10 bytes to pass artifactExists check)
      fs.writeFileSync(
        path.join(tempForge.artifactDir, "research.md"),
        "# Research\n\nFindings about the codebase and approach.\nThis has sufficient content."
      );

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Write",
        tool_input: {
          file_path: path.join(tempForge.artifactDir, "plan.md"),
          content: "# Plan\n\nDetailed implementation plan.",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(0);
    });
  });

  // ─── Scenario 5: Gate 3 — git commit blocked with build fail ───────
  describe("Gate 3: git commit blocked when last_build_result='fail'", () => {
    it("BLOCK: Bash git commit with failed build → exit(2)", () => {
      const state = mockPipelineState({
        current_step: "execute",
        current_step_order: 8,
        last_build_result: "fail",
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Bash",
        tool_input: { command: "git commit -m 'add feature'" },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 3 BLOCKED");
    });
  });

  // ─── Scenario 6: Gate 3 — git commit allowed with null build ───────
  describe("Gate 3: git commit allowed when last_build_result is null", () => {
    it("ALLOW: Bash git commit with null build result → exit(0)", () => {
      const state = mockPipelineState({
        current_step: "execute",
        current_step_order: 8,
        last_build_result: null,
        last_test_result: null,
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Bash",
        tool_input: { command: "git commit -m 'initial implementation'" },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(0);
    });
  });

  // ─── Scenario 7: stderr contains "GATE" keyword on all blocks ──────
  describe("stderr contains GATE keyword on all blocks", () => {
    it("Gate 1 block stderr contains GATE", () => {
      const state = mockPipelineState({
        current_step: "plan",
        current_step_order: 4,
        skipped_steps: [],
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Write",
        tool_input: {
          file_path: path.join(tempForge.artifactDir, "plan.md"),
          content: "# Plan",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE");
    });

    it("Gate 2 block stderr contains GATE", () => {
      const state = mockPipelineState({
        current_step: "research",
        current_step_order: 2,
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: "/tmp/src/index.ts",
          old_string: "old",
          new_string: "new",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE");
    });

    it("Gate 3 block stderr contains GATE", () => {
      const state = mockPipelineState({
        current_step: "execute",
        last_build_result: "fail",
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Bash",
        tool_input: { command: "git commit -m 'broken'" },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE");
    });
  });

  // ─── Scenario 8: stdout is empty on all blocks ─────────────────────
  describe("stdout is empty on all block scenarios", () => {
    it("Gate 1 block has empty stdout", () => {
      const state = mockPipelineState({
        current_step: "plan",
        current_step_order: 4,
        skipped_steps: [],
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Write",
        tool_input: {
          file_path: path.join(tempForge.artifactDir, "plan.md"),
          content: "# Plan",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
    });

    it("Gate 2 block has empty stdout", () => {
      const state = mockPipelineState({
        current_step: "init",
        current_step_order: 1,
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: "/tmp/src/app.js",
          old_string: "a",
          new_string: "b",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
    });

    it("Gate 3 block has empty stdout", () => {
      const state = mockPipelineState({
        current_step: "execute",
        last_build_result: "fail",
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Bash",
        tool_input: { command: "git commit -m 'test'" },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
    });
  });
});
