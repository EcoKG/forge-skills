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
 *   3. When Skill("forge") is invoked, this hook deletes the state file -> unblocked
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
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getSkillStateFilePath, getContextFilePath, hasActivePipeline } = require('../shared/pipeline.js');

// Minimum score to enforce blocking (coordinates with skill-activation.js SCORE_THRESHOLD)
const SCORE_THRESHOLD = 50;

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
  'TodoWrite',        // Meta-workflow task tracking
  'WebFetch',         // Web fetching is non-destructive
  'WebSearch',        // Web search is non-destructive
]);

// MCP tool verbs that indicate write/mutation operations
const MCP_WRITE_VERBS = ['write', 'edit', 'create', 'delete', 'update', 'send', 'execute', 'remove', 'move', 'duplicate'];

// State file TTL — ignore state files older than this (prevents stale locks)
const STATE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if an MCP tool is read-only (safe to allow).
 * MCP tools start with "mcp__". If the tool name doesn't contain
 * any write/mutation verb, it's considered read-only.
 */
function isMcpReadOnly(toolName) {
  if (!toolName.startsWith('mcp__')) return false;
  const nameLower = toolName.toLowerCase();
  return !MCP_WRITE_VERBS.some(verb => nameLower.includes(verb));
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

    // No session_id -> can't track state, fail-open
    if (!sessionId) {
      process.exit(0);
    }

    // Try unified context file first, fallback to legacy state file
    let stateData;
    let stateFile;
    let contextFile;

    // 1. Try unified context file -> extract .skillState
    contextFile = getContextFilePath(sessionId);
    if (contextFile) {
      try {
        const ctxContent = fs.readFileSync(contextFile, 'utf8');
        const ctx = JSON.parse(ctxContent);
        if (ctx && ctx.skillState) {
          stateData = ctx.skillState;
          stateFile = contextFile;
        }
      } catch {
        // Unified file missing or unreadable — try legacy
      }
    }

    // 2. Fallback to legacy skill-required-{id}.json
    if (!stateData) {
      stateFile = getSkillStateFilePath(sessionId);
      if (!stateFile) {
        process.exit(0);
      }
      try {
        const content = fs.readFileSync(stateFile, 'utf8');
        stateData = JSON.parse(content);
      } catch {
        // No state file or unreadable -> no enforcement needed
        process.exit(0);
      }
    }

    // TTL check — if state file is stale, remove it and allow
    if (stateData.timestamp && (Date.now() - stateData.timestamp) > STATE_TTL_MS) {
      try { fs.unlinkSync(stateFile); } catch {}
      process.exit(0);
    }

    // ASK mode pass-through — graduated confidence mid-range should not block
    if (stateData.confidence === 'ask') {
      process.exit(0);
    }

    // Score check — if score is below threshold, don't block
    const stateScore = stateData.score || 0;
    if (stateScore < SCORE_THRESHOLD) {
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

    // If the tool is Skill and invokes the required skill -> delete state file, allow
    if (toolName === 'Skill') {
      // Check all values in toolInput for the skill name (robust matching)
      const inputValues = Object.values(toolInput).map(v => String(v).toLowerCase());
      const skillLower = requiredSkill.toLowerCase();
      if (inputValues.some(v => v === skillLower || v.includes(skillLower))) {
        // Forge is being invoked — remove the legacy lock
        const legacyStateFile = getSkillStateFilePath(sessionId);
        if (legacyStateFile) {
          try { fs.unlinkSync(legacyStateFile); } catch {}
        }
        // Also clear skillState from unified context file
        const ctxFile = getContextFilePath(sessionId);
        if (ctxFile) {
          try {
            const ctxRaw = fs.readFileSync(ctxFile, 'utf8');
            const ctx = JSON.parse(ctxRaw);
            if (ctx && ctx.skillState) {
              ctx.skillState = null;
              ctx.updatedAt = Date.now();
              const tmpPath = ctxFile + `.tmp.${process.pid}`;
              fs.writeFileSync(tmpPath, JSON.stringify(ctx, null, 2));
              fs.renameSync(tmpPath, ctxFile);
            }
          } catch {
            // fail-open
          }
        }
      }
      // Always allow the Skill tool
      process.exit(0);
    }

    // Check if tool is in the allowed list
    if (ALLOWED_TOOLS.has(toolName)) {
      process.exit(0);
    }

    // Allow read-only MCP tools
    if (isMcpReadOnly(toolName)) {
      process.exit(0);
    }

    // Tool is NOT allowed — block it
    const msg =
      'SKILL ACTIVATION GUARD: ' + requiredSkill + ' skill is required for this task.\n' +
      'Call Skill("' + requiredSkill + '") first, then proceed.\n' +
      'Tool "' + toolName + '" is blocked until ' + requiredSkill + ' is invoked.\n';
    process.stderr.write(msg);
    process.exit(2);

  } catch (err) {
    // Fail-open: any unexpected error -> allow the tool
    // Log error to stderr before exiting
    try {
      process.stderr.write('[skill-activation-guard] fail-open error: ' + (err?.message || String(err)) + '\n');
    } catch {}
    process.exit(0);
  }
}

main();
