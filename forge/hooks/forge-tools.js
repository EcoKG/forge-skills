#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

const CWD = process.cwd();
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
          const out = execSync(`find "${CWD}" -name "${p.glob.split("/").pop()}" -maxdepth 5 -type f 2>/dev/null | wc -l`, { encoding: "utf8", timeout: 5000 });
          count = parseInt(out.trim()) || 0;
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
function createLock(artifactDir) {
  const lockPath = path.join(artifactDir, "execution-lock.json");
  const data = {
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

// Check if execution lock exists (crash detection)
function checkLock(artifactDir) {
  const lockPath = path.join(artifactDir, "execution-lock.json");
  if (fs.existsSync(lockPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(lockPath, "utf8"));
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

// Mark forge as invoked (for pretool gate)
function markInvoked(sessionId) {
  try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}
  const flagPath = path.join(STATE_DIR, `forge-invoked-${sessionId || "default"}.json`);
  fs.writeFileSync(flagPath, JSON.stringify({ invoked: true, at: new Date().toISOString() }));
  return { marked: true, session: sessionId };
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
    case "config-get":      result = configGet(args[0]); break;
    case "config-set":      result = configSet(args[0], args[1]); break;
    case "metrics-record":  result = metricsRecord(args[0]); break;
    case "metrics-summary": result = metricsSummary(); break;
    case "mark-invoked":    result = markInvoked(args[0]); break;
    case "detect-stack":        result = detectStack(); break;
    case "git-state":           result = getGitState(); break;
    case "create-lock":         result = createLock(args[0]); break;
    case "remove-lock":         result = removeLock(args[0]); break;
    case "check-lock":          result = checkLock(args[0]); break;
    case "metrics-record-dispatch": result = metricsRecordDispatch(args[0]); break;
    case "create-iteration-log":   result = createIterationLog(args[0], args.slice(1).join(" ")); break;
    case "record-iteration":       result = recordIteration(args[0], args[1], args[2]); break;
    case "check-completion-promise": result = checkCompletionPromise(args[0], args.slice(1).join(" ")); break;
    case "get-iteration-count":    result = getIterationCount(args[0]); break;
    case "help":
    default:
      result = {
        commands: [
          "get-phase <N>", "advance-phase <N>", "get-status",
          "update-state <field> <value>", "parse-frontmatter <file>",
          "verify-artifacts <plan>", "verify-key-links <plan>",
          "config-init", "config-get <key>", "config-set <key> <value>",
          "metrics-record <json>", "metrics-summary",
          "mark-invoked <session-id>",
          "detect-stack", "git-state",
          "create-lock <dir>", "remove-lock <dir>", "check-lock <dir>",
          "metrics-record-dispatch <json>",
          "create-iteration-log <dir> <promise>",
          "record-iteration <dir> <N> <json>",
          "check-completion-promise <dir> <command>",
          "get-iteration-count <dir>",
          "help"
        ]
      };
  }
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} catch (err) {
  process.stdout.write(JSON.stringify({ error: err.message }) + "\n");
  process.exit(1);
}
