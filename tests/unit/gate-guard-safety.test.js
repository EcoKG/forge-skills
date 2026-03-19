/**
 * Task 7.2 — Gate Guard Safety Tests (Gates 5, 5T, 6)
 *
 * Gate 5:  Large change warning (>500 chars edit)
 * Gate 5T: Trivial pipeline line limit (max 3 lines)
 * Gate 6:  Secret/credential detection
 */

const { runHook, createTempForge, mockPipelineState } = require("../helpers/test-utils");
const path = require("path");

// Build secret strings dynamically to avoid triggering Gate 6 on THIS file
function buildSecret(parts) {
  return parts.join("");
}

describe("Gate Guard — Safety Gates (5, 5T, 6)", () => {
  let tempForge;

  afterEach(() => {
    if (tempForge) {
      tempForge.cleanup();
      tempForge = null;
    }
  });

  // ─── Gate 5: Large change warning ──────────────────────────────────

  describe("Gate 5: large change warning", () => {
    it("WARNING (exit 0): Edit with old_string > 500 chars emits warning on stdout", () => {
      const state = mockPipelineState({ current_step: "execute" });
      tempForge = createTempForge(state);

      const bigOldString = "x".repeat(501);
      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: "/tmp/src/big-file.js",
          old_string: bigOldString,
          new_string: "replaced",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("WARNING");
    });

    it("NO WARNING: Edit with old_string < 500 chars", () => {
      const state = mockPipelineState({ current_step: "execute" });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: "/tmp/src/small-file.js",
          old_string: "const a = 1",
          new_string: "const a = 2",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toContain("WARNING");
    });
  });

  // ─── Gate 5T: Trivial pipeline line limit ──────────────────────────

  describe("Gate 5T: trivial pipeline line limit", () => {
    it("BLOCK: Edit with >3 lines in trivial pipeline", () => {
      const state = mockPipelineState({
        pipeline: "trivial",
        current_step: "execute",
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: "/tmp/src/app.js",
          old_string: "line1",
          new_string: "line1\nline2\nline3\nline4",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 5T BLOCKED");
      expect(result.stderr).toContain("3 lines");
    });

    it("ALLOW: Edit with exactly 3 lines in trivial pipeline", () => {
      const state = mockPipelineState({
        pipeline: "trivial",
        current_step: "execute",
      });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: "/tmp/src/app.js",
          old_string: "line1\nline2\nline3",
          new_string: "a\nb\nc",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(0);
    });
  });

  // ─── Gate 6: Secret/credential detection ───────────────────────────

  describe("Gate 6: secret detection", () => {
    it("BLOCK: Edit containing AWS access key (AKIA + 16 chars)", () => {
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
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });

    it("BLOCK: Edit containing GitHub token (ghp_ + 36 chars)", () => {
      const state = mockPipelineState({ current_step: "execute" });
      tempForge = createTempForge(state);

      const ghToken = buildSecret(["gh", "p_", "A".repeat(36)]);
      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: "/tmp/src/config.js",
          old_string: "const token = ''",
          new_string: "const token = '" + ghToken + "'",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });

    it("BLOCK: Write to .env file (sensitive file)", () => {
      const state = mockPipelineState({ current_step: "execute" });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Write",
        tool_input: {
          file_path: "/tmp/project/.env",
          content: "NODE_ENV=production",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
      expect(result.stderr).toContain(".env");
    });

    it("ALLOW: Write to .env.example (safe template)", () => {
      const state = mockPipelineState({ current_step: "execute" });
      tempForge = createTempForge(state);

      const result = runHook("forge-gate-guard.js", {
        tool_name: "Write",
        tool_input: {
          file_path: "/tmp/project/.env.example",
          content: "NODE_ENV=\nDB_HOST=\n",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(0);
    });

    it("BLOCK: Bash command containing API key pattern", () => {
      const state = mockPipelineState({ current_step: "execute" });
      tempForge = createTempForge(state);

      const apiKey = buildSecret(["sk-", "abcdefghijklmnopqrstuvwxyz1234567890"]);
      const result = runHook("forge-gate-guard.js", {
        tool_name: "Bash",
        tool_input: {
          command: "curl -H 'X-Api-Key: " + apiKey + "' https://api.example.com",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });

    it("BLOCK: Edit with JWT token (eyJ...)", () => {
      const state = mockPipelineState({ current_step: "execute" });
      tempForge = createTempForge(state);

      const jwtHeader = buildSecret(["eyJ", "hbGciOiJIUzI1NiJ9"]);
      const jwtPayload = buildSecret([".eyJ", "zdWIiOiIxMjM0NTY3ODkwIn0"]);
      const jwt = jwtHeader + jwtPayload;
      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: "/tmp/src/auth.js",
          old_string: "const token = ''",
          new_string: "const token = '" + jwt + "'",
        },
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });
  });
});
