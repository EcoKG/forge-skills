/**
 * Task 7.8 — Secret Pattern Detection Tests (Gate 6)
 *
 * Tests that forge-gate-guard.js Gate 6 correctly detects (blocks)
 * hardcoded secrets in tool_input content, and allows safe content through.
 *
 * Uses runHook to invoke the real gate-guard with crafted Write tool_input
 * containing test content, with an active pipeline at execute step.
 *
 * All secret test strings are assembled at runtime from fragments
 * to avoid triggering Gate 6 on this test file itself.
 */

const { runHook, createTempForge, mockPipelineState } = require("../helpers/test-utils");
const path = require("path");

describe("Gate 6 — Secret Pattern Detection", () => {
  let tempForge;

  beforeEach(() => {
    const state = mockPipelineState({ current_step: "execute", current_step_order: 8 });
    tempForge = createTempForge(state);
  });

  afterEach(() => {
    if (tempForge) {
      tempForge.cleanup();
      tempForge = null;
    }
  });

  function writeWithContent(content) {
    return runHook("forge-gate-guard.js", {
      tool_name: "Write",
      tool_input: {
        file_path: path.join(tempForge.artifactDir, "test-output.txt"),
        content,
      },
      cwd: tempForge.dir,
    });
  }

  // Build a string from char codes
  function cc() {
    return Array.from(arguments).map(function (c) {
      return typeof c === "number" ? String.fromCharCode(c) : c;
    }).join("");
  }

  // ─── True Positives (should block — exit 2) ────────────────────────

  describe("True positives — should BLOCK (exit 2)", () => {
    it("AWS access key", () => {
      var secret = ["AKI", "AIOSF", "ODNN7", "EXAMPLE"].join("");
      var result = writeWithContent('const key = "' + secret + '";');
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });

    it("GitHub token", () => {
      var secret = ["ghp", "_ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmn"].join("");
      var result = writeWithContent('const token = "' + secret + '";');
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });

    it("OpenAI-style key", () => {
      // Pattern: /sk-[A-Za-z0-9]{20,}/ — needs 20+ alphanumeric chars after "sk-"
      var secret = ["sk", "-abcdefghijklmnopqrstuvwxyz"].join("");
      var result = writeWithContent('const key = "' + secret + '";');
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });

    it("Slack token", () => {
      var secret = ["xox", "b-123456789-abcdefghij"].join("");
      var result = writeWithContent('const token = "' + secret + '";');
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });

    it("Google API key", () => {
      // Pattern: /AIza[A-Za-z0-9_\-]{35}/ — needs exactly 35 chars after "AIza"
      var secret = ["AI", "zaSyA1234567890abcdefghijklmnopqrsWXYZ"].join("");
      var result = writeWithContent('const k = "' + secret + '";');
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });

    it("RSA key header", () => {
      var header = cc("-----BEGIN RSA ", 80, 82, 73, 86, 65, 84, 69, " KEY-----");
      var result = writeWithContent(header + "\nMIIE...");
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });

    it("Auth header with auth-scheme token", () => {
      // Build auth-scheme word + space + JWT-like value from char codes
      var prefix = cc(66, 101, 97, 114, 101, 114, 32);
      var token = ["eyJhb", "GciOiJIUzI1NiJ9", ".eyJ0ZXN0IjoiMSJ9"].join("");
      var result = writeWithContent("Authorization: " + prefix + token);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });

    it("Stripe live key", () => {
      var secret = ["sk_", "live_abcdefghijklmnopqrstuv"].join("");
      var result = writeWithContent('const sk = "' + secret + '";');
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });

    it("MongoDB URI with credentials", () => {
      var uri = ["mongo", "db://user", ":pass@host:27017/db"].join("");
      var result = writeWithContent('const uri = "' + uri + '";');
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });

    it("JWT token (base64 encoded)", () => {
      var p1 = ["eyJhb", "GciOiJIU", "zI1NiIsIn", "R5cCI6IkpXV", "CJ9"].join("");
      var p2 = ["eyJzd", "WIiOiIxMjM", "0NTY3ODkwIn0"].join("");
      var result = writeWithContent('const t = "' + p1 + "." + p2 + '";');
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });

    it("Cloudflare API token", () => {
      var secret = ["CF", "1234567890abcdefghijklmnopqrstuvwxyz12"].join("");
      var result = writeWithContent('const cf = "' + secret + '";');
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });

    it("JDBC connection string with credentials", () => {
      var uri = ["jd", "bc:mysql://user", ":password@host:3306/db"].join("");
      var result = writeWithContent('String url = "' + uri + '";');
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });
  });

  // ─── True Negatives (should NOT block — exit 0) ────────────────────

  describe("True negatives — should ALLOW (exit 0)", () => {
    it("normal code: const x = 42;", () => {
      var result = writeWithContent("const x = 42;\nconst y = x + 1;");
      expect(result.exitCode).toBe(0);
    });

    it("test placeholder with short value (< 16 chars)", () => {
      var result = writeWithContent("TOKEN=placeholder\nSESSION=abc123");
      expect(result.exitCode).toBe(0);
    });

    it("import statement with auth module", () => {
      var result = writeWithContent(
        'import { AuthHandler } from "auth";\nconst handler = new AuthHandler();'
      );
      expect(result.exitCode).toBe(0);
    });

    it("comment about authentication", () => {
      var result = writeWithContent(
        "// TODO: add authentication\n// Handle token validation later"
      );
      expect(result.exitCode).toBe(0);
    });

    it("empty content", () => {
      var result = writeWithContent("");
      expect(result.exitCode).toBe(0);
    });

    it("typical function code with no secrets", () => {
      var result = writeWithContent(
        'function getUser(id) {\n  return db.query("SELECT * FROM users WHERE id = ?", [id]);\n}'
      );
      expect(result.exitCode).toBe(0);
    });
  });

  // ─── Bash command scanning ─────────────────────────────────────────

  describe("Gate 6 — Bash command scanning", () => {
    it("BLOCK: Bash command containing AWS key", () => {
      var awsKey = ["AKI", "AIOSF", "ODNN7", "EXAMPLE"].join("");
      var result = runHook("forge-gate-guard.js", {
        tool_name: "Bash",
        tool_input: {
          command: "export MY_VAR=" + awsKey,
        },
        cwd: tempForge.dir,
      });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });

    it("ALLOW: Bash command with no secrets", () => {
      var result = runHook("forge-gate-guard.js", {
        tool_name: "Bash",
        tool_input: { command: "npm test" },
        cwd: tempForge.dir,
      });
      expect(result.exitCode).toBe(0);
    });
  });
});
