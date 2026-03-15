/**
 * Forge Statusline — Notification Hook
 *
 * Displays current Forge project/phase status in the Claude Code statusline.
 *
 * Install: Add to .claude/settings.json hooks section
 * Trigger: Notification (periodic statusline update)
 *
 * Shows:
 *   - Project name + current phase (when project exists)
 *   - Phase execution progress (during forge pipeline)
 *   - "No project" (when no .forge/ detected)
 */

const fs = require("fs");
const path = require("path");

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readStateMd(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const projectMatch = content.match(/\*\*Project:\*\*\s*(.+)/);
    const phaseMatch = content.match(
      /\*\*Phase:\*\*\s*(\d+)\s*of\s*(\d+)\s*\(([^)]+)\)/
    );
    const statusMatch = content.match(/\*\*Phase Status:\*\*\s*(\w+)/);
    const progressMatch = content.match(/\*\*Progress:\*\*\s*([█░]+)\s*(\d+)%/);

    return {
      project: projectMatch ? projectMatch[1].trim() : null,
      phase: phaseMatch
        ? { current: phaseMatch[1], total: phaseMatch[2], name: phaseMatch[3] }
        : null,
      status: statusMatch ? statusMatch[1] : null,
      progress: progressMatch ? progressMatch[2] : null,
    };
  } catch {
    return null;
  }
}

function findActiveExecution(forgeDir) {
  // Check for in-progress meta.json in phases/ or date directories
  const phasesDir = path.join(forgeDir, "phases");
  if (fs.existsSync(phasesDir)) {
    try {
      const phases = fs.readdirSync(phasesDir);
      for (const phase of phases.reverse()) {
        const metaPath = path.join(phasesDir, phase, "meta.json");
        const meta = readJsonSafe(metaPath);
        if (meta && meta.state && !["completed", "closed"].includes(meta.state)) {
          return {
            type: "phase",
            name: phase,
            state: meta.state,
            step: meta.current_step,
            tasks: meta.tasks,
          };
        }
      }
    } catch {
      // Ignore read errors
    }
  }
  return null;
}

module.exports = async ({ cwd }) => {
  const forgeDir = path.join(cwd || ".", ".forge");

  // Check if forge project exists
  if (!fs.existsSync(forgeDir)) {
    return {};
  }

  const projectJson = readJsonSafe(path.join(forgeDir, "project.json"));
  const stateData = readStateMd(path.join(forgeDir, "state.md"));
  const activeExec = findActiveExecution(forgeDir);

  let statusParts = [];

  // Project info
  if (projectJson) {
    statusParts.push(`⚒ ${projectJson.name || "Forge"}`);
  } else if (stateData && stateData.project) {
    statusParts.push(`⚒ ${stateData.project}`);
  }

  // Phase info
  if (stateData && stateData.phase) {
    const ph = stateData.phase;
    const statusIcon =
      stateData.status === "completed"
        ? "✅"
        : stateData.status === "in_progress"
          ? "⏳"
          : "⬚";
    statusParts.push(
      `Ph ${ph.current}/${ph.total} ${statusIcon} ${ph.name}`
    );
  }

  // Active execution info
  if (activeExec) {
    const step = activeExec.step || "?";
    const tasks = activeExec.tasks;
    if (tasks) {
      statusParts.push(
        `Step ${step} [${tasks.completed || 0}/${tasks.total || "?"}]`
      );
    } else {
      statusParts.push(`Step ${step}`);
    }
  }

  // Progress
  if (stateData && stateData.progress) {
    statusParts.push(`${stateData.progress}%`);
  }

  if (statusParts.length === 0) {
    return {};
  }

  return {
    title: statusParts.join(" | "),
  };
};
