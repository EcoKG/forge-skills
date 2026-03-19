/**
 * Task 8.4 — Adversarial Bypass Attempts for Gate 2B (Bash file-writing detection)
 *
 * All tests use a tempForge with pipeline at "plan" step (before execute),
 * so Gate 2B should BLOCK any Bash command that writes to code files.
 *
 * Tests cover various bypass vectors: redirects, tee, sed -i, cp, curl -o,
 * python -c, node -e, and verifies safe commands pass through.
 */

const { runHook, createTempForge, mockPipelineState } = require("../helpers/test-utils");

describe("Gate 2B — Adversarial Bash File-Writing Bypass Attempts", () => {
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

  function bashCmd(command) {
    return runHook("forge-gate-guard.js", {
      tool_name: "Bash",
      tool_input: { command },
      cwd: tempForge.dir,
    });
  }

  // ─── Should be BLOCKED (exit 2) ──────────────────────────────────

  describe("Bypass attempts — should ALL be BLOCKED (exit 2)", () => {
    it("1. echo redirect: echo \"code\" > app.js", () => {
      const result = bashCmd('echo "code" > app.js');
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 2B BLOCKED");
    });

    it("2. printf redirect: printf \"code\" > app.js", () => {
      const result = bashCmd('printf "code" > app.js');
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 2B BLOCKED");
    });

    it("3. cat redirect: cat input.txt > app.js", () => {
      const result = bashCmd("cat input.txt > app.js");
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 2B BLOCKED");
    });

    it("4. tee command: tee app.js < input.txt", () => {
      const result = bashCmd("tee app.js < input.txt");
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 2B BLOCKED");
    });

    it("5. sed in-place: sed -i 's/old/new/' app.js", () => {
      const result = bashCmd("sed -i 's/old/new/' app.js");
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 2B BLOCKED");
    });

    it("6. cp to code file: cp template.js app.js", () => {
      const result = bashCmd("cp template.js app.js");
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 2B BLOCKED");
    });

    it("7. curl download: curl -o app.js http://example.com", () => {
      const result = bashCmd("curl -o app.js http://example.com");
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 2B BLOCKED");
    });

    it("8. python inline write: python3 -c \"open('app.js','w').write('x')\"", () => {
      const result = bashCmd("python3 -c \"open('app.js','w').write('x')\"");
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 2B BLOCKED");
    });

    it("9. node inline write: node -e \"require('fs').writeFileSync('app.js','x')\"", () => {
      const result = bashCmd("node -e \"require('fs').writeFileSync('app.js','x')\"");
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 2B BLOCKED");
    });
  });

  // ─── Should NOT be blocked (exit 0) ──────────────────────────────

  describe("Safe commands — should NOT be blocked (exit 0)", () => {
    it("10. git status — safe command", () => {
      const result = bashCmd("git status");
      expect(result.exitCode).toBe(0);
    });

    it("11. npm test — safe command", () => {
      const result = bashCmd("npm test");
      expect(result.exitCode).toBe(0);
    });

    it("12. echo without file target: echo \"hello\"", () => {
      const result = bashCmd('echo "hello"');
      expect(result.exitCode).toBe(0);
    });

    it("13. echo to non-code file: echo \"data\" > output.txt", () => {
      const result = bashCmd('echo "data" > output.txt');
      expect(result.exitCode).toBe(0);
    });
  });
});
