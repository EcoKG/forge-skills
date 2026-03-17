#!/usr/bin/env node
/**
 * Forge Orchestrator — UserPromptSubmit Hook (v6.0 Ironclad)
 *
 * On EVERY user message:
 * 1. If active pipeline → inject current state + allowed actions
 * 2. If crashed execution found → inject recovery prompt
 * 3. If project detected → inject project context
 *
 * This is the PRIMARY control mechanism. It tells Claude exactly
 * what step it's on and what it can do next.
 *
 * stdin: JSON { session_id, prompt, cwd }
 * stdout: text injected into Claude's context
 */

const fs = require("fs");
const path = require("path");

const STATE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, ".claude", "hooks", "state");
try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}

function readJsonSafe(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return null; }
}

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, "utf8"); } catch { return null; }
}

// Find the most recent active pipeline-state.json
function findActivePipeline(forgeDir) {
  try {
    const entries = fs.readdirSync(forgeDir);
    const dateDirs = entries.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
    for (const dateDir of dateDirs) {
      const datePath = path.join(forgeDir, dateDir);
      try {
        const slugDirs = fs.readdirSync(datePath)
          .filter(d => { try { return fs.statSync(path.join(datePath, d)).isDirectory(); } catch { return false; } })
          .sort().reverse();
        for (const slugDir of slugDirs) {
          const statePath = path.join(datePath, slugDir, "pipeline-state.json");
          if (fs.existsSync(statePath)) {
            const state = readJsonSafe(statePath);
            if (state && state.current_step !== "completed") {
              state._dir = path.join(datePath, slugDir);
              state._slug = slugDir;
              state._date = dateDir;
              return state;
            }
          }
        }
      } catch {}
    }
  } catch {}
  return null;
}

// Find crashed executions (lock files without pipeline completion)
function findCrashedExecutions(forgeDir) {
  const crashes = [];
  try {
    const entries = fs.readdirSync(forgeDir);
    const dateDirs = entries.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
    for (const dateDir of dateDirs) {
      const datePath = path.join(forgeDir, dateDir);
      try {
        const slugDirs = fs.readdirSync(datePath).filter(d => {
          try { return fs.statSync(path.join(datePath, d)).isDirectory(); } catch { return false; }
        });
        for (const slugDir of slugDirs) {
          const lockPath = path.join(datePath, slugDir, "execution-lock.json");
          if (fs.existsSync(lockPath)) {
            const meta = readJsonSafe(path.join(datePath, slugDir, "meta.json"));
            crashes.push({ date: dateDir, slug: slugDir, meta });
          }
        }
      } catch {}
    }
  } catch {}
  return crashes;
}

// Read project state (for project mode)
function readProjectState(forgeDir) {
  const stateMd = readFileSafe(path.join(forgeDir, "state.md"));
  if (!stateMd) return null;
  const info = {};
  for (const line of stateMd.split("\n")) {
    const m1 = line.match(/\*\*Project:\*\*\s*(.+)/); if (m1) info.project = m1[1].trim();
    const m2 = line.match(/\*\*Phase:\*\*\s*(.+)/); if (m2) info.phase = m2[1].trim();
    const m3 = line.match(/\*\*Phase Status:\*\*\s*(.+)/); if (m3) info.status = m3[1].trim();
  }
  return info.project ? info : null;
}

// Format pipeline state injection
function formatPipelineContext(state) {
  const lines = [
    "",
    "━━━ FORGE PIPELINE STATE ━━━━━━━━━━━━━━━",
    `Step: ${state.current_step_order}. ${state.current_step.toUpperCase()} | Pipeline: ${state.pipeline}`,
    `Gates passed: ${state.gates_passed.join(", ") || "none"}`,
    `Gates pending: ${state.gates_pending.join(", ") || "none"}`,
  ];

  if (state.allowed_transitions.length > 0) {
    lines.push(`Next allowed: ${state.allowed_transitions.join(", ")}`);
    lines.push(`Transition: Bash("node forge-tools.js engine-transition ${state.artifact_dir} ${state.allowed_transitions[0]}")`);
  }

  if (state.tasks_completed.length > 0) {
    lines.push(`Tasks: ${state.tasks_completed.length} completed`);
  }

  if (state.last_build_result) {
    lines.push(`Build: ${state.last_build_result} | Test: ${state.last_test_result || "pending"}`);
  }

  if (state.drift.length > 0) {
    lines.push(`⚠ DRIFT DETECTED: ${state.drift.length} issues`);
  }

  const revTotal = Object.values(state.revision_counts).reduce((a, b) => a + b, 0);
  if (revTotal > 0) {
    lines.push(`Revisions: ${JSON.stringify(state.revision_counts)}`);
  }

  lines.push("");
  lines.push("Engine commands (use via Bash):");
  lines.push(`  forge-tools.js engine-state ${state.artifact_dir}`);
  lines.push(`  forge-tools.js engine-can-transition ${state.artifact_dir} <step>`);
  lines.push(`  forge-tools.js engine-transition ${state.artifact_dir} <step>`);
  lines.push(`  forge-tools.js engine-dispatch-spec ${state.artifact_dir} <role> [task_id]`);
  lines.push(`  forge-tools.js engine-record-result ${state.artifact_dir} <role> <task_id> <verdict>`);
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  return lines.join("\n");
}

function main() {
  try {
    const raw = fs.readFileSync(0, "utf8").trim();
    if (!raw) { process.exit(0); return; }
    const input = JSON.parse(raw);
    const cwd = input.cwd || process.cwd();
    const forgeDir = path.join(cwd, ".forge");

    if (!fs.existsSync(forgeDir)) { process.exit(0); return; }

    let output = "";

    // 1. Check for active pipeline
    const activePipeline = findActivePipeline(forgeDir);
    if (activePipeline) {
      output += formatPipelineContext(activePipeline);
    }

    // 2. Check for crashed executions (only if no active pipeline)
    if (!activePipeline) {
      const crashes = findCrashedExecutions(forgeDir);
      if (crashes.length > 0) {
        output += "\n⚠ Interrupted Forge Execution Detected ⚠\n";
        for (const crash of crashes) {
          const meta = crash.meta || {};
          output += `  ${crash.date}/${crash.slug}: step ${meta.current_step || "?"}, tasks ${meta.tasks?.completed || 0}/${meta.tasks?.total || "?"}\n`;
        }
        output += "Use /forge --resume to continue.\n";
      }
    }

    // 3. Check for project state (only if no active pipeline and no crashes)
    if (!activePipeline && !output) {
      const project = readProjectState(forgeDir);
      if (project) {
        output += `━━━ Forge Project: ${project.project} ━━━\n`;
        if (project.phase) output += `Phase: ${project.phase} | Status: ${project.status || "unknown"}\n`;
        output += "Use /forge --status for details.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
      }
    }

    if (output) {
      process.stdout.write(output);
    }
  } catch {}
  process.exit(0);
}

main();
