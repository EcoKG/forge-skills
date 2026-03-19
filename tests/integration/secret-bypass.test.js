/**
 * Task 8.7 — Advanced Secret Bypass Attempts for Gate 6
 *
 * Tests adversarial techniques to smuggle secrets past Gate 6's pattern detection.
 * All tests use a tempForge with pipeline at "execute" step.
 *
 * Categories:
 *   - Caught: bypass attempts that Gate 6 correctly detects and blocks
 *   - Known gaps: bypass techniques that currently evade detection
 *
 * All secret strings are assembled at runtime from fragments to avoid
 * triggering Gate 6 on this test file itself.
 */

const { runHook, createTempForge, mockPipelineState } = require("../helpers/test-utils");
const path = require("path");

// Build secret strings dynamically to avoid triggering Gate 6 on THIS file
function buildSecret(parts) {
  return parts.join("");
}

// Build string from char codes (used for patterns that Gate 6 scans in file content)
function cc() {
  return Array.from(arguments).map(function (c) {
    return typeof c === "number" ? String.fromCharCode(c) : c;
  }).join("");
}

describe("Gate 6 — Advanced Secret Bypass Attempts", () => {
  let tempForge;

  beforeEach(() => {
    const state = mockPipelineState({
      current_step: "execute",
      current_step_order: 8,
    });
    tempForge = createTempForge(state);
  });

  afterEach(() => {
    if (tempForge) {
      tempForge.cleanup();
      tempForge = null;
    }
  });

  function editWithContent(content) {
    return runHook("forge-gate-guard.js", {
      tool_name: "Edit",
      tool_input: {
        file_path: "/tmp/src/config.js",
        old_string: "// placeholder",
        new_string: content,
      },
      cwd: tempForge.dir,
    });
  }

  function writeWithContent(content) {
    return runHook("forge-gate-guard.js", {
      tool_name: "Write",
      tool_input: {
        file_path: "/tmp/src/config.js",
        content,
      },
      cwd: tempForge.dir,
    });
  }

  // ─── Bypass attempts that SHOULD be caught (exit 2) ──────────────

  describe("Caught bypasses — should BLOCK (exit 2)", () => {
    it("1. Split key concatenation: sk- + rest", () => {
      // Catches split-secret pattern: /"sk-"\s*\+\s*"/
      var content = buildSecret(["const key = \"sk", "-\" + \"abcdefghijklmnopqrstuv\";"]);
      var result = editWithContent(content);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });

    it("2. Auth header with JWT token", () => {
      // JWT pattern: /eyJ[...]{10,}\.[...]{10,}/
      // Auth-scheme word built from char codes to avoid pattern in this file
      var authWord = cc(66, 101, 97, 114, 101, 114, 32);
      var jwt = buildSecret(["eyJhb", "GciOiJIUzI1NiJ9", ".payload123456789"]);
      var content = "Authorization: " + authWord + jwt;
      var result = editWithContent(content);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });

    it("3. AWS key in variable assignment", () => {
      // AWS pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/
      var awsKey = buildSecret(["AKI", "AIOSFODNN7", "EXAMPLE"]);
      var content = "const AWS_ACCESS_KEY = \"" + awsKey + "\";";
      var result = editWithContent(content);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });
  });

  // ─── Bypass attempts that currently EVADE detection (exit 0) ─────

  describe("Known gaps — currently EVADE detection (exit 0)", () => {
    it("4. Base64-encoded secret: Buffer.from(...).toString()", () => {
      // No pattern for base64-encoded secrets — attacker encodes and decodes at runtime
      // TODO: Consider adding heuristic for Buffer.from/atob with long base64 strings
      var content = "const key = Buffer.from(\"c2stYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo=\").toString(\"utf8\");";
      var result = editWithContent(content);
      expect(result.exitCode).toBe(0);
    });

    it("5. Environment variable reference: process.env.API_KEY", () => {
      // CORRECT behavior — env var references are not hardcoded secrets
      var content = "const key = process.env.API_KEY;\nconst secret = process.env.SECRET_KEY;";
      var result = editWithContent(content);
      expect(result.exitCode).toBe(0);
    });

    it("6. ROT13 obfuscated secret", () => {
      // No pattern for ROT13 or other simple encoding schemes
      // "fx-nopqrstuvwxyz" is ROT13 of "sk-abcdefghijklm" — undetectable
      // TODO: Consider adding heuristic for rot13/decode/deobfuscate function calls
      var content = "const key = rot13(\"fx-nopqrstuvwxyzabcdefghijk\");";
      var result = editWithContent(content);
      expect(result.exitCode).toBe(0);
    });
  });

  // ─── Additional edge cases ───────────────────────────────────────

  describe("Edge cases — boundary behavior", () => {
    it("Short sk- prefix without enough chars — should NOT block", () => {
      // Pattern requires sk-[A-Za-z0-9]{20,} — less than 20 chars should pass
      var content = "const prefix = \"sk-short\";";
      var result = editWithContent(content);
      expect(result.exitCode).toBe(0);
    });

    it("Hex-encoded secret in config — should NOT block (no pattern)", () => {
      // Hex encoding is another evasion vector with no current detection
      var content = "const key = Buffer.from(\"736b2d6162636465666768696a6b6c6d6e6f\", \"hex\").toString();";
      var result = editWithContent(content);
      expect(result.exitCode).toBe(0);
    });

    it("Comment containing secret pattern — SHOULD block (Gate 6 scans all content)", () => {
      // Gate 6 does not distinguish comments from code — any pattern match blocks
      var secret = buildSecret(["sk-", "abcdefghijklmnopqrstuvwxyz"]);
      var content = "// Old key for reference: " + secret;
      var result = editWithContent(content);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("GATE 6 BLOCKED");
    });
  });
});
