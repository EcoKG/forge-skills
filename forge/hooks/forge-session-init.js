/**
 * Forge Session Init — UserPromptSubmit Hook
 *
 * On the FIRST user message of a session, checks for existing Forge project
 * and injects context about the project state.
 *
 * Install: Add to .claude/settings.json hooks section
 * Trigger: UserPromptSubmit (runs on every user message)
 *
 * Behavior:
 *   - First message only (tracks via temp file)
 *   - If .forge/state.md exists: inject project context
 *   - If .forge/project.json exists but no state.md: inject project info
 *   - Otherwise: no-op
 */

const fs = require("fs");
const path = require("path");

const STATE_DIR = "/tmp";

function getSessionFile(sessionId) {
  return path.join(STATE_DIR, `forge-session-${sessionId || "default"}.json`);
}

function isFirstMessage(sessionId) {
  const sessionFile = getSessionFile(sessionId);
  if (fs.existsSync(sessionFile)) {
    return false;
  }
  try {
    fs.writeFileSync(sessionFile, JSON.stringify({ initialized: true }));
  } catch {
    // If we can't write, treat as first message anyway
  }
  return true;
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function extractStateInfo(stateMd) {
  if (!stateMd) return null;

  const lines = stateMd.split("\n");
  const info = {};

  for (const line of lines) {
    const projectMatch = line.match(/\*\*Project:\*\*\s*(.+)/);
    if (projectMatch) info.project = projectMatch[1].trim();

    const milestoneMatch = line.match(/\*\*Milestone:\*\*\s*(.+)/);
    if (milestoneMatch) info.milestone = milestoneMatch[1].trim();

    const phaseMatch = line.match(/\*\*Phase:\*\*\s*(.+)/);
    if (phaseMatch) info.phase = phaseMatch[1].trim();

    const statusMatch = line.match(/\*\*Phase Status:\*\*\s*(.+)/);
    if (statusMatch) info.phaseStatus = statusMatch[1].trim();

    const progressMatch = line.match(/\*\*Progress:\*\*\s*(.+)/);
    if (progressMatch) info.progress = progressMatch[1].trim();
  }

  // Get Next Action
  const nextIdx = lines.findIndex((l) => l.startsWith("## Next Action"));
  if (nextIdx >= 0 && nextIdx + 1 < lines.length) {
    info.nextAction = lines[nextIdx + 1].trim();
  }

  // Get Blockers
  const blockerIdx = lines.findIndex((l) => l.startsWith("## Blockers"));
  if (blockerIdx >= 0 && blockerIdx + 1 < lines.length) {
    const blockerLine = lines[blockerIdx + 1].trim();
    info.blockers = blockerLine === "- (none)" ? null : blockerLine;
  }

  return info;
}

module.exports = async ({ user_prompt, session_id, cwd }) => {
  // Only run on first message of session
  if (!isFirstMessage(session_id)) {
    return {};
  }

  const forgeDir = path.join(cwd || ".", ".forge");

  // Check for state.md (full project with state)
  const stateMd = readFileSafe(path.join(forgeDir, "state.md"));
  const stateInfo = extractStateInfo(stateMd);

  if (stateInfo && stateInfo.project) {
    let context = `━━━ Forge Project Detected ━━━━━━━━━━\n`;
    context += `Project:  ${stateInfo.project}\n`;
    if (stateInfo.milestone) context += `Milestone: ${stateInfo.milestone}\n`;
    if (stateInfo.phase) context += `Phase:    ${stateInfo.phase}\n`;
    if (stateInfo.phaseStatus)
      context += `Status:   ${stateInfo.phaseStatus}\n`;
    if (stateInfo.progress) context += `Progress: ${stateInfo.progress}\n`;
    if (stateInfo.blockers)
      context += `Blockers: ${stateInfo.blockers}\n`;
    if (stateInfo.nextAction)
      context += `Next:     ${stateInfo.nextAction}\n`;
    context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    context += `Use /forge --status for details, or /forge --phase N to execute a phase.`;

    return { additionalContext: context };
  }

  // Check for project.json without state (partial setup)
  const projectJson = readJsonSafe(path.join(forgeDir, "project.json"));
  if (projectJson) {
    return {
      additionalContext: `Forge project "${projectJson.name || "unnamed"}" detected in .forge/. Use /forge --status to check progress.`,
    };
  }

  return {};
};
