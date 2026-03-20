#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';

const STATE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function main() {
  try {
    const raw = fs.readFileSync(0, 'utf8').trim();
    if (!raw) { process.exit(0); }

    const input = JSON.parse(raw);
    const sessionId = input.session_id;
    const cwd = input.cwd || process.cwd();

    // CRITICAL: Prevent infinite loops
    if (input.stop_hook_active) {
      process.exit(0);
      return;
    }

    if (!sessionId) { process.exit(0); return; }

    // Check state file
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const stateFile = path.join(home, '.claude', 'hooks', 'state', `skill-required-${sessionId}.json`);

    let stateData;
    try {
      stateData = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    } catch {
      // No state file → allow stop
      process.exit(0);
      return;
    }

    // TTL check
    if (stateData.timestamp && (Date.now() - stateData.timestamp) > STATE_TTL_MS) {
      try { fs.unlinkSync(stateFile); } catch {}
      process.exit(0);
      return;
    }

    // Check for active pipeline bypass
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
              const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
              if (state.current_step && state.current_step !== 'completed') {
                // Active pipeline → allow stop (forge is already running)
                try { fs.unlinkSync(stateFile); } catch {}
                process.exit(0);
                return;
              }
            } catch {}
          }
        } catch {}
      }
    } catch {}

    // State file exists, not expired, no active pipeline → BLOCK STOP
    const skill = stateData.skill || 'forge';
    const output = JSON.stringify({
      decision: "block",
      reason: `You must call Skill("${skill}") before responding. The ${skill} skill is required for this task. Do not respond with text only — invoke the skill first.`
    });
    process.stdout.write(output + '\n');
    process.exit(0);

  } catch {
    // Fail-open
    process.exit(0);
  }
}

main();
