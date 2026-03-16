/**
 * Forge PreToolUse Gate — Pre-edit checkpoint
 *
 * Checks if the current tool use (Edit, Write, Bash) is happening
 * on a code file WITHOUT forge skill having been invoked first.
 *
 * This is the last line of defense: even if UserPromptSubmit hook
 * was ignored, this hook fires BEFORE every tool use.
 *
 * Trigger: PreToolUse
 * Matcher: Edit, Write, Bash
 */

const fs = require("fs");
const path = require("path");

// Code file extensions that should trigger forge
const CODE_EXTENSIONS = new Set([
  ".js", ".ts", ".jsx", ".tsx", ".py", ".go", ".rs", ".java",
  ".c", ".cpp", ".h", ".hpp", ".cs", ".rb", ".php", ".swift",
  ".kt", ".scala", ".ex", ".exs", ".vue", ".svelte",
]);

// Files that are NOT code (forge artifacts, configs, etc.)
const SKIP_PATTERNS = [
  ".forge/",
  "node_modules/",
  "package-lock.json",
  "yarn.lock",
  ".git/",
  "CLAUDE.md",
];

function isCodeFile(filePath) {
  if (!filePath) return false;

  // Skip non-code paths
  for (const pattern of SKIP_PATTERNS) {
    if (filePath.includes(pattern)) return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  return CODE_EXTENSIONS.has(ext);
}

function forgeWasInvoked(sessionId) {
  // Check if forge skill was invoked in this session
  // The skill-activation hook writes a state file when forge is suggested
  const stateFile = path.join("/tmp", `forge-invoked-${sessionId || "default"}.json`);
  try {
    const data = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    return data.invoked === true;
  } catch {
    return false;
  }
}

module.exports = async ({ tool_name, tool_input, session_id }) => {
  // Only check Edit, Write, Bash
  if (!["Edit", "Write", "Bash"].includes(tool_name)) {
    return {};
  }

  // For Bash, check if it's running a code-modifying command
  if (tool_name === "Bash") {
    const cmd = tool_input?.command || "";
    // Only flag if bash is doing code generation (sed, awk on code files, etc.)
    // Most bash commands are fine (git, npm, ls, etc.)
    if (!cmd.includes("sed ") && !cmd.includes("awk ") && !cmd.includes("cat >") && !cmd.includes("echo >")) {
      return {};
    }
  }

  // For Edit/Write, check the file path
  const filePath = tool_input?.file_path || tool_input?.path || "";

  if (tool_name === "Edit" || tool_name === "Write") {
    if (!isCodeFile(filePath)) {
      return {}; // Not a code file, allow
    }
  }

  // If forge was already invoked this session, allow
  if (forgeWasInvoked(session_id)) {
    return {};
  }

  // Code file being edited without forge — inject warning
  return {
    additionalContext: [
      "⚠️ FORGE GATE: You are about to edit a code file without invoking the forge skill.",
      "Per CLAUDE.md rules, code modifications that involve implementation, bug fixes,",
      "refactoring, or multi-file changes MUST go through the forge pipeline.",
      "",
      "If this edit is part of a forge pipeline execution, ignore this warning.",
      "If not, consider: should you invoke Skill('forge') first?",
    ].join("\n"),
  };
};
