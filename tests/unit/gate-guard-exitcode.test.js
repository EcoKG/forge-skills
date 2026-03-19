/**
 * Task 7.4 — Gate Guard Exit Code Tests
 *
 * Verify ALL blocking paths use exit(2).
 * Verify non-blocking paths use exit(0).
 */

const { runHook, createTempForge, mockPipelineState } = require("../helpers/test-utils");
const fs = require("fs");
const path = require("path");

// Build secret strings dynamically to avoid triggering Gate 6 on THIS file
function buildSecret(parts) {
  return parts.join("");
}

describe("Gate Guard — Exit Codes", () => {
  let tempForge;

  afterEach(() => {
    if (tempForge) {
      tempForge.cleanup();
      tempForge = null;
    }
  });

  describe("All blocking paths exit with code 2", () => {
    it("No pipeline + code edit → exit(2)", () => {
      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: { file_path: "/tmp/app.js", old_string: "a", new_string: "b" },
        cwd: "/tmp/nonexistent-forge-dir",
      });
      expect(result.exitCode).toBe(2);
    });

    it("Gate 1 block (no research.md) → exit(2)", () => {
      const state = mockPipelineState({ current_step: "plan" });
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
    });

    it("Gate 2 block (code edit before execute) → exit(2)", () => {
      const state = mockPipelineState({ current_step: "research", current_step_order: 2 });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: { file_path: "/tmp/src/index.ts", old_string: "a", new_string: "b" },
        cwd: tempForge.dir,
      });
      expect(result.exitCode).toBe(2);
    });

    it("Gate 3 block (build fail + commit) → exit(2)", () => {
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
    });

    it("Gate 4 block (no verification.md) → exit(2)", () => {
      const state = mockPipelineState({ current_step: "finalize" });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Write",
        tool_input: {
          file_path: path.join(tempForge.artifactDir, "report.md"),
          content: "# Report",
        },
        cwd: tempForge.dir,
      });
      expect(result.exitCode).toBe(2);
    });

    it("Gate 5T block (trivial >3 lines) → exit(2)", () => {
      const state = mockPipelineState({
        pipeline: "trivial",
        current_step: "execute",
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: "/tmp/src/app.js",
          old_string: "a",
          new_string: "line1\nline2\nline3\nline4\nline5",
        },
        cwd: tempForge.dir,
      });
      expect(result.exitCode).toBe(2);
    });

    it("Gate 6 block (secret in content) → exit(2)", () => {
      const state = mockPipelineState({ current_step: "execute" });
      tempForge = createTempForge(state);

      const awsKey = buildSecret(["AKI", "AIOSFODNN7", "EXAMPLE"]);
      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: "/tmp/src/config.js",
          old_string: "const key = ''",
          new_string: "const key = '" + awsKey + "'",
        },
        cwd: tempForge.dir,
      });
      expect(result.exitCode).toBe(2);
    });

    it("Gate 7 block (push without verification) → exit(2)", () => {
      const state = mockPipelineState({
        current_step: "execute",
        gates_passed: ["init_done"],
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Bash",
        tool_input: { command: "git push origin main" },
        cwd: tempForge.dir,
      });
      expect(result.exitCode).toBe(2);
    });

    it("Malformed JSON → exit(2)", () => {
      const result = runHook("forge-gate-guard.js", "{this is not valid json}");
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("parse error");
    });
  });

  describe("Non-blocking paths exit with code 0", () => {
    it("Empty stdin → exit(0)", () => {
      const result = runHook("forge-gate-guard.js", "");
      expect(result.exitCode).toBe(0);
    });

    it("Unchecked tool (Read) → exit(0)", () => {
      const result = runHook("forge-gate-guard.js", {
        tool_name: "Read",
        tool_input: { file_path: "/tmp/test.txt" },
      });
      expect(result.exitCode).toBe(0);
    });
  });
});
