#!/usr/bin/env node
/**
 * Forge PreToolUse Gate — Pre-edit checkpoint
 *
 * Checks if Edit/Write/Bash is happening on a code file
 * without forge skill having been invoked first.
 *
 * stdin: JSON { tool_name, tool_input, session_id }
 * stdout: text warning (or empty)
 */

const fs = require("fs");
const path = require("path");

const CODE_EXTENSIONS = new Set([
  ".js", ".ts", ".jsx", ".tsx", ".py", ".go", ".rs", ".java",
  ".c", ".cpp", ".h", ".hpp", ".cs", ".rb", ".php", ".swift",
  ".kt", ".scala", ".ex", ".exs", ".vue", ".svelte",
]);

const SKIP_PATTERNS = [".forge/", "node_modules/", "package-lock.json", "yarn.lock", ".git/", "CLAUDE.md"];

function isCodeFile(filePath) {
  if (!filePath) return false;
  for (const p of SKIP_PATTERNS) { if (filePath.includes(p)) return false; }
  return CODE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

const STATE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, ".claude", "hooks", "state");
try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch {}

function forgeWasInvoked(sessionId) {
  // Check 1: explicit flag file (set by forge execution flow)
  const flagFile = path.join(STATE_DIR, `forge-invoked-${sessionId || "default"}.json`);
  try {
    const data = JSON.parse(fs.readFileSync(flagFile, "utf8"));
    if (data.invoked === true) return true;
  } catch {}

  // Check 2: recent .forge/ activity (within last 60 minutes)
  const cwd = process.cwd();
  const forgeDir = path.join(cwd, ".forge");
  try {
    const entries = fs.readdirSync(forgeDir);
    for (const entry of entries) {
      const stat = fs.statSync(path.join(forgeDir, entry));
      if (Date.now() - stat.mtimeMs < 3600000) return true; // modified in last hour
    }
  } catch {}

  return false;
}

function main() {
  try {
    const raw = fs.readFileSync(0, "utf8").trim();
    if (!raw) { process.exit(0); }
    const input = JSON.parse(raw);

    const toolName = input.tool_name;
    if (!["Edit", "Write", "Bash"].includes(toolName)) { process.exit(0); }

    if (toolName === "Bash") {
      const cmd = input.tool_input?.command || "";
      if (!cmd.includes("sed ") && !cmd.includes("awk ") && !cmd.includes("cat >") && !cmd.includes("echo >")) {
        process.exit(0);
      }
    }

    if (toolName === "Edit" || toolName === "Write") {
      const filePath = input.tool_input?.file_path || "";
      if (!isCodeFile(filePath)) { process.exit(0); }
    }

    if (forgeWasInvoked(input.session_id)) { process.exit(0); }

    process.stdout.write(
      "⚠️ FORGE GATE: You are about to edit a code file without invoking the forge skill.\n" +
      "Per CLAUDE.md rules, code modifications MUST go through the forge pipeline.\n" +
      "If this edit is part of a forge execution, ignore this warning.\n" +
      "If not, consider: should you invoke Skill('forge') first?"
    );
  } catch {}
  process.exit(0);
}

main();
