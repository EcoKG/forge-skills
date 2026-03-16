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

function forgeWasInvoked(sessionId) {
  try {
    return JSON.parse(fs.readFileSync(path.join("/tmp", `forge-invoked-${sessionId || "default"}.json`), "utf8")).invoked === true;
  } catch { return false; }
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
