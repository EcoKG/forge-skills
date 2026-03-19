/**
 * Task 8.3 — Pipeline Discovery Cross-Component Consistency Tests
 *
 * Verifies gate-guard and orchestrator discover the same pipeline state
 * from the same .forge directory structure.
 */

const { runHook, createTempForge, mockPipelineState } = require("../helpers/test-utils");
const fs = require("fs");
const path = require("path");

const STATE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, ".claude", "hooks", "state");

function cleanSessionFlag(sessionId) {
  const flagPath = path.join(STATE_DIR, `forge-session-hello-${sessionId}.json`);
  try { fs.unlinkSync(flagPath); } catch {}
}

describe("Pipeline Discovery — Cross-Component Consistency", () => {
  let tempForge;

  afterEach(() => {
    if (tempForge) {
      tempForge.cleanup();
      tempForge = null;
    }
  });

  // ─── Scenario 1-4: gate-guard and orchestrator find the same pipeline ──
  describe("gate-guard and orchestrator share the same pipeline view", () => {
    it("both components discover and act on the same active pipeline", () => {
      const state = mockPipelineState({
        current_step: "execute",
        current_step_order: 8,
        pipeline: "standard",
        gates_passed: ["init_done", "researched", "arch_guided", "planned", "plan_checked", "approved", "branched"],
        gates_pending: ["executed"],
        allowed_transitions: ["verify"],
      });
      tempForge = createTempForge(state);

      // Step 2: Run gate-guard with a Read tool (unchecked tool → exit 0)
      const guardResult = runHook("forge-gate-guard.js", {
        tool_name: "Read",
        tool_input: { file_path: "/tmp/some-file.txt" },
        cwd: tempForge.dir,
      });

      expect(guardResult.exitCode).toBe(0);

      // Step 3: Run orchestrator with same cwd
      const sessionId = "disc-test-" + Date.now();
      try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}
      // Pre-create flag to skip banner noise
      fs.writeFileSync(
        path.join(STATE_DIR, `forge-session-hello-${sessionId}.json`),
        JSON.stringify({ at: new Date().toISOString() })
      );

      const orchResult = runHook("forge-orchestrator.js", {
        session_id: sessionId,
        prompt: "what step am I on?",
        cwd: tempForge.dir,
      });

      expect(orchResult.exitCode).toBe(0);
      expect(orchResult.stdout).toContain("FORGE PIPELINE STATE");
      expect(orchResult.stdout).toContain("EXECUTE");

      cleanSessionFlag(sessionId);
    });

    it("gate-guard does not block unchecked tools, orchestrator outputs correct step", () => {
      const state = mockPipelineState({
        current_step: "research",
        current_step_order: 2,
        pipeline: "standard",
        gates_passed: ["init_done"],
        gates_pending: ["researched"],
        allowed_transitions: ["architecture"],
      });
      tempForge = createTempForge(state);

      // Gate-guard allows Read (unchecked tool) at any step
      const guardResult = runHook("forge-gate-guard.js", {
        tool_name: "Read",
        tool_input: { file_path: "/tmp/test.js" },
        cwd: tempForge.dir,
      });
      expect(guardResult.exitCode).toBe(0);

      // Gate-guard blocks Edit at research step (Gate 2)
      const guardBlockResult = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: "/tmp/src/index.ts",
          old_string: "old",
          new_string: "new",
        },
        cwd: tempForge.dir,
      });
      expect(guardBlockResult.exitCode).toBe(2);
      expect(guardBlockResult.stderr).toContain("GATE 2 BLOCKED");
      expect(guardBlockResult.stderr).toContain("research");

      // Orchestrator sees the same step
      const sessionId = "disc-test-step-" + Date.now();
      try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}
      fs.writeFileSync(
        path.join(STATE_DIR, `forge-session-hello-${sessionId}.json`),
        JSON.stringify({ at: new Date().toISOString() })
      );

      const orchResult = runHook("forge-orchestrator.js", {
        session_id: sessionId,
        prompt: "status",
        cwd: tempForge.dir,
      });

      expect(orchResult.exitCode).toBe(0);
      expect(orchResult.stdout).toContain("FORGE PIPELINE STATE");
      expect(orchResult.stdout).toContain("RESEARCH");

      cleanSessionFlag(sessionId);
    });

    it("gate-guard allows code edits at execute, orchestrator confirms execute step", () => {
      const state = mockPipelineState({
        current_step: "execute",
        current_step_order: 8,
        pipeline: "quick",
        gates_passed: ["init_done", "researched", "planned", "approved", "branched"],
        gates_pending: ["executed"],
      });
      tempForge = createTempForge(state);

      // Gate-guard allows Edit at execute step
      const guardResult = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: {
          file_path: "/tmp/src/app.js",
          old_string: "const a = 1",
          new_string: "const a = 2",
        },
        cwd: tempForge.dir,
      });
      expect(guardResult.exitCode).toBe(0);

      // Orchestrator sees execute step with quick pipeline
      const sessionId = "disc-test-exec-" + Date.now();
      try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}
      fs.writeFileSync(
        path.join(STATE_DIR, `forge-session-hello-${sessionId}.json`),
        JSON.stringify({ at: new Date().toISOString() })
      );

      const orchResult = runHook("forge-orchestrator.js", {
        session_id: sessionId,
        prompt: "continue",
        cwd: tempForge.dir,
      });

      expect(orchResult.exitCode).toBe(0);
      expect(orchResult.stdout).toContain("FORGE PIPELINE STATE");
      expect(orchResult.stdout).toContain("EXECUTE");
      expect(orchResult.stdout).toContain("quick");

      cleanSessionFlag(sessionId);
    });

    it("no pipeline found → gate-guard blocks code edits, orchestrator has no pipeline state", () => {
      // Create a temp dir with a .forge dir but NO pipeline-state.json
      const tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "forge-disc-"));
      const forgeDir = path.join(tmpDir, ".forge");
      fs.mkdirSync(forgeDir, { recursive: true });

      try {
        // Gate-guard blocks code edit without pipeline
        const guardResult = runHook("forge-gate-guard.js", {
          tool_name: "Edit",
          tool_input: {
            file_path: "/tmp/src/app.js",
            old_string: "a",
            new_string: "b",
          },
          cwd: tmpDir,
        });
        expect(guardResult.exitCode).toBe(2);
        expect(guardResult.stderr).toContain("FORGE GATE BLOCKED");

        // Orchestrator has no pipeline state to inject
        const sessionId = "disc-test-none-" + Date.now();
        try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}
        fs.writeFileSync(
          path.join(STATE_DIR, `forge-session-hello-${sessionId}.json`),
          JSON.stringify({ at: new Date().toISOString() })
        );

        const orchResult = runHook("forge-orchestrator.js", {
          session_id: sessionId,
          prompt: "hello",
          cwd: tmpDir,
        });

        expect(orchResult.exitCode).toBe(0);
        expect(orchResult.stdout).not.toContain("FORGE PIPELINE STATE");

        cleanSessionFlag(sessionId);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
