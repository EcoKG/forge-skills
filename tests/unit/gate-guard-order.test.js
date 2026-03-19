/**
 * Task 7.1 — Gate Guard Order Tests (Gates 1-4)
 *
 * Gate 1: research.md must exist before plan.md
 * Gate 2: plan_check PASS before source code edits
 * Gate 3: build/test must pass before git commit
 * Gate 4: verification must exist before report.md
 */

const { runHook, createTempForge, mockPipelineState } = require("../helpers/test-utils");
const fs = require("fs");
const path = require("path");

describe("Gate Guard — Order Gates (1-4)", () => {
  let tempForge;

  afterEach(() => {
    if (tempForge) {
      tempForge.cleanup();
      tempForge = null;
    }
  });

  // ─── Gate 1: research → plan ───────────────────────────────────────

  describe("Gate 1: research.md before plan.md", () => {
    it("BLOCK: Write plan.md when research.md does not exist", () => {
      const state = mockPipelineState({ current_step: "plan" });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Write",
        tool_input: {
          file_path: path.join(tempForge.artifactDir, "plan.md"),
          content: "# Plan\nSome plan content here",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 1 BLOCKED");
      expect(result.stderr).toContain("research.md");
    });

    it("ALLOW: Write plan.md when research.md exists", () => {
      const state = mockPipelineState({ current_step: "plan" });
      tempForge = createTempForge(state);

      // Create research.md with content > 10 bytes
      fs.writeFileSync(
        path.join(tempForge.artifactDir, "research.md"),
        "# Research\nThis is substantial research content for the test."
      );

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Write",
        tool_input: {
          file_path: path.join(tempForge.artifactDir, "plan.md"),
          content: "# Plan\nSome plan content here",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(0);
    });

    it("ALLOW: Write plan.md when research is in skipped_steps", () => {
      const state = mockPipelineState({
        current_step: "plan",
        skipped_steps: ["research"],
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Write",
        tool_input: {
          file_path: path.join(tempForge.artifactDir, "plan.md"),
          content: "# Plan\nDirect plan without research",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(0);
    });
  });

  // ─── Gate 2: plan_check → code edit ────────────────────────────────

  describe("Gate 2: plan_check before code edits", () => {
    it("BLOCK: Edit .js file when current_step is plan (before execute)", () => {
      const state = mockPipelineState({ current_step: "plan", current_step_order: 4 });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: "/tmp/src/index.js",
          old_string: "const a = 1",
          new_string: "const a = 2",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 2 BLOCKED");
      expect(result.stderr).toContain("plan");
    });

    it("ALLOW: Edit .js file when current_step is execute", () => {
      const state = mockPipelineState({ current_step: "execute", current_step_order: 8 });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: "/tmp/src/index.js",
          old_string: "const a = 1",
          new_string: "const a = 2",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(0);
    });

    it("ALLOW: Edit .forge/ files regardless of step (not code file)", () => {
      const state = mockPipelineState({ current_step: "plan", current_step_order: 4 });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: path.join(tempForge.forgeDir, "some-config.json"),
          old_string: '"a": 1',
          new_string: '"a": 2',
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(0);
    });
  });

  // ─── Gate 3: build/test → commit ───────────────────────────────────

  describe("Gate 3: build/test pass before git commit", () => {
    it("BLOCK: git commit when last_build_result is fail", () => {
      const state = mockPipelineState({
        current_step: "execute",
        last_build_result: "fail",
        last_test_result: null,
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Bash",
        tool_input: { command: "git commit -m 'test commit'" },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 3 BLOCKED");
      expect(result.stderr).toContain("build FAILED");
    });

    it("BLOCK: git commit when last_test_result is fail", () => {
      const state = mockPipelineState({
        current_step: "execute",
        last_build_result: "pass",
        last_test_result: "fail",
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Bash",
        tool_input: { command: "git commit -m 'test commit'" },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 3 BLOCKED");
      expect(result.stderr).toContain("test run FAILED");
    });

    it("ALLOW: git commit when both results are null", () => {
      const state = mockPipelineState({
        current_step: "execute",
        last_build_result: null,
        last_test_result: null,
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Bash",
        tool_input: { command: "git commit -m 'test commit'" },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(0);
    });

    it("ALLOW: git commit when both results are pass", () => {
      const state = mockPipelineState({
        current_step: "execute",
        last_build_result: "pass",
        last_test_result: "pass",
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Bash",
        tool_input: { command: "git commit -m 'test commit'" },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(0);
    });
  });

  // ─── Gate 4: verification → report ─────────────────────────────────

  describe("Gate 4: verification before report.md", () => {
    it("BLOCK: Write report.md when verification.md does not exist", () => {
      const state = mockPipelineState({ current_step: "finalize" });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Write",
        tool_input: {
          file_path: path.join(tempForge.artifactDir, "report.md"),
          content: "# Report\nFinal report content",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 4 BLOCKED");
      expect(result.stderr).toContain("verification.md");
    });

    it("ALLOW: Write report.md when verification.md exists", () => {
      const state = mockPipelineState({ current_step: "finalize" });
      tempForge = createTempForge(state);

      // Create verification.md with content > 10 bytes
      fs.writeFileSync(
        path.join(tempForge.artifactDir, "verification.md"),
        "# Verification\nAll tests passed. Build succeeded. Code reviewed."
      );

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Write",
        tool_input: {
          file_path: path.join(tempForge.artifactDir, "report.md"),
          content: "# Report\nFinal report content",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(0);
    });
  });
});
