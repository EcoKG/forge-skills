#!/usr/bin/env node
/**
 * Gatekeeper Init — SessionStart Hook
 *
 * On session start:
 * 1. Scan skill directories for available skills (SKILL.md)
 * 2. Build a skill catalog string for routing context
 * 3. Write catalog state file for downstream hooks to consume
 * 4. Clean up stale state files
 *
 * stdin: JSON { session_id, source }
 * stdout: (none)
 */

if (process.env.GATEKEEPER_ENABLED === 'false') process.exit(0);

const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'hooks', 'state');
const SKILLS_DIRS = [
  path.join(process.env.HOME || process.env.USERPROFILE, '.claude', 'skills'),
  path.join(process.cwd(), '.claude', 'skills'),
];
const STALE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_TTL_MS = 60 * 60 * 1000;     // 1 hour (cross-session cleanup)

/**
 * Scan skill directories for SKILL.md files and extract metadata.
 * @param {string[]} skillsDirs
 * @returns {{ name: string, description: string, routingText: string }[]}
 */
function scanSkills(skillsDirs) {
  const skills = [];
  for (const dir of skillsDirs) {
    try {
      if (!fs.existsSync(dir)) continue;
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        try {
          const skillPath = path.join(dir, entry);
          const stat = fs.statSync(skillPath);
          if (!stat.isDirectory()) continue;

          const skillMdPath = path.join(skillPath, 'SKILL.md');
          if (!fs.existsSync(skillMdPath)) continue;

          const content = fs.readFileSync(skillMdPath, 'utf8');

          // Extract YAML frontmatter between --- delimiters
          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
          if (!frontmatterMatch) continue;

          const frontmatter = frontmatterMatch[1];

          // Extract name field
          const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
          const name = nameMatch ? nameMatch[1].trim() : entry;

          // Extract description field (may be multiline with | or >)
          let description = '';
          const descMatch = frontmatter.match(/^description:\s*\|?\s*\n?([\s\S]*?)(?=\n\S|$)/m);
          if (descMatch) {
            // Collapse multiline description to first non-empty line
            const lines = descMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
            description = lines[0] || '';
          } else {
            const inlineDescMatch = frontmatter.match(/^description:\s*(.+)$/m);
            if (inlineDescMatch) description = inlineDescMatch[1].trim();
          }

          // Extract routing section as raw text
          const routingMatch = frontmatter.match(/^routing:\s*([\s\S]*?)(?=\n\S|\n*$)/m);
          const routingText = routingMatch ? routingMatch[1].trim() : '';

          skills.push({ name, description, routingText });
        } catch {
          // Skip individual skill on error — continue scanning
        }
      }
    } catch {
      // Skip entire directory on error — continue
    }
  }
  return skills;
}

/**
 * Format skills array as a compact markdown table string.
 * @param {{ name: string, description: string, routingText: string }[]} skills
 * @returns {string}
 */
function buildCatalogString(skills) {
  if (!skills || skills.length === 0) {
    // Hardcoded fallback ensures routing still works even if SKILL.md scanning fails
    return '| forge-dev | Autonomous development engine | implement, build, fix, refactor, design, deploy |';
  }

  const header = '| Skill | Description | Triggers |\n|---|---|---|';
  const rows = skills.map(s => {
    const desc = s.description.replace(/\|/g, '\\|');
    // Extract trigger keywords from routingText if available
    let triggers = '';
    if (s.routingText) {
      // Extract triggers array values from YAML-like routing text
      const triggersMatch = s.routingText.match(/triggers:\s*\[([^\]]+)\]/);
      if (triggersMatch) {
        triggers = triggersMatch[1].replace(/["']/g, '').trim();
      } else {
        triggers = s.routingText.replace(/\n/g, ' ').replace(/\|/g, '\\|').trim().substring(0, 80);
      }
    }
    if (!triggers) {
      // No routing metadata — use truncated description as context
      triggers = desc.substring(0, 60) + (desc.length > 60 ? '...' : '');
    }
    return `| ${s.name} | ${desc} | ${triggers} |`;
  });

  return [header, ...rows].join('\n');
}

/**
 * Delete stale state files from STATE_DIR.
 * - Removes gatekeeper-*.json and skill-catalog-*.json older than STALE_TTL_MS
 * - Also removes files not matching current sessionId older than SESSION_TTL_MS
 * @param {string} sessionId
 */
function clearStaleState(sessionId) {
  try {
    if (!fs.existsSync(STATE_DIR)) return;
    const entries = fs.readdirSync(STATE_DIR);
    const now = Date.now();

    for (const entry of entries) {
      const isGatekeeper = /^gatekeeper-.*\.json$/.test(entry);
      const isCatalog = /^skill-catalog-.*\.json$/.test(entry);
      if (!isGatekeeper && !isCatalog) continue;

      const filePath = path.join(STATE_DIR, entry);
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(raw);
        const ts = data.ts || 0;
        const age = now - ts;

        // Delete if older than 24 hours (absolute TTL)
        if (age > STALE_TTL_MS) {
          fs.unlinkSync(filePath);
          continue;
        }

        // Delete if not current session and older than 1 hour
        const fileSessionId = data.session_id;
        if (fileSessionId && fileSessionId !== sessionId && age > SESSION_TTL_MS) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // Silently continue on file-level errors
      }
    }
  } catch {
    // Silently continue on directory-level errors
  }
}

/**
 * Main entry point — SessionStart handler.
 */
function main() {
  let input = {};
  try {
    const raw = fs.readFileSync('/dev/stdin', 'utf8').trim();
    if (raw) input = JSON.parse(raw);
  } catch {
    // No stdin or invalid JSON — proceed with empty input
  }

  // Skip re-init on resume; state from the original session is still valid
  if (input.source === 'resume') process.exit(0);

  // Ensure STATE_DIR exists
  try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}

  // Clean up stale state files
  clearStaleState(input.session_id || 'default');

  // Scan skills and build catalog
  const skills = scanSkills(SKILLS_DIRS);
  const catalogString = buildCatalogString(skills);

  // Write catalog state file
  const catalogFile = path.join(STATE_DIR, `skill-catalog-${input.session_id || 'default'}.json`);
  fs.writeFileSync(catalogFile, JSON.stringify({
    catalog: catalogString,
    skills: skills.map(s => s.name),
    session_id: input.session_id,
    ts: Date.now(),
  }));

  process.exit(0);
}

try {
  main();
} catch (err) {
  process.stderr.write(`[gatekeeper-init] error: ${err.message}\n`);
  process.exit(0); // fail-open — session must not be blocked
}
