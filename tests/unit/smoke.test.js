const { runForgeTools, runHook, createTempForge, mockPipelineState } = require("../helpers/test-utils");
const fs = require("fs");
const path = require("path");

// vitest globals (describe, it, expect, afterEach) are injected via vitest.config.js globals: true

describe("Smoke Tests", () => {
  let tempForge;

  afterEach(() => {
    if (tempForge) {
      tempForge.cleanup();
      tempForge = null;
    }
  });

  describe("forge-tools.js CLI", () => {
    it("detect-stack returns valid JSON", () => {
      const result = runForgeTools("detect-stack");
      expect(result).toHaveProperty("language");
    });

    it("engine-init creates pipeline-state.json", () => {
      tempForge = createTempForge();
      const result = runForgeTools("engine-init", tempForge.artifactDir, "test request", "code", "small");
      expect(result.initialized).toBe(true);

      const statePath = path.join(tempForge.artifactDir, "pipeline-state.json");
      expect(fs.existsSync(statePath)).toBe(true);

      const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
      expect(state.current_step).toBe("init");
      expect(state.pipeline).toBe("standard");
    });

    it("engine-state returns current state", () => {
      tempForge = createTempForge();
      runForgeTools("engine-init", tempForge.artifactDir, "test", "code", "small");
      const state = runForgeTools("engine-state", tempForge.artifactDir);
      expect(state.current_step).toBe("init");
      expect(state.allowed_transitions).toContain("research");
    });

    it("engine-init with --quick sets quick pipeline", () => {
      tempForge = createTempForge();
      const result = runForgeTools("engine-init", tempForge.artifactDir, "test", "code", "small", '{"quick":true}');
      expect(result.initialized).toBe(true);
      expect(result.pipeline).toBe("quick");
    });

    it("missing args returns usage error", () => {
      const result = runForgeTools("engine-init");
      expect(result.error).toBe(true);
    });
  });

  describe("forge-gate-guard.js hook", () => {
    it("allows unchecked tools (Read, Glob)", () => {
      const result = runHook("forge-gate-guard.js", {
        tool_name: "Read",
        tool_input: { file_path: "test.txt" },
      });
      expect(result.exitCode).toBe(0);
    });

    it("blocks code edit without pipeline (exit 2)", () => {
      const result = runHook("forge-gate-guard.js", {
        tool_name: "Edit",
        tool_input: { file_path: "/tmp/test.js", old_string: "a", new_string: "b" },
        cwd: "/tmp/nonexistent-forge-project",
      });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("FORGE GATE BLOCKED");
    });

    it("exits 0 on empty stdin", () => {
      const result = runHook("forge-gate-guard.js", "");
      expect(result.exitCode).toBe(0);
    });

    it("exits 2 on malformed JSON (fail-closed)", () => {
      const result = runHook("forge-gate-guard.js", "NOT_VALID_JSON");
      expect(result.exitCode).toBe(2);
    });
  });

  describe("pipeline.json validity", () => {
    it("parses as valid JSON", () => {
      const pipelinePath = path.join(__dirname, "..", "..", "forge", "templates", "pipeline.json");
      const content = fs.readFileSync(pipelinePath, "utf8");
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it("has standard pipeline with steps", () => {
      const pipelinePath = path.join(__dirname, "..", "..", "forge", "templates", "pipeline.json");
      const pipeline = JSON.parse(fs.readFileSync(pipelinePath, "utf8"));
      expect(pipeline.pipelines).toBeDefined();
      expect(pipeline.pipelines.standard).toBeDefined();
      expect(pipeline.pipelines.standard.steps.length).toBeGreaterThan(5);
    });

    it("has all 5 pipeline variants", () => {
      const pipelinePath = path.join(__dirname, "..", "..", "forge", "templates", "pipeline.json");
      const pipeline = JSON.parse(fs.readFileSync(pipelinePath, "utf8"));
      for (const variant of ["standard", "quick", "trivial", "debug", "ralph"]) {
        expect(pipeline.pipelines[variant]).toBeDefined();
      }
    });
  });
});
