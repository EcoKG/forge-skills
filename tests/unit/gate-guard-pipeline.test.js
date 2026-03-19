/**
 * Task 7.3 — Gate Guard Pipeline Tests (Gate 7 + No-Pipeline)
 *
 * No-Pipeline: Block code edits, Bash file-writes, MCP execute without pipeline
 * Gate 7:     VPM verification before git push
 */

const { runHook, createTempForge, mockPipelineState } = require("../helpers/test-utils");
const fs = require("fs");
const path = require("path");

describe("Gate Guard — Pipeline Gates (No-Pipeline + Gate 7)", () => {
  let tempForge;

  afterEach(() => {
    if (tempForge) {
      tempForge.cleanup();
      tempForge = null;
    }
  });

  // ─── No-Pipeline gates ─────────────────────────────────────────────

  describe("No-Pipeline: block code changes without active pipeline", () => {
    it("BLOCK: Edit .js file with no active pipeline (exit 2)", () => {
      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: "/tmp/test.js",
          old_string: "a",
          new_string: "b",
        },
        cwd: "/tmp/nonexistent-forge-dir",
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("FORGE GATE BLOCKED");
    });

    it("BLOCK: Bash 'echo > test.js' with no active pipeline (exit 2)", () => {
      const result = runHook("forge-gate-guard.js", {
        tool_name: "Bash",
        tool_input: {
          command: "echo 'hello' > test.js",
        },
        cwd: "/tmp/nonexistent-forge-dir",
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("FORGE GATE BLOCKED");
    });

    it("BLOCK: MCP execute tool with no active pipeline (exit 2)", () => {
      const result = runHook("forge-gate-guard.js", {
        tool_name: "mcp__server_execute",
        tool_input: {
          code: "console.log('hello')",
        },
        cwd: "/tmp/nonexistent-forge-dir",
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("FORGE GATE BLOCKED");
    });

    it("ALLOW: Edit .md file with no active pipeline (not code)", () => {
      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: "/tmp/notes.md",
          old_string: "old text",
          new_string: "new text",
        },
        cwd: "/tmp/nonexistent-forge-dir",
      });

      // .md is not in CODE_EXTENSIONS, so should be allowed
      expect(result.exitCode).toBe(0);
    });

    it("ALLOW: Bash 'git status' with no active pipeline (safe command)", () => {
      const result = runHook("forge-gate-guard.js", {
        tool_name: "Bash",
        tool_input: {
          command: "git status",
        },
        cwd: "/tmp/nonexistent-forge-dir",
      });

      expect(result.exitCode).toBe(0);
    });

    it("BLOCK: Write .env without pipeline (sensitive file gate)", () => {
      const result = runHook("forge-gate-guard.js", {
        tool_name: "Write",
        tool_input: {
          file_path: "/tmp/project/.env",
          content: "KEY=value",
        },
        cwd: "/tmp/nonexistent-forge-dir",
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6");
      expect(result.stderr).toContain(".env");
    });
  });

  // ─── Gate 7: VPM → push ───────────────────────────────────────────

  describe("Gate 7: VPM verification before git push", () => {
    it("BLOCK: git push without 'verified' in gates_passed", () => {
      const state = mockPipelineState({
        current_step: "execute",
        gates_passed: ["init_done", "planned"],
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Bash",
        tool_input: { command: "git push origin main" },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 7 BLOCKED");
    });

    it("ALLOW: git push with 'verified' + valid verification.md", () => {
      const state = mockPipelineState({
        current_step: "finalize",
        gates_passed: ["init_done", "planned", "executed", "verified"],
      });
      tempForge = createTempForge(state);

      // Create verification.md with >200 bytes and "## Verdict" section
      const verificationContent =
        "# Verification Report\n\n" +
        "## Build\nBuild passed successfully.\n\n" +
        "## Tests\nAll 42 tests passed.\n\n" +
        "## Verdict\nAll checks passed. The implementation is correct and ready for merge.\n" +
        "No regressions detected. Coverage above threshold.\n";
      fs.writeFileSync(
        path.join(tempForge.artifactDir, "verification.md"),
        verificationContent
      );

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Bash",
        tool_input: { command: "git push origin main" },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(0);
    });

    it("ALLOW: git push with trivial pipeline (exempt)", () => {
      const state = mockPipelineState({
        pipeline: "trivial",
        current_step: "execute",
        gates_passed: ["init_done"],
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Bash",
        tool_input: { command: "git push origin main" },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(0);
    });

    it("ALLOW: git stash push (not a real push)", () => {
      const state = mockPipelineState({
        current_step: "execute",
        gates_passed: [],
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Bash",
        tool_input: { command: "git stash push -m 'save work'" },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(0);
    });
  });
});
