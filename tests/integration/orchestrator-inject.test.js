/**
 * Task 8.2 — Orchestrator Context Injection Integration Tests
 *
 * Tests forge-orchestrator.js context injection behavior:
 * - No .forge dir → minimal output
 * - Active pipeline → FORGE PIPELINE STATE
 * - Completed pipeline → no pipeline output
 * - /clear prompt → deletes session flag
 * - First prompt → Forge v7.0 banner
 */

const { runHook, createTempForge, mockPipelineState } = require("../helpers/test-utils");
const fs = require("fs");
const path = require("path");

const STATE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, ".claude", "hooks", "state");

// Clean up session hello flags before/after tests
function cleanSessionFlag(sessionId) {
  const flagPath = path.join(STATE_DIR, `forge-session-hello-${sessionId}.json`);
  try { fs.unlinkSync(flagPath); } catch {}
}

describe("Orchestrator — Context Injection Integration", () => {
  let tempForge;

  afterEach(() => {
    if (tempForge) {
      tempForge.cleanup();
      tempForge = null;
    }
  });

  // ─── Scenario 1: No .forge dir → no pipeline output ────────────────
  describe("No .forge directory", () => {
    it("outputs nothing (or just session banner) when no .forge dir exists", () => {
      const sessionId = "orch-test-no-forge-" + Date.now();
      // Ensure session flag exists so we don't get the health-check banner
      try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}
      fs.writeFileSync(
        path.join(STATE_DIR, `forge-session-hello-${sessionId}.json`),
        JSON.stringify({ at: new Date().toISOString() })
      );

      const result = runHook("forge-orchestrator.js", {
        session_id: sessionId,
        prompt: "hello",
        cwd: "/tmp/no-forge-dir-" + Date.now(),
      });

      expect(result.exitCode).toBe(0);
      // Should NOT contain pipeline state
      expect(result.stdout).not.toContain("FORGE PIPELINE STATE");

      cleanSessionFlag(sessionId);
    });
  });

  // ─── Scenario 2: Active pipeline → FORGE PIPELINE STATE ────────────
  describe("Active pipeline context injection", () => {
    it("outputs FORGE PIPELINE STATE with step info for active pipeline", () => {
      const state = mockPipelineState({
        current_step: "execute",
        current_step_order: 8,
        pipeline: "standard",
        gates_passed: ["init_done", "researched", "planned"],
        gates_pending: ["executed"],
        allowed_transitions: ["verify"],
      });
      tempForge = createTempForge(state);

      const sessionId = "orch-test-active-" + Date.now();
      // Pre-create session flag to skip the banner
      try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}
      fs.writeFileSync(
        path.join(STATE_DIR, `forge-session-hello-${sessionId}.json`),
        JSON.stringify({ at: new Date().toISOString() })
      );

      const result = runHook("forge-orchestrator.js", {
        session_id: sessionId,
        prompt: "continue working",
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("FORGE PIPELINE STATE");
      expect(result.stdout).toContain("EXECUTE");
      expect(result.stdout).toContain("standard");

      cleanSessionFlag(sessionId);
    });
  });

  // ─── Scenario 3: Completed pipeline → no pipeline output ───────────
  describe("Completed pipeline", () => {
    it("outputs nothing for completed pipeline (no active state)", () => {
      const state = mockPipelineState({
        current_step: "completed",
        current_step_order: 11,
        gates_passed: ["init_done", "researched", "planned", "executed", "verified"],
        gates_pending: [],
      });
      tempForge = createTempForge(state);

      const sessionId = "orch-test-completed-" + Date.now();
      // Pre-create session flag to skip the banner
      try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}
      fs.writeFileSync(
        path.join(STATE_DIR, `forge-session-hello-${sessionId}.json`),
        JSON.stringify({ at: new Date().toISOString() })
      );

      const result = runHook("forge-orchestrator.js", {
        session_id: sessionId,
        prompt: "hello",
        cwd: tempForge.dir,
      });

      expect(result.exitCode).toBe(0);
      // Completed pipeline should NOT be shown as active
      expect(result.stdout).not.toContain("FORGE PIPELINE STATE");

      cleanSessionFlag(sessionId);
    });
  });

  // ─── Scenario 4: /clear → deletes session flag ─────────────────────
  describe("/clear prompt handling", () => {
    it("/clear deletes session hello flag so next prompt gets banner", () => {
      const sessionId = "orch-test-clear-" + Date.now();

      // Create the session flag first (simulates a previous prompt in session)
      try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}
      const flagPath = path.join(STATE_DIR, `forge-session-hello-${sessionId}.json`);
      fs.writeFileSync(flagPath, JSON.stringify({ at: new Date().toISOString() }));
      expect(fs.existsSync(flagPath)).toBe(true);

      // Send /clear prompt
      const result = runHook("forge-orchestrator.js", {
        session_id: sessionId,
        prompt: "/clear",
        cwd: "/tmp",
      });

      expect(result.exitCode).toBe(0);
      // Flag should be deleted
      expect(fs.existsSync(flagPath)).toBe(false);
    });
  });

  // ─── Scenario 5: First prompt → Forge v7.0 banner ──────────────────
  describe("Session health check on first prompt", () => {
    it("outputs Forge v7.0 banner on first prompt of session", () => {
      const sessionId = "orch-test-first-" + Date.now();

      // Ensure the session flag does NOT exist (first prompt)
      cleanSessionFlag(sessionId);

      const result = runHook("forge-orchestrator.js", {
        session_id: sessionId,
        prompt: "hello",
        cwd: "/tmp",
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Forge v7.0");

      // Clean up
      cleanSessionFlag(sessionId);
    });

    it("does NOT output banner on second prompt (flag already set)", () => {
      const sessionId = "orch-test-second-" + Date.now();

      // Simulate first prompt already happened
      try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}
      fs.writeFileSync(
        path.join(STATE_DIR, `forge-session-hello-${sessionId}.json`),
        JSON.stringify({ at: new Date().toISOString() })
      );

      const result = runHook("forge-orchestrator.js", {
        session_id: sessionId,
        prompt: "second message",
        cwd: "/tmp",
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toContain("Forge v7.0");

      cleanSessionFlag(sessionId);
    });
  });
});
