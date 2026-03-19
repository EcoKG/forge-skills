#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
const os = require("os");

// CWD: CLI tool uses env var or cwd (hooks use input.cwd from stdin — see gate-guard.js, tracker.js)
const CWD = process.env.FORGE_PROJECT_DIR || process.cwd();
const FORGE_DIR = path.join(CWD, ".forge");
const STATE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, ".claude", "hooks", "state");

// Simple YAML frontmatter parser (between --- markers)
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  // Simple key: value parsing (handles arrays and nested objects minimally)
  const result = {};
  let currentKey = null;
  let currentArray = null;
  for (const line of match[1].split("\n")) {
    const kvMatch = line.match(/^(\w[\w_]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const val = kvMatch[2].trim();
      if (val === "" || val === "[]") {
        result[currentKey] = [];
        currentArray = currentKey;
      } else if (val.startsWith("[") && val.endsWith("]")) {
        result[currentKey] = val.slice(1, -1).split(",").map(s => s.trim().replace(/['"]/g, ""));
        currentArray = null;
      } else {
        result[currentKey] = val.replace(/['"]/g, "");
        currentArray = null;
      }
    } else if (line.match(/^\s+-\s+/) && currentArray) {
      const item = line.replace(/^\s+-\s+/, "").trim().replace(/['"]/g, "");
      if (!Array.isArray(result[currentArray])) result[currentArray] = [];
      result[currentArray].push(item);
    }
  }
  return result;
}

// Read roadmap.md and extract phase info
function getPhase(n) {
  const roadmap = fs.readFileSync(path.join(FORGE_DIR, "roadmap.md"), "utf8");
  const phaseRegex = new RegExp(
    `### Phase ${n}:\\s*(.+?)\\n([\\s\\S]*?)(?=### Phase \\d|## Milestone|## Progress|$)`
  );
  const match = roadmap.match(phaseRegex);
  if (!match) return { error: `Phase ${n} not found` };

  const block = match[2];
  const goal = (block.match(/\*\*Goal:\*\*\s*(.+)/) || [])[1] || "";
  const depends = (block.match(/\*\*Depends on:\*\*\s*(.+)/) || [])[1] || "none";
  const status = (block.match(/\*\*Status:\*\*\s*(.+)/) || [])[1] || "pending";
  const criteria = [];
  const criteriaBlock = block.match(/\*\*Success Criteria:\*\*\n([\s\S]*?)(?=\n- \*\*|\n###|$)/);
  if (criteriaBlock) {
    for (const line of criteriaBlock[1].split("\n")) {
      const m = line.match(/^\s+-\s+(.+)/);
      if (m) criteria.push(m[1]);
    }
  }

  return { phase: n, name: match[1].trim(), goal, depends, status, criteria };
}

// Advance phase in roadmap.md
function advancePhase(n) {
  const roadmapPath = path.join(FORGE_DIR, "roadmap.md");
  let content = fs.readFileSync(roadmapPath, "utf8");

  // Set phase N to completed
  content = content.replace(
    new RegExp(`(### Phase ${n}:[\\s\\S]*?\\*\\*Status:\\*\\*\\s*)\\w+`),
    `$1completed`
  );

  // Set phase N+1 to in_progress (if exists)
  const nextN = parseInt(n) + 1;
  content = content.replace(
    new RegExp(`(### Phase ${nextN}:[\\s\\S]*?\\*\\*Status:\\*\\*\\s*)pending`),
    `$1in_progress`
  );

  fs.writeFileSync(roadmapPath, content);
  return { advanced: n, next: nextN };
}

// Get status from state.md
function getStatus() {
  const statePath = path.join(FORGE_DIR, "state.md");
  const content = fs.readFileSync(statePath, "utf8");
  const result = {};

  const project = content.match(/\*\*Project:\*\*\s*(.+)/);
  if (project) result.project = project[1].trim();
  const milestone = content.match(/\*\*Milestone:\*\*\s*(.+)/);
  if (milestone) result.milestone = milestone[1].trim();
  const phase = content.match(/\*\*Phase:\*\*\s*(.+)/);
  if (phase) result.phase = phase[1].trim();
  const status = content.match(/\*\*Phase Status:\*\*\s*(.+)/);
  if (status) result.phase_status = status[1].trim();
  const progress = content.match(/\*\*Progress:\*\*\s*(.+)/);
  if (progress) result.progress = progress[1].trim();

  const lines = content.split("\n");
  const nextIdx = lines.findIndex(l => l.startsWith("## Next Action"));
  if (nextIdx >= 0 && nextIdx + 1 < lines.length) result.next_action = lines[nextIdx + 1].trim();

  return result;
}

// Update state.md field
function updateState(field, value) {
  const statePath = path.join(FORGE_DIR, "state.md");
  let content = fs.readFileSync(statePath, "utf8");

  const fieldMap = {
    phase_status: /(\*\*Phase Status:\*\*\s*).+/,
    phase: /(\*\*Phase:\*\*\s*).+/,
    milestone: /(\*\*Milestone:\*\*\s*).+/,
    progress: /(\*\*Progress:\*\*\s*).+/,
  };

  if (field === "next_action") {
    const lines = content.split("\n");
    const idx = lines.findIndex(l => l.startsWith("## Next Action"));
    if (idx >= 0 && idx + 1 < lines.length) {
      lines[idx + 1] = value;
      content = lines.join("\n");
    }
  } else if (field === "session_history") {
    // Append to session history
    const lines = content.split("\n");
    const idx = lines.findIndex(l => l.startsWith("## Session History"));
    if (idx >= 0) {
      lines.splice(idx + 1, 0, `- ${value}`);
      content = lines.join("\n");
    }
  } else if (fieldMap[field]) {
    content = content.replace(fieldMap[field], `$1${value}`);
  }

  // Trim to 100 lines max
  const lines = content.split("\n");
  if (lines.length > 100) {
    // Remove oldest session history entries
    const histIdx = lines.findIndex(l => l.startsWith("## Session History"));
    if (histIdx >= 0) {
      const histEntries = [];
      for (let i = histIdx + 1; i < lines.length; i++) {
        if (lines[i].startsWith("- ")) histEntries.push(i);
        else if (lines[i].startsWith("##") || lines[i].startsWith("---")) break;
      }
      while (lines.length > 100 && histEntries.length > 5) {
        lines.splice(histEntries.shift(), 1);
        // Recount
        for (let j = 0; j < histEntries.length; j++) histEntries[j]--;
      }
    }
    content = lines.join("\n");
  }

  fs.writeFileSync(statePath, content);
  return { updated: field, value };
}

// Verify artifacts from plan.md must_haves
function verifyArtifacts(planFile) {
  const content = fs.readFileSync(planFile, "utf8");
  const fm = parseFrontmatter(content);
  // Simple artifact check - look for path entries in must_haves section
  const results = [];
  const artifactSection = content.match(/artifacts:\n([\s\S]*?)(?=\n\s*key_links:|---|\n\s*\w+:)/);
  if (artifactSection) {
    const pathMatches = artifactSection[1].matchAll(/path:\s*(.+)/g);
    for (const m of pathMatches) {
      const filePath = m[1].trim().replace(/['"]/g, "");
      const fullPath = path.join(CWD, filePath);
      const exists = fs.existsSync(fullPath);
      let lines = 0;
      if (exists) {
        lines = fs.readFileSync(fullPath, "utf8").split("\n").length;
      }
      results.push({ path: filePath, exists, lines });
    }
  }
  return { artifacts: results, all_exist: results.every(r => r.exists) };
}

// Verify key_links from plan.md must_haves
function verifyKeyLinks(planFile) {
  const content = fs.readFileSync(planFile, "utf8");
  const results = [];
  const linkSection = content.match(/key_links:\n([\s\S]*?)(?=---|\n\w+:|\n##)/);
  if (linkSection) {
    const blocks = linkSection[1].split(/\n\s*-\s+from:/);
    for (const block of blocks) {
      if (!block.trim()) continue;
      const from = (block.match(/(?:from:\s*)?(.+)/) || [])[1]?.trim().replace(/['"]/g, "");
      const to = (block.match(/to:\s*(.+)/) || [])[1]?.trim().replace(/['"]/g, "");
      const pattern = (block.match(/pattern:\s*(.+)/) || [])[1]?.trim().replace(/['"]/g, "");
      if (!from || !to || !pattern) continue;

      const fromPath = path.join(CWD, from);
      let connected = false;
      try {
        const fileContent = fs.readFileSync(fromPath, "utf8");
        connected = new RegExp(pattern).test(fileContent);
      } catch {}
      results.push({ from, to, pattern, connected });
    }
  }
  return { key_links: results, all_connected: results.every(r => r.connected) };
}

// Detect project stack from file patterns
function detectStack() {
  const patterns = [
    { lang: "go", glob: "**/*.go", framework: "go.mod" },
    { lang: "typescript", glob: "**/*.ts", framework: "package.json" },
    { lang: "javascript", glob: "**/*.js", framework: "package.json" },
    { lang: "python", glob: "**/*.py", framework: "pyproject.toml" },
    { lang: "rust", glob: "**/*.rs", framework: "Cargo.toml" },
    { lang: "java", glob: "**/*.java", framework: "pom.xml" },
    { lang: "csharp", glob: "**/*.cs", framework: "*.csproj" },
  ];
  let detected = { language: "unknown", framework: null, detected_files_count: 0 };
  if (!CWD || !path.isAbsolute(CWD)) return detected;
  try { fs.statSync(CWD); } catch { return detected; }
  for (const p of patterns) {
    try {
      const fwPath = path.join(CWD, p.framework.replace("*", ""));
      const hasFw = p.framework.includes("*")
        ? fs.readdirSync(CWD).some(f => f.endsWith(p.framework.replace("*", "")))
        : fs.existsSync(fwPath);
      if (hasFw) {
        // Count source files (limit search depth)
        let count = 0;
        try {
          const out = execFileSync("find", [CWD, "-name", p.glob.split("/").pop(), "-maxdepth", "5", "-type", "f"], { encoding: "utf8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
          count = out.trim().split("\n").filter(Boolean).length;
        } catch {}
        if (count > detected.detected_files_count) {
          detected = { language: p.lang, framework: p.framework, detected_files_count: count };
        }
      }
    } catch {}
  }
  return detected;
}

// Get current git repository state
function getGitState() {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: CWD, encoding: "utf8", timeout: 5000 }).trim();
    const status = execSync("git status --porcelain", { cwd: CWD, encoding: "utf8", timeout: 5000 }).trim();
    const logOut = execSync("git log --oneline -5 2>/dev/null", { cwd: CWD, encoding: "utf8", timeout: 5000 }).trim();
    const uncommitted = status ? status.split("\n").length : 0;
    const recent_commits = logOut ? logOut.split("\n").map(l => l.trim()) : [];
    return { branch, is_clean: uncommitted === 0, uncommitted_count: uncommitted, recent_commits };
  } catch (err) {
    return { error: "Not a git repository or git not available", details: err.message };
  }
}

// Create execution lock for crash recovery
function createLock(artifactDir, sessionId) {
  const lockPath = path.join(artifactDir, "execution-lock.json");
  const data = {
    session_id: sessionId || "unknown",
    pid: process.pid,
    started_at: new Date().toISOString(),
    hostname: os.hostname(),
  };
  fs.writeFileSync(lockPath, JSON.stringify(data, null, 2));
  return { created: true, path: lockPath };
}

// Remove execution lock (normal completion)
function removeLock(artifactDir) {
  const lockPath = path.join(artifactDir, "execution-lock.json");
  try {
    fs.unlinkSync(lockPath);
    return { removed: true, path: lockPath };
  } catch (err) {
    return { removed: false, error: err.message };
  }
}

// Clean up stale forge state files from ~/.claude/hooks/state/
function cleanupStaleStateFiles() {
  try {
    const entries = fs.readdirSync(STATE_DIR);
    for (const entry of entries) {
      if (entry.startsWith("forge-invoked-") || entry.startsWith("forge-session-") || entry.startsWith("forge-ctx-")) {
        const filePath = path.join(STATE_DIR, entry);
        try {
          const stat = fs.statSync(filePath);
          // Delete files older than 24 hours
          if (Date.now() - stat.mtimeMs > 86400000) {
            fs.unlinkSync(filePath);
          }
        } catch {}
      }
    }
  } catch {}
  return { cleaned: true };
}

// Check if execution lock exists (crash detection)
function checkLock(artifactDir) {
  const lockPath = path.join(artifactDir, "execution-lock.json");
  if (fs.existsSync(lockPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(lockPath, "utf8"));
      const started = new Date(data.started_at);
      data.stale = (Date.now() - started.getTime()) > 3600000; // 1 hour
      return { locked: true, ...data, path: lockPath };
    } catch {
      return { locked: true, path: lockPath, corrupt: true };
    }
  }
  return { locked: false };
}

// Record individual agent dispatch for token tracking
function metricsRecordDispatch(jsonData) {
  const metricsPath = path.join(FORGE_DIR, "metrics.json");
  let metrics = { version: "2.0", executions: [], dispatches: [], averages: {}, token_summary: {} };
  try { metrics = JSON.parse(fs.readFileSync(metricsPath, "utf8")); } catch {}
  if (!metrics.dispatches) metrics.dispatches = [];

  const data = JSON.parse(jsonData);
  data.recorded_at = new Date().toISOString();
  metrics.dispatches.push(data);

  // Update token summary
  if (!metrics.token_summary) metrics.token_summary = { total_input: 0, total_output: 0, by_model: {}, by_agent: {} };
  const ts = metrics.token_summary;
  const input = data.estimated_tokens?.input || 0;
  const output = data.estimated_tokens?.output || 0;
  ts.total_input += input;
  ts.total_output += output;

  const model = data.model || "unknown";
  if (!ts.by_model[model]) ts.by_model[model] = { input: 0, output: 0, dispatches: 0 };
  ts.by_model[model].input += input;
  ts.by_model[model].output += output;
  ts.by_model[model].dispatches += 1;

  const agent = data.agent || "unknown";
  if (!ts.by_agent[agent]) ts.by_agent[agent] = { input: 0, output: 0, dispatches: 0 };
  ts.by_agent[agent].input += input;
  ts.by_agent[agent].output += output;
  ts.by_agent[agent].dispatches += 1;

  fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
  return { recorded: true, total_dispatches: metrics.dispatches.length };
}

// === Ralph Mode Functions ===

// Create iteration log for Ralph mode
function createIterationLog(artifactDir, completionPromise) {
  const logPath = path.join(artifactDir, "iteration-log.md");
  const content = `# Ralph Iteration Log\n\n## Completion Promise\n\`${completionPromise}\`\n\n## Initial State\n(pending first check)\n\n---\n`;
  fs.writeFileSync(logPath, content);
  return { created: true, path: logPath };
}

// Record an iteration result
function recordIteration(artifactDir, iteration, jsonData) {
  const logPath = path.join(artifactDir, "iteration-log.md");
  const data = JSON.parse(jsonData);

  let entry = `\n## Iteration ${iteration}\n`;
  entry += `- **Approach:** ${data.approach || "unknown"}\n`;
  entry += `- **Result:** ${data.result || "unknown"}\n`;
  if (data.fixed) entry += `- **Fixed:** ${data.fixed}\n`;
  if (data.remaining) entry += `- **Remaining:** ${data.remaining}\n`;
  if (data.commit) entry += `- **Commit:** \`${data.commit}\`\n`;
  entry += `\n`;

  fs.appendFileSync(logPath, entry);

  // Update meta.json
  const metaPath = path.join(artifactDir, "meta.json");
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    if (!meta.ralph) meta.ralph = { iterations: 0, status: "running" };
    meta.ralph.iterations = parseInt(iteration);
    meta.ralph.last_result = data.result;
    if (data.result === "PASS") meta.ralph.status = "success";
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  } catch {}

  return { recorded: true, iteration: parseInt(iteration) };
}

// Check if completion promise is satisfied
function checkCompletionPromise(artifactDir, promise) {
  try {
    const output = execSync(promise, { cwd: CWD, encoding: "utf8", timeout: 60000, stdio: ["pipe", "pipe", "pipe"] });
    return { fulfilled: true, output: output.trim().slice(0, 500) };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.trim().slice(0, 500) : "";
    const stdout = err.stdout ? err.stdout.trim().slice(0, 500) : "";
    return { fulfilled: false, exit_code: err.status, output: stdout, error: stderr };
  }
}

// Get current iteration count from meta.json
function getIterationCount(artifactDir) {
  const metaPath = path.join(artifactDir, "meta.json");
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    return { iterations: meta.ralph?.iterations || 0, status: meta.ralph?.status || "unknown" };
  } catch {
    return { iterations: 0, status: "unknown" };
  }
}

// === FORGE ENGINE FUNCTIONS (v6.0 Ironclad) ===

// Load pipeline definition
function loadPipeline() {
  // Try project-local first, then skill default
  const localPath = path.join(FORGE_DIR, "pipeline.json");
  const defaultPath = path.join(__dirname, "..", "templates", "pipeline.json");
  try {
    const data = fs.existsSync(localPath)
      ? JSON.parse(fs.readFileSync(localPath, "utf8"))
      : JSON.parse(fs.readFileSync(defaultPath, "utf8"));
    if (!data.pipelines || !data.pipelines.standard || !Array.isArray(data.pipelines.standard.steps)) {
      return { error: "Invalid pipeline.json: missing pipelines.standard.steps array" };
    }
    return data;
  } catch (err) {
    return { error: "Failed to load pipeline.json: " + err.message };
  }
}

// Resolve steps from pipeline definition (apply only_steps + overrides)
function resolveSteps(pipelineDef, pipeline) {
  // 1. Get base steps: own steps or inherited
  let steps = pipelineDef.steps
    ? JSON.parse(JSON.stringify(pipelineDef.steps))
    : pipelineDef.inherits
      ? JSON.parse(JSON.stringify(pipeline.pipelines[pipelineDef.inherits].steps || []))
      : [];

  // 2. Filter to only_steps if defined
  if (pipelineDef.only_steps && pipelineDef.only_steps.length > 0) {
    const allowed = new Set(pipelineDef.only_steps);
    steps = steps.filter(s => allowed.has(s.id));
    // Fix next pointers to form valid chain
    for (let i = 0; i < steps.length; i++) {
      steps[i].next = i + 1 < steps.length ? steps[i + 1].id : undefined;
    }
    // Re-assign order values
    for (let i = 0; i < steps.length; i++) {
      steps[i].order = i + 1;
    }
  }

  // 3. Apply overrides via deep merge
  if (pipelineDef.overrides) {
    for (const [stepId, overrideObj] of Object.entries(pipelineDef.overrides)) {
      const step = steps.find(s => s.id === stepId);
      if (!step) continue;
      for (const [key, value] of Object.entries(overrideObj)) {
        if (value === null) {
          step[key] = null;
        } else if (typeof value === "object" && !Array.isArray(value) && typeof step[key] === "object" && step[key] !== null) {
          Object.assign(step[key], value);
        } else {
          step[key] = value;
        }
      }
    }
  }

  return steps;
}

// Read pipeline state (engine-managed, not meta.json)
function readPipelineState(artifactDir) {
  const statePath = path.join(artifactDir || FORGE_DIR, "pipeline-state.json");
  try { return JSON.parse(fs.readFileSync(statePath, "utf8")); }
  catch { return null; }
}

// Write pipeline state (ONLY engine should call this)
function writePipelineState(artifactDir, state) {
  const statePath = path.join(artifactDir, "pipeline-state.json");
  state.updated_at = new Date().toISOString();
  const tempPath = statePath + ".tmp." + process.pid;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2));
    fs.renameSync(tempPath, statePath);
  } catch (err) {
    try { fs.unlinkSync(tempPath); } catch {}
    throw err;
  }
  return { written: true, path: statePath };
}

// Initialize pipeline for a new execution
function engineInit(artifactDir, request, type, scale, options) {
  const pipeline = loadPipeline();
  if (pipeline.error) return pipeline;

  const pipelineName = options?.trivial ? "trivial" : options?.quick ? "quick" : options?.debug ? "debug" : options?.ralph ? "ralph" : "standard";
  const pipelineDef = pipeline.pipelines[pipelineName] || pipeline.pipelines.standard;

  // Determine which steps to skip based on type
  // Note: docs/analysis types skip plan step. Implementer prompt handles plan-less execution.
  // The execute step's entry_gate exempts plan.md because the plan step is in skipped_steps.
  const typeOverrides = pipeline.type_step_overrides?.[type] || {};
  const skippedSteps = typeOverrides.skip || [];
  if (options?.direct) skippedSteps.push("research", "architect_guide", "plan_check");
  if (options?.no_research) skippedSteps.push("research");
  if (options?.quick) skippedSteps.push("research", "architect_guide", "plan_check", "checkpoint", "branch");

  const state = {
    session_id: path.basename(artifactDir),
    artifact_dir: path.relative(CWD, artifactDir),
    pipeline: pipelineName,
    current_step: "init",
    current_step_order: 1,
    gates_passed: [],
    gates_pending: ["init_done"],
    allowed_transitions: [],
    skipped_steps: [...new Set(skippedSteps)],
    agents_dispatched: 0,
    revision_counts: { plan: 0, code_minor: 0, code_major: 0, reject: 0, qa_retry: 0 },
    last_build_result: null,
    last_test_result: null,
    wave_current: 0,
    wave_total: 0,
    tasks_completed: [],
    drift: [],
    created_at: new Date().toISOString(),
    request: request,
    type: type,
    scale: scale,
    options: options || {}
  };

  writePipelineState(artifactDir, state);
  return { initialized: true, pipeline: pipelineName, skipped_steps: state.skipped_steps };
}

// Get current pipeline state with allowed transitions
function engineCurrentState(artifactDir) {
  const state = readPipelineState(artifactDir);
  if (!state) return { error: "No active pipeline state found" };

  const pipeline = loadPipeline();
  if (pipeline.error) return pipeline;

  const pipelineDef = pipeline.pipelines[state.pipeline] || pipeline.pipelines.standard;
  const steps = resolveSteps(pipelineDef, pipeline);
  const currentStepDef = steps.find(s => s.id === state.current_step);

  // Compute allowed transitions
  const allowed = [];
  if (currentStepDef?.next) {
    const nextStepDef = steps.find(s => s.id === currentStepDef.next);
    if (nextStepDef) {
      // Check if next step should be skipped
      if (state.skipped_steps.includes(currentStepDef.next)) {
        // Find the next non-skipped step
        let target = currentStepDef.next;
        while (target && state.skipped_steps.includes(target)) {
          const targetDef = steps.find(s => s.id === target);
          target = targetDef?.next || null;
        }
        if (target) allowed.push(target);
      } else {
        allowed.push(currentStepDef.next);
      }
    }
  }

  return {
    current_step: state.current_step,
    current_step_order: state.current_step_order,
    gates_passed: state.gates_passed,
    gates_pending: state.gates_pending,
    allowed_transitions: allowed,
    revision_counts: state.revision_counts,
    last_build_result: state.last_build_result,
    last_test_result: state.last_test_result,
    wave_current: state.wave_current,
    tasks_completed: state.tasks_completed,
    drift: state.drift
  };
}

// Check if a transition is valid
function engineCanTransition(artifactDir, targetStep) {
  const state = readPipelineState(artifactDir);
  if (!state) return { allowed: false, reason: "No active pipeline state" };

  const pipeline = loadPipeline();
  if (pipeline.error) return { allowed: false, reason: pipeline.error };

  const pipelineDef = pipeline.pipelines[state.pipeline] || pipeline.pipelines.standard;
  const steps = resolveSteps(pipelineDef, pipeline);

  const currentStepDef = steps.find(s => s.id === state.current_step);
  const targetStepDef = steps.find(s => s.id === targetStep);

  if (!targetStepDef) return { allowed: false, reason: `Unknown step: ${targetStep}` };

  // Check order (no backward unless revision loop)
  if (targetStepDef.order < (currentStepDef?.order || 0)) {
    const loop = currentStepDef?.revision_loop;
    if (!loop || loop.target_step !== targetStep) {
      return { allowed: false, reason: `Cannot go backward from ${state.current_step} to ${targetStep}` };
    }
    if ((state.revision_counts[state.current_step] || 0) >= loop.max_iterations) {
      return { allowed: false, reason: `Revision limit reached (${loop.max_iterations})`, escalate: true };
    }
  }

  // Simulate skip chain: collect exit_gate values of all skipped intermediate steps
  const simulatedGates = [...state.gates_passed];
  if (currentStepDef) {
    // Add current step's exit gate (will be recorded at transition time)
    if (currentStepDef.exit_gate?.state_value) {
      simulatedGates.push(currentStepDef.exit_gate.state_value);
    }
    // Walk from current step's next toward target, collecting skipped step gates
    let walkId = currentStepDef.next;
    while (walkId && walkId !== targetStep) {
      const walkDef = steps.find(s => s.id === walkId);
      if (!walkDef) break;
      if (state.skipped_steps.includes(walkId) && walkDef.exit_gate?.state_value) {
        simulatedGates.push(walkDef.exit_gate.state_value);
      }
      walkId = walkDef.next;
    }
  }

  // Check entry gate
  const gate = targetStepDef.entry_gate;
  if (gate) {
    if (gate.required_state && state.current_step !== "init" && !simulatedGates.includes(gate.required_state)) {
      return { allowed: false, reason: `Required gate: ${gate.required_state} not passed. Current: ${state.current_step}` };
    }
    if (gate.required_artifacts) {
      // Collect artifacts produced by skipped steps — these are exempt from the check
      const skippedArtifacts = new Set();
      for (const skippedId of state.skipped_steps) {
        const skippedDef = steps.find(s => s.id === skippedId);
        if (skippedDef && skippedDef.produces) {
          skippedDef.produces.forEach(a => skippedArtifacts.add(a));
        }
      }
      const artDir = path.join(CWD, state.artifact_dir);
      const missing = gate.required_artifacts.filter(a => {
        if (skippedArtifacts.has(a)) return false; // exempt: produced by a skipped step
        try { return !fs.existsSync(path.join(artDir, a)) || fs.statSync(path.join(artDir, a)).size < 10; }
        catch { return true; }
      });
      if (missing.length > 0) {
        return { allowed: false, reason: `Missing required artifacts: ${missing.join(", ")}` };
      }
    }
  }

  // Check if target should be skipped
  if (state.skipped_steps.includes(targetStep)) {
    return { allowed: true, skip: true, reason: `Step ${targetStep} is skipped, will advance to next` };
  }

  return {
    allowed: true,
    target: targetStep,
    loads: targetStepDef.loads || [],
    produces: targetStepDef.produces || [],
    agent_role: targetStepDef.agent_role || null
  };
}

// Execute a state transition
function engineTransition(artifactDir, targetStep) {
  const canResult = engineCanTransition(artifactDir, targetStep);
  if (!canResult.allowed) return canResult;

  const state = readPipelineState(artifactDir);
  const previousStep = state.current_step;
  const pipeline = loadPipeline();
  const pipelineDef = pipeline.pipelines[state.pipeline] || pipeline.pipelines.standard;
  const steps = resolveSteps(pipelineDef, pipeline);
  const targetStepDef = steps.find(s => s.id === targetStep);

  // Record exit gate of current step as passed
  const currentStepDef = steps.find(s => s.id === state.current_step);
  if (currentStepDef?.exit_gate?.state_value) {
    if (!state.gates_passed.includes(currentStepDef.exit_gate.state_value)) {
      state.gates_passed.push(currentStepDef.exit_gate.state_value);
    }
  }

  // If target is skipped, find the next non-skipped step
  let actualTarget = targetStep;
  while (actualTarget && state.skipped_steps.includes(actualTarget)) {
    const def = steps.find(s => s.id === actualTarget);
    // Mark skipped step's gate as passed
    if (def?.exit_gate?.state_value) {
      state.gates_passed.push(def.exit_gate.state_value);
    }
    actualTarget = def?.next || null;
  }

  if (!actualTarget) return { error: "No valid step found after skipping" };

  const actualStepDef = steps.find(s => s.id === actualTarget);

  // Update state
  state.current_step = actualTarget;
  state.current_step_order = actualStepDef?.order || 0;
  state.gates_pending = [];
  if (actualStepDef?.exit_gate?.state_value) {
    state.gates_pending.push(actualStepDef.exit_gate.state_value);
  }

  // Compute next allowed transitions
  state.allowed_transitions = [];
  if (actualStepDef?.next) {
    state.allowed_transitions.push(actualStepDef.next);
  }

  // Auto-complete: if this is the last step (no next), mark pipeline as completed
  // Handles: standard (cleanup has no next), quick (finalize has no next after resolveSteps),
  // trivial (cleanup has no next), and any future pipeline variants.
  if (!actualStepDef?.next) {
    state.current_step = "completed";
    if (actualStepDef?.exit_gate?.state_value) {
      state.gates_passed.push(actualStepDef.exit_gate.state_value);
    }
    state.gates_pending = [];
  }

  writePipelineState(artifactDir, state);

  return {
    transitioned: true,
    from: previousStep,
    to: actualTarget,
    step_order: actualStepDef?.order,
    loads: actualStepDef?.loads || [],
    produces: actualStepDef?.produces || [],
    agent_role: actualStepDef?.agent_role || null,
    next: actualStepDef?.next || null
  };
}

// Generate dispatch specification for an agent
function engineDispatchSpec(artifactDir, role, taskId) {
  const state = readPipelineState(artifactDir);
  if (!state) return { error: "No active pipeline state" };

  const pipeline = loadPipeline();
  const modelProfile = pipeline.model_profiles?.[state.options?.model || "balanced"] || pipeline.model_profiles?.balanced;

  const pipelineDef = pipeline.pipelines[state.pipeline] || pipeline.pipelines.standard;
  const steps = resolveSteps(pipelineDef, pipeline);
  const currentStepDef = steps.find(s => s.id === state.current_step);

  // Determine prompt path and model
  let promptPath = null;
  let model = "sonnet";

  // Check type_step_overrides first — allows type-specific agent routing
  // e.g., design type overrides execute step to use architect instead of implementer
  const typeOverride = pipeline.type_step_overrides?.[state.type]?.[state.current_step];
  if (typeOverride?.agent_role === role) {
    promptPath = typeOverride.agent_prompt || `prompts/${role}.md`;
    model = modelProfile?.[typeOverride.model_key] || modelProfile?.[currentStepDef?.model_key] || "sonnet";
  } else if (currentStepDef?.agent_role === role) {
    promptPath = currentStepDef.agent_prompt;
    model = modelProfile?.[currentStepDef.model_key] || "sonnet";
  } else if (currentStepDef?.review_agent?.role === role) {
    promptPath = currentStepDef.review_agent.prompt;
    model = modelProfile?.[currentStepDef.review_agent.model_key] || "sonnet";
  } else if (currentStepDef?.qa_agent?.role === role) {
    promptPath = currentStepDef.qa_agent.prompt;
    model = modelProfile?.[currentStepDef.qa_agent.model_key] || "sonnet";
  } else {
    // Custom agent — check .forge/agents/
    const customPath = path.join(FORGE_DIR, "agents", `${role}.md`);
    if (fs.existsSync(customPath)) {
      promptPath = customPath;
    } else {
      promptPath = `prompts/${role}.md`;
    }
    // Try to read model from custom agent prompt frontmatter
    try {
      const absPath = path.isAbsolute(promptPath) ? promptPath : path.join(__dirname, "..", promptPath);
      const content = fs.readFileSync(absPath, "utf8");
      const fmMatch = content.match(/^---\n[\s\S]*?model:\s*(\w+)[\s\S]*?\n---/);
      if (fmMatch) model = fmMatch[1];
    } catch {}
  }

  // Resolve relative prompt_path to absolute using skill directory
  if (promptPath && !path.isAbsolute(promptPath)) {
    promptPath = path.join(__dirname, "..", promptPath);
  }

  // Build dispatch spec
  const spec = {
    role: role,
    task_id: taskId || state.current_step,
    prompt_path: promptPath,
    model: model,
    output_path: path.join(state.artifact_dir, taskId ? `task-${taskId}-summary.md` : `${role}-output.md`),
    artifact_dir: state.artifact_dir,
    step: state.current_step,
    agents_dispatched: state.agents_dispatched + 1
  };

  // Update dispatch count
  state.agents_dispatched++;
  writePipelineState(artifactDir, state);

  return spec;
}

// Record agent result
function engineRecordResult(artifactDir, role, taskId, verdict) {
  const state = readPipelineState(artifactDir);
  if (!state) return { error: "No active pipeline state" };

  // Atomic commit enforcement: execute-step PASS requires git commit
  const commitPipeline = loadPipeline();
  const commitPipelineDef = commitPipeline.pipelines?.[state.pipeline] || commitPipeline.pipelines?.standard;
  const commitSteps = resolveSteps(commitPipelineDef, commitPipeline);
  const commitStepDef = commitSteps.find(s => s.id === state.current_step);
  const isExecuteStep = commitStepDef?.id === "execute" || commitStepDef?.id === "fix";
  if (verdict === "PASS" && isExecuteStep && taskId) {
    let isGitRepo = false;
    try {
      execSync("git rev-parse --git-dir", { cwd: CWD, encoding: "utf8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      isGitRepo = true;
    } catch {}

    if (isGitRepo) {
      // Check if the most recent commit message contains the task_id
      let lastCommitMsg = "";
      try {
        lastCommitMsg = execSync("git log -1 --format=%s", { cwd: CWD, encoding: "utf8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }).trim();
      } catch {}

      if (!lastCommitMsg.includes(taskId)) {
        const slug = state.session_id || "unknown";
        const type = state.type || "feat";
        const typeMap = { "code": "feat", "code-bug": "fix", "code-refactor": "refactor", "docs": "docs", "infra": "chore" };
        const prefix = typeMap[type] || "feat";
        return {
          recorded: false,
          reason: `Atomic commit required for task ${taskId}. ` +
            `Commit your changes before recording PASS. ` +
            `Format: git commit -m "${prefix}(${slug}/${taskId}): <task description>"`
        };
      }
    }
    // If not a git repo, skip commit check — just record normally
  }

  if (verdict === "PASS" && taskId && !state.tasks_completed.includes(taskId)) {
    state.tasks_completed.push(taskId);
  }

  // Append to trace.jsonl
  const traceEntry = {
    timestamp: new Date().toISOString(),
    agent: role,
    task_id: taskId,
    verdict: verdict,
    step: state.current_step
  };
  const tracePath = path.join(CWD, state.artifact_dir, "trace.jsonl");
  try { fs.appendFileSync(tracePath, JSON.stringify(traceEntry) + "\n"); } catch {}

  writePipelineState(artifactDir, state);
  return { recorded: true, tasks_completed: state.tasks_completed.length };
}

// Record revision attempt
function engineRecordRevision(artifactDir, type) {
  const state = readPipelineState(artifactDir);
  if (!state) return { error: "No active pipeline state" };

  const pipeline = loadPipeline();
  const pipelineDef = pipeline.pipelines[state.pipeline] || pipeline.pipelines.standard;
  const steps = resolveSteps(pipelineDef, pipeline);
  const currentStepDef = steps.find(s => s.id === state.current_step);
  const limits = currentStepDef?.revision_limits || {};

  const scopedKey = state.current_step + ":" + type;
  state.revision_counts[scopedKey] = (state.revision_counts[scopedKey] || 0) + 1;
  const count = state.revision_counts[scopedKey];
  const limit = limits[type] || 999;

  writePipelineState(artifactDir, state);

  if (count >= limit) {
    return { recorded: true, count, limit, exceeded: true, action: "escalate_to_user" };
  }
  return { recorded: true, count, limit, exceeded: false };
}

// Run build verification and record result
function engineVerifyBuild(artifactDir, command) {
  const state = readPipelineState(artifactDir);
  if (!state) return { error: "No active pipeline state" };

  try {
    execSync(command, { cwd: CWD, encoding: "utf8", timeout: 120000, stdio: ["pipe", "pipe", "pipe"] });
    state.last_build_result = "pass";
    writePipelineState(artifactDir, state);
    return { result: "pass", command };
  } catch (err) {
    state.last_build_result = "fail";
    writePipelineState(artifactDir, state);
    return { result: "fail", command, error: (err.stderr || err.stdout || "").slice(0, 1000) };
  }
}

// Run test verification and record result
function engineVerifyTests(artifactDir, command) {
  const state = readPipelineState(artifactDir);
  if (!state) return { error: "No active pipeline state" };

  try {
    const output = execSync(command, { cwd: CWD, encoding: "utf8", timeout: 120000, stdio: ["pipe", "pipe", "pipe"] });
    state.last_test_result = "pass";
    writePipelineState(artifactDir, state);
    return { result: "pass", command, output: output.slice(0, 1000) };
  } catch (err) {
    state.last_test_result = "fail";
    writePipelineState(artifactDir, state);
    return { result: "fail", command, error: (err.stderr || err.stdout || "").slice(0, 1000) };
  }
}

// Get wave info for current execution
function engineWaveInfo(artifactDir) {
  const state = readPipelineState(artifactDir);
  if (!state) return { error: "No active pipeline state" };

  return {
    wave_current: state.wave_current,
    wave_total: state.wave_total,
    tasks_completed: state.tasks_completed,
    tasks_total: state.tasks_total || 0
  };
}

// Reconcile: compare desired state with actual state on disk
function engineReconcile(artifactDir) {
  const state = readPipelineState(artifactDir);
  if (!state) return { error: "No active pipeline state" };

  const artDir = path.join(CWD, state.artifact_dir);
  const drift = [];

  // Check completed tasks have summaries
  for (const taskId of state.tasks_completed) {
    const summaryPath = path.join(artDir, `task-${taskId}-summary.md`);
    if (!fs.existsSync(summaryPath)) {
      drift.push({ type: "missing_summary", task_id: taskId, expected: summaryPath });
    }
  }

  // Check required artifacts for current step
  const pipeline = loadPipeline();
  const pipelineDef = pipeline.pipelines[state.pipeline] || pipeline.pipelines.standard;
  const steps = resolveSteps(pipelineDef, pipeline);
  const currentStepDef = steps.find(s => s.id === state.current_step);

  if (currentStepDef?.entry_gate?.required_artifacts) {
    for (const artifact of currentStepDef.entry_gate.required_artifacts) {
      if (!fs.existsSync(path.join(artDir, artifact))) {
        drift.push({ type: "missing_artifact", artifact, step: state.current_step });
      }
    }
  }

  state.drift = drift;
  writePipelineState(artifactDir, state);

  if (drift.length > 0) {
    return { status: "DRIFT_DETECTED", drift, action: "correct" };
  }
  return { status: "CONSISTENT", drift: [] };
}

// Config operations
function configInit() {
  const configPath = path.join(FORGE_DIR, "config.json");
  if (fs.existsSync(configPath)) return { exists: true, path: configPath };

  const defaults = {
    mode: "interactive",
    granularity: "standard",
    model: "balanced",
    review: "normal",
    git_branching: "none",
    skip_tests: false,
    auto_discuss: true,
    workflow: {
      research: true,
      plan_check: true,
      verifier: true,
      quick_mode: false
    }
  };

  fs.mkdirSync(FORGE_DIR, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2));
  return { created: true, path: configPath, config: defaults };
}

function configGet(key) {
  const configPath = path.join(FORGE_DIR, "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const keys = key.split(".");
  let val = config;
  for (const k of keys) { val = val?.[k]; }
  return { key, value: val };
}

function configSet(key, value) {
  const configPath = path.join(FORGE_DIR, "config.json");
  let config = {};
  try { config = JSON.parse(fs.readFileSync(configPath, "utf8")); } catch {}

  // Parse value
  let parsed = value;
  if (value === "true") parsed = true;
  else if (value === "false") parsed = false;
  else if (!isNaN(value)) parsed = Number(value);

  const keys = key.split(".");
  let obj = config;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!obj[keys[i]]) obj[keys[i]] = {};
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = parsed;

  fs.mkdirSync(FORGE_DIR, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return { key, value: parsed };
}

// Metrics
function metricsRecord(jsonData) {
  const metricsPath = path.join(FORGE_DIR, "metrics.json");
  let metrics = { executions: [] };
  try { metrics = JSON.parse(fs.readFileSync(metricsPath, "utf8")); } catch {}

  const data = JSON.parse(jsonData);
  data.recorded_at = new Date().toISOString();
  metrics.executions.push(data);

  // Update averages
  const execs = metrics.executions;
  metrics.averages = {
    quality_score: execs.reduce((s, e) => s + (e.quality_score || 0), 0) / execs.length,
    revision_rate: execs.reduce((s, e) => s + ((e.revisions?.minor || 0) + (e.revisions?.major || 0)), 0) / execs.length,
    tasks_per_execution: execs.reduce((s, e) => s + (e.tasks || 0), 0) / execs.length,
  };

  fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
  return { recorded: true, total_executions: execs.length };
}

function metricsSummary() {
  const metricsPath = path.join(FORGE_DIR, "metrics.json");
  try {
    const metrics = JSON.parse(fs.readFileSync(metricsPath, "utf8"));
    return {
      total_executions: metrics.executions.length,
      averages: metrics.averages,
      recent: metrics.executions.slice(-5).map(e => ({
        id: e.id, type: e.type, quality: e.quality_score, date: e.date
      }))
    };
  } catch {
    return { total_executions: 0, averages: {}, recent: [] };
  }
}


// Argument validation helper
function requireArgs(args, count, usage) {
  if (args.length < count || args.slice(0, count).some(a => a === undefined)) {
    process.stdout.write(JSON.stringify({ error: "Usage: " + usage }) + "\n");
    process.exit(1);
  }
}

// Main dispatcher
const [,, command, ...args] = process.argv;

try {
  let result;
  switch (command) {
    case "get-phase":       result = getPhase(args[0]); break;
    case "advance-phase":   result = advancePhase(args[0]); break;
    case "get-status":      result = getStatus(); break;
    case "update-state":    result = updateState(args[0], args.slice(1).join(" ")); break;
    case "parse-frontmatter": result = parseFrontmatter(fs.readFileSync(args[0], "utf8")); break;
    case "verify-artifacts":  result = verifyArtifacts(args[0]); break;
    case "verify-key-links":  result = verifyKeyLinks(args[0]); break;
    case "config-init":     result = configInit(); break;
    case "config-get":      requireArgs(args, 1, "config-get <key>"); result = configGet(args[0]); break;
    case "config-set":      requireArgs(args, 2, "config-set <key> <value>"); result = configSet(args[0], args[1]); break;
    case "metrics-record":  result = metricsRecord(args[0]); break;
    case "metrics-summary": result = metricsSummary(); break;
    case "detect-stack":        result = detectStack(); break;
    case "git-state":           result = getGitState(); break;
    case "create-lock":         result = createLock(args[0], args[1]); break;
    case "remove-lock":         result = removeLock(args[0]); break;
    case "cleanup-state":       result = cleanupStaleStateFiles(); break;
    case "check-lock":          result = checkLock(args[0]); break;
    case "metrics-record-dispatch": result = metricsRecordDispatch(args[0]); break;
    case "create-iteration-log":   result = createIterationLog(args[0], args.slice(1).join(" ")); break;
    case "record-iteration":       result = recordIteration(args[0], args[1], args[2]); break;
    case "check-completion-promise": result = checkCompletionPromise(args[0], args.slice(1).join(" ")); break;
    case "get-iteration-count":    result = getIterationCount(args[0]); break;
    case "engine-init":          requireArgs(args, 4, "engine-init <dir> <request> <type> <scale> [options_json]"); result = engineInit(args[0], args[1], args[2], args[3], args[4] ? JSON.parse(args[4]) : {}); break;
    case "engine-state":         requireArgs(args, 1, "engine-state <dir>"); result = engineCurrentState(args[0]); break;
    case "engine-can-transition": requireArgs(args, 2, "engine-can-transition <dir> <step>"); result = engineCanTransition(args[0], args[1]); break;
    case "engine-transition":    requireArgs(args, 2, "engine-transition <dir> <step>"); result = engineTransition(args[0], args[1]); break;
    case "engine-dispatch-spec": requireArgs(args, 2, "engine-dispatch-spec <dir> <role> [task_id]"); result = engineDispatchSpec(args[0], args[1], args[2]); break;
    case "engine-record-result": requireArgs(args, 4, "engine-record-result <dir> <role> <task_id> <verdict>"); result = engineRecordResult(args[0], args[1], args[2], args[3]); break;
    case "engine-record-revision": result = engineRecordRevision(args[0], args[1]); break;
    case "engine-verify-build":  result = engineVerifyBuild(args[0], args.slice(1).join(" ")); break;
    case "engine-verify-tests":  result = engineVerifyTests(args[0], args.slice(1).join(" ")); break;
    case "engine-wave-info":     result = engineWaveInfo(args[0]); break;
    case "engine-reconcile":     result = engineReconcile(args[0]); break;
    case "help":
    default:
      result = {
        commands: [
          "get-phase <N>", "advance-phase <N>", "get-status",
          "update-state <field> <value>", "parse-frontmatter <file>",
          "verify-artifacts <plan>", "verify-key-links <plan>",
          "config-init", "config-get <key>", "config-set <key> <value>",
          "metrics-record <json>", "metrics-summary",
          "detect-stack", "git-state",
          "create-lock <dir>", "remove-lock <dir>", "cleanup-state", "check-lock <dir>",
          "metrics-record-dispatch <json>",
          "create-iteration-log <dir> <promise>",
          "record-iteration <dir> <N> <json>",
          "check-completion-promise <dir> <command>",
          "get-iteration-count <dir>",
          "engine-init <dir> <request> <type> <scale> [options_json]",
          "engine-state <dir>",
          "engine-can-transition <dir> <target_step>",
          "engine-transition <dir> <target_step>",
          "engine-dispatch-spec <dir> <role> [task_id]",
          "engine-record-result <dir> <role> <task_id> <verdict>",
          "engine-record-revision <dir> <type>",
          "engine-verify-build <dir> <command...>",
          "engine-verify-tests <dir> <command...>",
          "engine-wave-info <dir>",
          "engine-reconcile <dir>",
          "help"
        ]
      };
  }
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} catch (err) {
  process.stdout.write(JSON.stringify({ error: err.message }) + "\n");
  process.exit(1);
}
