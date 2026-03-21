#!/usr/bin/env node
/**
 * Forge Statusline — Notification Hook
 *
 * Displays current Forge project/phase status in the Claude Code statusline.
 *
 * stdin: JSON { cwd }
 * stdout: text for statusline (or empty)
 */

const fs = require("fs");
const path = require("path");

function readJsonSafe(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return null; }
}

function readStateMd(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const projectMatch = content.match(/\*\*Project:\*\*\s*(.+)/);
    const phaseMatch = content.match(/\*\*Phase:\*\*\s*(\d+)\s*of\s*(\d+)\s*\(([^)]+)\)/);
    const statusMatch = content.match(/\*\*Phase Status:\*\*\s*(\w+)/);
    const progressMatch = content.match(/\*\*Progress:\*\*\s*[█░]+\s*(\d+)%/);
    return {
      project: projectMatch ? projectMatch[1].trim() : null,
      phase: phaseMatch ? { current: phaseMatch[1], total: phaseMatch[2], name: phaseMatch[3] } : null,
      status: statusMatch ? statusMatch[1] : null,
      progress: progressMatch ? progressMatch[1] : null,
    };
  } catch { return null; }
}

function main() {
  try {
    const raw = fs.readFileSync(0, "utf8").trim();
    const input = raw ? JSON.parse(raw) : {};
    const cwd = input.cwd || process.cwd();
    const forgeDir = path.join(cwd, ".forge");

    if (!fs.existsSync(forgeDir)) { process.exit(0); }

    const projectJson = readJsonSafe(path.join(forgeDir, "project.json"));
    const stateData = readStateMd(path.join(forgeDir, "state.md"));
    const parts = [];

    if (projectJson) parts.push(`⚒ ${projectJson.name || "Forge"}`);
    else if (stateData && stateData.project) parts.push(`⚒ ${stateData.project}`);

    if (stateData && stateData.phase) {
      const ph = stateData.phase;
      const icon = stateData.status === "completed" ? "✅" : stateData.status === "in_progress" ? "⏳" : "⬚";
      parts.push(`Ph ${ph.current}/${ph.total} ${icon} ${ph.name}`);
    }

    if (stateData && stateData.progress) parts.push(`${stateData.progress}%`);

    if (parts.length > 0) {
      process.stdout.write(parts.join(" | "));
    }
  } catch {}
  process.exit(0);
}

main();
