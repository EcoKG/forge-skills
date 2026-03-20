#!/usr/bin/env node
/**
 * Skill Activation Guard — PreToolUse Hook
 *
 * Enforces skill activation by blocking non-allowed tools until the
 * required skill (e.g., forge) has been invoked via the Skill tool.
 *
 * Works in tandem with skill-activation.js (UserPromptSubmit):
 *   1. skill-activation.js detects that forge is required and writes a state file
 *   2. This hook reads the state file and blocks tools until Skill("forge") is called
 *   3. When Skill("forge") is invoked, this hook deletes the state file → unblocked
 *
 * stdin: JSON { tool_name, tool_input, session_id, cwd }
 * stderr: blocking error messages (exit 2)
 * stdout: not used
 *
 * Exit codes:
 *   0 = allow tool
 *   2 = block tool (Claude Code hard block)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// Tools allowed even when forge skill is required
const ALLOWED_TOOLS = new Set([
  'Skill',             // Target — must always be allowed so forge can be invoked
  'ToolSearch',        // Needed to load deferred tools before Skill can be called
  'Read',             // Reading files is non-destructive
  'AskUserQuestion',  // User interaction must never be blocked
  'Agent',            // Forge PM dispatches subagents
  'SendMessage',      // Communication with running agents
  'Glob',             // File search is non-destructive
  'Grep',             // Content search is non-destructive
  'TaskCreate',       // Task management for forge pipeline
  'TaskUpdate',       // Task management
  'TaskGet',          // Task management
  'TaskList',         // Task management
  'TaskOutput',       // Task management
  'TaskStop',         // Task management
]);

// State file TTL — ignore state files older than this (prevents stale locks)
const STATE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getStateFilePath(sessionId) {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (!home || !sessionId) return null;
  return path.join(home, '.claude', 'hooks', 'state', `skill-required-${sessionId}.json`);
}

// Check if there's an active (non-completed) forge pipeline in the working directory
function hasActivePipeline(cwd) {
  if (!cwd) return false;
  const forgeDir = path.join(cwd, '.forge');
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
          const statePath = path.join(datePath, slugDir, 'pipeline-state.json');
          try {
            const content = fs.readFileSync(statePath, 'utf8');
            const state = JSON.parse(content);
            if (state.current_step && state.current_step !== 'completed') {
              return true;
            }
          } catch {}
        }
      } catch {}
    }
  } catch {}
  return false;
}

function main() {
  try {
    // Read stdin (PreToolUse hook receives JSON via stdin)
    const raw = fs.readFileSync(0, 'utf8').trim();
    if (!raw) {
      process.exit(0);
    }

    const input = JSON.parse(raw);
    const toolName = input.tool_name;
    const toolInput = input.tool_input || {};
    const sessionId = input.session_id;
    const cwd = input.cwd || process.cwd();

    // No session_id → can't track state, fail-open
    if (!sessionId) {
      process.exit(0);
    }

    const stateFile = getStateFilePath(sessionId);
    if (!stateFile) {
      process.exit(0);
    }

    // Check if state file exists
    let stateData;
    try {
      const content = fs.readFileSync(stateFile, 'utf8');
      stateData = JSON.parse(content);
    } catch {
      // No state file or unreadable → no enforcement needed
      process.exit(0);
    }

    // TTL check — if state file is stale, remove it and allow
    if (stateData.timestamp && (Date.now() - stateData.timestamp) > STATE_TTL_MS) {
      try { fs.unlinkSync(stateFile); } catch {}
      process.exit(0);
    }

    // Active pipeline bypass — if forge is already running, allow all tools
    // This prevents blocking during ongoing pipeline work after new user prompts
    if (hasActivePipeline(cwd)) {
      // Clean up stale state file since pipeline is active
      try { fs.unlinkSync(stateFile); } catch {}
      process.exit(0);
    }

    const requiredSkill = stateData.skill || 'forge';

    // If the tool is Skill and invokes the required skill → delete state file, allow
    if (toolName === 'Skill') {
      const skillArg = toolInput.skill_name || toolInput.skill || toolInput.name || '';
      if (skillArg === requiredSkill) {
        // Forge is being invoked — remove the lock
        try { fs.unlinkSync(stateFile); } catch {}
      }
      // Always allow the Skill tool
      process.exit(0);
    }

    // Check if tool is in the allowed list
    if (ALLOWED_TOOLS.has(toolName)) {
      process.exit(0);
    }

    // Tool is NOT allowed — block it
    process.stderr.write(
      '\u{1F6AB} SKILL ACTIVATION GUARD: ' + requiredSkill + ' skill is required for this task.\n' +
      'Call Skill("' + requiredSkill + '") first, then proceed.\n' +
      'Tool "' + toolName + '" is blocked until ' + requiredSkill + ' is invoked.\n'
    );
    process.exit(2);

  } catch {
    // Fail-open: any unexpected error → allow the tool
    process.exit(0);
  }
}

main();
