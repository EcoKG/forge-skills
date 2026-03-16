#!/usr/bin/env node
/**
 * Forge Session Init — UserPromptSubmit Hook
 *
 * On the FIRST user message of a session, checks for existing Forge project
 * and injects context about the project state.
 *
 * stdin: JSON { session_id, prompt }
 * stdout: text to inject into context (or empty)
 */

const fs = require("fs");
const path = require("path");

const STATE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, ".claude", "hooks", "state");
try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}

function getSessionFile(sessionId) {
  return path.join(STATE_DIR, `forge-session-${sessionId || "default"}.json`);
}

function isFirstMessage(sessionId) {
  const sessionFile = getSessionFile(sessionId);
  if (fs.existsSync(sessionFile)) return false;
  try { fs.writeFileSync(sessionFile, "1"); } catch {}
  return true;
}

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, "utf8"); } catch { return null; }
}

function readJsonSafe(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return null; }
}

function extractStateInfo(stateMd) {
  if (!stateMd) return null;
  const info = {};
  for (const line of stateMd.split("\n")) {
    const m1 = line.match(/\*\*Project:\*\*\s*(.+)/);
    if (m1) info.project = m1[1].trim();
    const m2 = line.match(/\*\*Milestone:\*\*\s*(.+)/);
    if (m2) info.milestone = m2[1].trim();
    const m3 = line.match(/\*\*Phase:\*\*\s*(.+)/);
    if (m3) info.phase = m3[1].trim();
    const m4 = line.match(/\*\*Phase Status:\*\*\s*(.+)/);
    if (m4) info.phaseStatus = m4[1].trim();
    const m5 = line.match(/\*\*Progress:\*\*\s*(.+)/);
    if (m5) info.progress = m5[1].trim();
  }
  const lines = stateMd.split("\n");
  const nextIdx = lines.findIndex((l) => l.startsWith("## Next Action"));
  if (nextIdx >= 0 && nextIdx + 1 < lines.length) info.nextAction = lines[nextIdx + 1].trim();
  const blkIdx = lines.findIndex((l) => l.startsWith("## Blockers"));
  if (blkIdx >= 0 && blkIdx + 1 < lines.length) {
    const bl = lines[blkIdx + 1].trim();
    info.blockers = bl === "- (none)" ? null : bl;
  }
  return info;
}

function main() {
  try {
    const raw = fs.readFileSync(0, "utf8").trim();
    if (!raw) { process.exit(0); }
    const input = JSON.parse(raw);

    if (!isFirstMessage(input.session_id)) { process.exit(0); }

    const cwd = input.cwd || process.cwd();
    const forgeDir = path.join(cwd, ".forge");

    const stateMd = readFileSafe(path.join(forgeDir, "state.md"));
    const stateInfo = extractStateInfo(stateMd);

    if (stateInfo && stateInfo.project) {
      let ctx = `━━━ Forge Project Detected ━━━━━━━━━━\n`;
      ctx += `Project:  ${stateInfo.project}\n`;
      if (stateInfo.milestone) ctx += `Milestone: ${stateInfo.milestone}\n`;
      if (stateInfo.phase) ctx += `Phase:    ${stateInfo.phase}\n`;
      if (stateInfo.phaseStatus) ctx += `Status:   ${stateInfo.phaseStatus}\n`;
      if (stateInfo.progress) ctx += `Progress: ${stateInfo.progress}\n`;
      if (stateInfo.blockers) ctx += `Blockers: ${stateInfo.blockers}\n`;
      if (stateInfo.nextAction) ctx += `Next:     ${stateInfo.nextAction}\n`;
      ctx += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      ctx += `Use /forge --status for details, or /forge --phase N to execute a phase.`;
      process.stdout.write(ctx);
      process.exit(0);
    }

    const projectJson = readJsonSafe(path.join(forgeDir, "project.json"));
    if (projectJson) {
      process.stdout.write(`Forge project "${projectJson.name || "unnamed"}" detected. Use /forge --status to check progress.`);
    }
  } catch {}
  process.exit(0);
}

main();
