/**
 * Engine Analyze Pipeline Tests
 *
 * Tests the v7.2 analyze pipeline variant:
 *   - init → analyze_search → finalize (3 steps)
 *   - Skips: research, architect_guide, plan, plan_check, checkpoint, branch, execute, verify
 *   - Read-only: no code modifications
 */

const { runForgeTools, createTempForge } = require("../helpers/test-utils");
const fs = require("fs");
const path = require("path");

describe("Engine — Analyze Pipeline (v7.2)", () => {
  let tempForge;

  afterEach(() => {
    if (tempForge) {
      tempForge.cleanup();
      tempForge = null;
    }
  });

  function initAnalyzePipeline() {
    tempForge = createTempForge();
    const result = runForgeTools(
      "engine-init",
      tempForge.artifactDir,
      "analyze codebase architecture",
      "analysis",
      "small",
      JSON.stringify({ analyze: true })
    );
    expect(result.initialized).toBe(true);
    return tempForge.artifactDir;
  }

  function writeArtifact(dir, filename, content) {
    fs.writeFileSync(
      path.join(dir, filename),
      content || "# Artifact\n\nGenerated for testing.\n"
    );
  }

  // ─── Initialization ─────────────────────────────────────────────

  describe("Initialization", () => {
    it("initializes with analyze pipeline name", () => {
      tempForge = createTempForge();
      const result = runForgeTools(
        "engine-init",
        tempForge.artifactDir,
        "test analyze",
        "analysis",
        "small",
        JSON.stringify({ analyze: true })
      );

      expect(result.initialized).toBe(true);
      expect(result.pipeline).toBe("analyze");
    });

    it("skips all non-analyze steps", () => {
      tempForge = createTempForge();
      const result = runForgeTools(
        "engine-init",
        tempForge.artifactDir,
        "test analyze",
        "analysis",
        "small",
        JSON.stringify({ analyze: true })
      );

      const expectedSkips = [
        "research", "architect_guide", "plan", "plan_check",
        "checkpoint", "branch", "execute", "verify"
      ];
      for (const step of expectedSkips) {
        expect(result.skipped_steps).toContain(step);
      }
    });
  });

  // ─── Transitions ─────────────────────────────────────────────────

  describe("Transitions", () => {
    it("can transition from init to analyze_search", () => {
      const dir = initAnalyzePipeline();
      const result = runForgeTools("engine-transition", dir, "analyze_search");

      expect(result.transitioned).toBe(true);
      expect(result.from).toBe("init");
      expect(result.to).toBe("analyze_search");
    });

    it("analyze_search → finalize after recording result", () => {
      const dir = initAnalyzePipeline();

      // Transition to analyze_search
      runForgeTools("engine-transition", dir, "analyze_search");

      // Write analysis.md artifact
      writeArtifact(dir, "analysis.md", "# Analysis\n\n## Answer\n\nTest analysis content here.\n");

      // Record result
      runForgeTools("engine-record-result", dir, "analyzer", "analysis-1", "PASS");

      // Transition to finalize
      const result = runForgeTools("engine-transition", dir, "finalize");
      expect(result.transitioned).toBe(true);
      expect(result.to).toBe("finalize");
    });
  });

  // ─── State ─────────────────────────────────────────────────────

  describe("State", () => {
    it("engine-state shows analyze pipeline", () => {
      const dir = initAnalyzePipeline();
      const state = runForgeTools("engine-state", dir);

      expect(state.current_step).toBe("init");
    });

    it("after transition, current step updates", () => {
      const dir = initAnalyzePipeline();
      runForgeTools("engine-transition", dir, "analyze_search");

      const state = runForgeTools("engine-state", dir);
      expect(state.current_step).toBe("analyze_search");
    });
  });
});
