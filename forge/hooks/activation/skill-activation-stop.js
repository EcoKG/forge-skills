#!/usr/bin/env node
/**
 * Skill Activation Stop — PostToolUse / Stop Hook
 *
 * Prevents Claude from responding with text-only when a skill is required.
 * Outputs { decision: "block" } to force skill invocation.
 *
 * stdin: JSON { session_id, cwd, ... }
 * stdout: JSON { decision: "block", reason: "..." } or nothing
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getSkillStateFilePath, hasActivePipeline } = require('../shared/pipeline.js');

// Minimum score to enforce blocking (coordinates with skill-activation.js SCORE_THRESHOLD)
const SCORE_THRESHOLD = 50;

const STATE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Write diagnostic log entry to debug log file.
 */
function writeDebugLog(entry) {
  try {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    if (!home) return;
    const logDir = path.join(home, '.claude', 'hooks', 'state');
    fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, 'stop-hook-debug.log');
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      ...entry
    }) + '\n';
    fs.appendFileSync(logFile, line);
  } catch {
    // Diagnostic logging should never break the hook
  }
}

function main() {
  try {
    const raw = fs.readFileSync(0, 'utf8').trim();
    if (!raw) { process.exit(0); }

    const input = JSON.parse(raw);
    const sessionId = input.session_id;
    const cwd = input.cwd || process.cwd();

    if (!sessionId) {
      writeDebugLog({ session_id: null, decision: 'allow', reason: 'no session_id' });
      process.exit(0);
      return;
    }

    // Check state file
    const stateFile = getSkillStateFilePath(sessionId);
    if (!stateFile) {
      writeDebugLog({ session_id: sessionId, decision: 'allow', reason: 'no state file path' });
      process.exit(0);
      return;
    }

    let stateData;
    try {
      stateData = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    } catch {
      // No state file -> allow stop
      writeDebugLog({ session_id: sessionId, decision: 'allow', reason: 'no state file' });
      process.exit(0);
      return;
    }

    // Compute state file age
    const stateAge = stateData.timestamp ? Date.now() - stateData.timestamp : Infinity;

    // TTL check
    if (stateAge > STATE_TTL_MS) {
      try { fs.unlinkSync(stateFile); } catch {}
      writeDebugLog({ session_id: sessionId, state_age_ms: stateAge, decision: 'allow', reason: 'state file expired' });
      process.exit(0);
      return;
    }

    // Score check — if score is below threshold, don't block
    const stateScore = stateData.score || 0;
    if (stateScore < SCORE_THRESHOLD) {
      writeDebugLog({ session_id: sessionId, state_age_ms: stateAge, score: stateScore, decision: 'allow', reason: 'score below threshold' });
      process.exit(0);
      return;
    }

    // Meta-workflow exclusion: if skill-creator is active, don't block
    if (stateData.skill && /skill-creator/i.test(stateData.skill)) {
      writeDebugLog({ session_id: sessionId, state_age_ms: stateAge, skill: stateData.skill, decision: 'allow', reason: 'skill-creator active' });
      process.exit(0);
      return;
    }

    // Check for active pipeline bypass
    if (hasActivePipeline(cwd)) {
      // Active pipeline -> allow stop (forge is already running)
      try { fs.unlinkSync(stateFile); } catch {}
      writeDebugLog({ session_id: sessionId, state_age_ms: stateAge, decision: 'allow', reason: 'active pipeline' });
      process.exit(0);
      return;
    }

    // State file exists, not expired, score meets threshold, no active pipeline -> BLOCK STOP
    const skill = stateData.skill || 'forge';
    const output = JSON.stringify({
      decision: "block",
      reason: `You must call Skill("${skill}") before responding. The ${skill} skill is required for this task. Do not respond with text only \u2014 invoke the skill first.`
    });
    process.stdout.write(output + '\n');
    writeDebugLog({ session_id: sessionId, state_age_ms: stateAge, score: stateScore, skill, decision: 'block', reason: 'skill required' });
    process.exit(0);

  } catch (err) {
    // Fail-open
    try {
      writeDebugLog({ decision: 'allow', reason: 'uncaught error', error: err?.message || String(err) });
    } catch {}
    process.exit(0);
  }
}

main();
