/**
 * Task 8.5 — State Tamper Tests
 *
 * Tests whether gate-guard prevents direct modification of .forge/ files.
 *
 * Key finding: .forge/ is in SKIP_PATHS, so isCodeFile() returns false
 * for any path containing ".forge/". This means Write/Edit tools targeting
 * .forge/ internal files are ALLOWED through Gate 2 (which only blocks
 * code file edits before execute step).
 *
 * This is a KNOWN GAP — an agent could tamper with pipeline-state.json
 * or meta.json to escalate its own permissions (e.g., changing
 * current_step to "execute" to bypass Gate 2).
 *
 * These tests document current behavior, not necessarily correct behavior.
 */

const { runHook, createTempForge, mockPipelineState } = require("../helpers/test-utils");
const path = require("path");

describe("State Tamper — .forge/ File Modification", () => {
  let tempForge;

  beforeEach(() => {
    const state = mockPipelineState({
      current_step: "plan",
      current_step_order: 5,
      gates_passed: ["init_done", "researched", "arch_guided"],
      gates_pending: ["planned", "plan_checked", "approved", "branched", "executed"],
    });
    tempForge = createTempForge(state);
  });

  afterEach(() => {
    if (tempForge) {
      tempForge.cleanup();
      tempForge = null;
    }
  });

  // ─── Document current behavior ───────────────────────────────────

  describe("Write tool targeting .forge/ paths", () => {
    it("1. Write to pipeline-state.json — ALLOWED (known gap)", () => {
      // TODO: This is a security gap. An agent can modify pipeline-state.json
      // to change current_step from "plan" to "execute", bypassing Gate 2.
      // .forge/ is in SKIP_PATHS → isCodeFile returns false → Gate 2 does not apply.
      const statePath = path.join(tempForge.artifactDir, "pipeline-state.json");
      const result = runHook("forge-gate-guard.js", {
        tool_name: "Write",
        tool_input: {
          file_path: statePath,
          content: JSON.stringify({
            current_step: "execute",
            current_step_order: 8,
          }),
        },
        cwd: tempForge.dir,
      });

      // Current behavior: ALLOWED (exit 0) because .forge/ is in SKIP_PATHS
      expect(result.exitCode).toBe(0);
    });

    it("2. Write to meta.json — ALLOWED (known gap)", () => {
      // TODO: Same gap as above. An agent could modify meta.json to
      // change task type, scale, or other metadata that affects pipeline behavior.
      const metaPath = path.join(tempForge.artifactDir, "meta.json");
      const result = runHook("forge-gate-guard.js", {
        tool_name: "Write",
        tool_input: {
          file_path: metaPath,
          content: JSON.stringify({
            request: "tampered",
            type: "code",
            scale: "trivial",
          }),
        },
        cwd: tempForge.dir,
      });

      // Current behavior: ALLOWED (exit 0)
      expect(result.exitCode).toBe(0);
    });

    it("3. Edit tool on .forge/ .json file — ALLOWED (known gap)", () => {
      // TODO: Edit tool also passes because isCodeFile returns false for .forge/ paths.
      // Even though .json is in CODE_EXTENSIONS, the SKIP_PATHS check comes first.
      const statePath = path.join(tempForge.artifactDir, "pipeline-state.json");
      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: statePath,
          old_string: '"current_step": "plan"',
          new_string: '"current_step": "execute"',
        },
        cwd: tempForge.dir,
      });

      // Current behavior: ALLOWED (exit 0) — .forge/ in SKIP_PATHS
      expect(result.exitCode).toBe(0);
    });
  });

  // ─── Contrast: code files ARE blocked at plan step ───────────────

  describe("Contrast: code file edits at plan step ARE blocked", () => {
    it("Edit to .js file at plan step — BLOCKED by Gate 2", () => {
      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: "/tmp/src/app.js",
          old_string: "const a = 1",
          new_string: "const a = 2",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 2 BLOCKED");
    });

    it("Write to .ts file at plan step — BLOCKED by Gate 2", () => {
      const result = runHook("forge-gate-guard.js", {
        tool_name: "Write",
        tool_input: {
          file_path: "/tmp/src/index.ts",
          content: "export const x = 1;",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 2 BLOCKED");
    });
  });
});
