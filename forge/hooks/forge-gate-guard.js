#!/usr/bin/env node
/**
 * Forge Gate Guard — PreToolUse Hook (v7.0)
 *
 * Hard-blocks tool usage that violates pipeline state.
 * Reads .forge/pipeline-state.json for current state.
 * Exit(2) = hard block (Claude Code blocking error). Exit(0) = allow.
 *
 * 9 Gates:
 *   Gate 1: research.md must exist before plan.md creation [HARD BLOCK]
 *   Gate 2: plan_check PASS before source code edits [HARD BLOCK]
 *   Gate 2B: Bash file-writing commands on code files [HARD BLOCK]
 *   Gate 3: build/test must pass before git commit [HARD BLOCK]
 *   Gate 4: verification must exist before report.md creation [HARD BLOCK]
 *   Gate 5: Large change warning (>500 chars edit, >100 lines overwrite) [WARNING]
 *   Gate 6: Secret/credential detection in code content [HARD BLOCK]
 *
 * stdin: JSON { tool_name, tool_input, session_id }
 * stderr: blocking error messages (exit 2)
 * stdout: warning text (exit 0, non-blocking)
 */

const fs = require("fs");
const path = require("path");
const { CODE_EXTENSIONS, SKIP_PATHS, SENSITIVE_FILES, SAFE_BASH_COMMANDS, BASH_WRITE_PATTERNS } = require("./shared/constants");
const { findActivePipeline } = require("./shared/pipeline");

let CWD;
let FORGE_DIR;
const STATE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, ".claude", "hooks", "state");

// Secret/credential patterns for Gate 6
const SECRET_PATTERNS = [
  /(?:API_KEY|APIKEY|api_key)\s*[=:]\s*["']?[A-Za-z0-9_\-]{16,}/i,
  /(?:SECRET|secret_key|SECRET_KEY)\s*[=:]\s*["']?[A-Za-z0-9_\-]{16,}/i,
  /(?:PASSWORD|passwd|PASSWD)\s*[=:]\s*["']?[^\s"']{8,}/i,
  /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/,
  /(?:AKIA|ASIA)[A-Z0-9]{16}/,  // AWS access key
  /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/,
  /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/,  // GitHub token
  /sk-[A-Za-z0-9]{20,}/,  // OpenAI/Anthropic API key pattern
  /xox[bpsa]-[A-Za-z0-9\-]{10,}/,  // Slack token
  /AIza[A-Za-z0-9_\-]{35}/,  // Google API key
  /-----BEGIN OPENSSH PRIVATE KEY-----/,
  /sk_live_[A-Za-z0-9]{20,}/,  // Stripe live key
  /sk_test_[A-Za-z0-9]{20,}/,  // Stripe test key
  /rk_live_[A-Za-z0-9]{20,}/,  // Stripe restricted key
  /AC[a-z0-9]{32}/,  // Twilio Account SID
  /npm_[A-Za-z0-9]{36,}/,  // npm auth token
  /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/,  // MongoDB connection string with credentials
  /postgres(ql)?:\/\/[^:]+:[^@]+@/,  // PostgreSQL connection string
  /DefaultEndpointsProtocol=https;AccountName=/,  // Azure connection string
  // String concatenation patterns for split secrets
  /"sk-"\s*\+\s*"/,  // "sk-" + "abc..." split key
  /"(?:api[_-]?key|secret|token|password)"\s*[:=]\s*["'][^"']{4,}["']\s*\+\s*["']/i,  // key = "part1" + "part2"
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,  // JWT token (base64 header.payload)
  /CF[A-Za-z0-9_-]{37,}/,  // Cloudflare API token
  /heroku[A-Za-z0-9_\-]{30,}/i,  // Heroku API key
  /do[0-9a-f]{64}/,  // DigitalOcean token
  /jdbc:[a-z]+:\/\/[^:]+:[^@]+@/,  // JDBC connection string with credentials
];

const LARGE_EDIT_THRESHOLD = 500;  // characters
const LARGE_WRITE_THRESHOLD = 100; // lines

function isCodeFile(filePath) {
  if (!filePath) return false;
  for (const p of SKIP_PATHS) { if (filePath.includes(p)) return false; }
  return CODE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Detect the target file of a Bash write command.
 * Handles subshell wrappers (bash -c, sh -c, eval) by extracting the inner command.
 * Returns the cleaned target file path, or null if no write detected.
 */
function detectBashWriteTarget(cmd) {
  // Extract inner command from subshell/eval wrappers and re-scan
  const subshellMatch = cmd.match(/(?:bash|sh)\s+-c\s+(['"])([\s\S]*?)\1/) ||
                        cmd.match(/\beval\s+(['"])([\s\S]*?)\1/);
  const cmdsToScan = subshellMatch ? [cmd, subshellMatch[2]] : [cmd];

  for (const c of cmdsToScan) {
    for (const pattern of BASH_WRITE_PATTERNS) {
      const match = c.match(pattern);
      if (match) {
        // Heredoc pattern has target in group 2, dd/others in group 1
        const raw = match[2] || match[1];
        if (raw) return raw.replace(/["']/g, "");
      }
    }
  }
  return null;
}

function findPipelineState() {
  const result = findActivePipeline(FORGE_DIR);
  return result ? result.state : null;
}

function findArtifactDir(state) {
  if (state && state.artifact_dir) {
    const fullPath = path.join(CWD, state.artifact_dir);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

function artifactExists(artifactDir, filename) {
  if (!artifactDir) return false;
  const filePath = path.join(artifactDir, filename);
  try {
    const stat = fs.statSync(filePath);
    return stat.size > 10; // Must have actual content, not just empty
  } catch { return false; }
}


function writeAuditLog(gate, tool, file, sessionId) {
  try {
    const auditPath = path.join(FORGE_DIR, "gate-guard-audit.jsonl");
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      gate: gate,
      tool: tool,
      file: file || "",
      session_id: sessionId || ""
    }) + "\n";
    fs.appendFileSync(auditPath, entry);
    // Trim to 100 lines max — atomic write via .tmp + rename
    try {
      const content = fs.readFileSync(auditPath, "utf8");
      const lines = content.trim().split("\n");
      if (lines.length > 100) {
        const tmpPath = auditPath + ".tmp." + process.pid;
        fs.writeFileSync(tmpPath, lines.slice(-100).join("\n") + "\n");
        fs.renameSync(tmpPath, auditPath);
      }
    } catch {}
  } catch {}
}

function main() {
  let input;
  let toolName, toolInput;
  let state, artifactDir, currentStep, stepOrder;
  let isMcpExec = false;

  try {
    const raw = fs.readFileSync(0, "utf8").trim();
    if (!raw) { process.exit(0); }
    input = JSON.parse(raw);
    if (!input.tool_name) { process.exit(0); }

    CWD = input.cwd || process.cwd();
    FORGE_DIR = path.join(CWD, ".forge");

    toolName = input.tool_name;
    toolInput = input.tool_input || {};

    // Only check tools that can modify files
    const CHECKED_TOOLS = ["Edit", "Write", "Bash", "NotebookEdit"];
    isMcpExec = toolName.startsWith("mcp__") && (toolName.includes("execute") || toolName.includes("write") || toolName.includes("edit"));
    if (!CHECKED_TOOLS.includes(toolName) && !isMcpExec) { process.exit(0); }

    state = findPipelineState();

    // If no active pipeline, block ALL code file edits (Edit/Write + Bash + MCP execute)
    if (!state) {
      // FBP-6: Block MCP execution tools without pipeline
      if (isMcpExec) {
        process.stderr.write(
          `🚫 FORGE GATE BLOCKED: Cannot use ${toolName} without an active forge pipeline.\n` +
          "Start a pipeline first: /forge --trivial, --quick, or /forge"
        );
        writeAuditLog("No Pipeline MCP", toolName, "", input.session_id);
        process.exit(2);
      }
      if (["Edit", "Write", "NotebookEdit"].includes(toolName)) {
        const filePath = toolInput.file_path || "";
        if (isCodeFile(filePath)) {
          process.stderr.write(
            "🚫 FORGE GATE BLOCKED: Cannot edit code without an active forge pipeline.\n" +
            "Start a pipeline first:\n" +
            "  /forge --trivial  (한 줄 수정: 오타, 변수명, import)\n" +
            "  /forge --quick    (소규모 변경: 단일 파일, ≤50줄)\n" +
            "  /forge            (표준 파이프라인: 기능 추가/수정)\n" +
            "This gate ensures all code changes go through the forge quality pipeline."
          );
          writeAuditLog("No Pipeline", toolName, filePath, input.session_id);
          process.exit(2);
        }
      }
      // FBP-8 fix: Also check Bash file-writing commands without pipeline
      if (toolName === "Bash") {
        const cmd = toolInput.command || "";
        if (!SAFE_BASH_COMMANDS.test(cmd)) {
          const targetFile = detectBashWriteTarget(cmd);
          if (targetFile && isCodeFile(targetFile)) {
            process.stderr.write(
              `🚫 FORGE GATE BLOCKED: Bash writes to code file "${path.basename(targetFile)}" without active pipeline.\n` +
              "Start a forge pipeline first: /forge --trivial, --quick, or /forge"
            );
            writeAuditLog("No Pipeline Bash", toolName, targetFile, input.session_id);
            process.exit(2);
          }
        }
      }
      // Gate 6 pre-check: block sensitive files even without pipeline
      if (["Edit", "Write"].includes(toolName)) {
        const filePath = toolInput.file_path || "";
        const basename = path.basename(filePath);
        if (SENSITIVE_FILES.includes(basename)) {
          const SAFE_SENSITIVE = [".env.example", ".env.template", ".env.sample"];
          if (!SAFE_SENSITIVE.includes(basename)) {
            process.stderr.write(
              `🚫 GATE 6 BLOCKED: Cannot write to sensitive file "${basename}" — no pipeline active.\n` +
              "Use environment variables or a secrets manager instead."
            );
            writeAuditLog("Gate 6 No-Pipeline", toolName, filePath, input.session_id);
            process.exit(2);
          }
        }
      }
      process.exit(0);
    }

    artifactDir = findArtifactDir(state);
    currentStep = state.current_step;
    stepOrder = state.current_step_order || 0;

  } catch (err) {
    // Fail-closed: if we can't parse input, block the action (security gates must not be bypassed)
    process.stderr.write("forge-gate-guard: input parse error — blocking for safety: " + (err.message || "") + "\n");
    process.exit(2);
  }

  // === GATE 1: research.md must exist before plan.md ===
  try {
    if (toolName === "Write") {
      const filePath = toolInput.file_path || "";
      const basename = path.basename(filePath);
      if (basename === "plan.md" && (filePath.includes(".forge/") || (artifactDir && filePath.startsWith(artifactDir)))) {
        if (!artifactExists(artifactDir, "research.md")) {
          // Check if research is skipped via pipeline flags
          const skipped = state.skipped_steps || [];
          if (!skipped.includes("research")) {
            process.stderr.write(
              "🚫 GATE 1 BLOCKED: Cannot create plan.md — research.md does not exist.\n" +
              "Complete research first, or use --direct to skip.\n" +
              "Run: node forge-tools.js engine-transition <artifact-dir> research"
            );
            writeAuditLog("Gate 1", toolName, filePath, input.session_id);
            process.exit(2);
          }
        }
      }
    }
  } catch (err) {
    process.stderr.write("forge-gate-guard: Gate 1 error: " + err.message + "\n");
    process.exit(2);
  }

  // === GATE 2: plan_check PASS before source code edits ===
  try {
    if (["Edit", "Write"].includes(toolName)) {
      const filePath = toolInput.file_path || "";
      if (isCodeFile(filePath)) {
        // Allow if step is execute (7) or later
        const allowedSteps = ["execute", "verify", "finalize", "completed", "cleanup"];
        if (!allowedSteps.includes(currentStep)) {
          process.stderr.write(
            `🚫 GATE 2 BLOCKED: Cannot edit source code at step "${currentStep}" (order ${stepOrder}).\n` +
            `Code edits are only allowed at step 7 (execute) or later.\n` +
            `Current pipeline state requires: ${state.gates_pending?.join(", ") || "complete earlier steps"}`
          );
          writeAuditLog("Gate 2", toolName, filePath, input.session_id);
          process.exit(2);
        }
      }
    }
  } catch (err) {
    process.stderr.write("forge-gate-guard: Gate 2 error: " + err.message + "\n");
    process.exit(2);
  }

  // === GATE 2B: Bash file-writing commands on code files ===
  try {
    if (toolName === "Bash") {
      const cmd = toolInput.command || "";
      // Skip known safe commands
      if (!SAFE_BASH_COMMANDS.test(cmd)) {
        const targetFile = detectBashWriteTarget(cmd);
        if (targetFile && isCodeFile(targetFile)) {
          const allowedSteps = ["execute", "verify", "finalize", "completed", "cleanup"];
          if (!allowedSteps.includes(currentStep)) {
            process.stderr.write(
              `🚫 GATE 2B BLOCKED: Bash writes to code file "${path.basename(targetFile)}" at step "${currentStep}".\n` +
              "Code file writes are only allowed at step 7 (execute) or later."
            );
            writeAuditLog("Gate 2B", toolName, targetFile, input.session_id);
            process.exit(2);
          }
        }
      }
    }
  } catch (err) {
    process.stderr.write("forge-gate-guard: Gate 2B error: " + err.message + "\n");
    process.exit(2);
  }

  // === GATE 3: build/test pass before git commit ===
  try {
    if (toolName === "Bash") {
      const cmd = toolInput.command || "";
      if (cmd.match(/\bgit\b.*\bcommit\b/)) {
        const lastBuild = state.last_build_result;
        const lastTest = state.last_test_result;

        if (lastBuild === "fail") {
          process.stderr.write(
            "🚫 GATE 3 BLOCKED: Cannot git commit — last build FAILED.\n" +
            "Fix build errors first, then re-run: node forge-tools.js engine-verify-build <artifact-dir> <command>"
          );
          writeAuditLog("Gate 3", toolName, "", input.session_id);
          process.exit(2);
        }
        if (lastTest === "fail") {
          process.stderr.write(
            "🚫 GATE 3 BLOCKED: Cannot git commit — last test run FAILED.\n" +
            "Fix failing tests first, then re-run: node forge-tools.js engine-verify-tests <artifact-dir> <command>"
          );
          writeAuditLog("Gate 3", toolName, "", input.session_id);
          process.exit(2);
        }
      }
    }
  } catch (err) {
    process.stderr.write("forge-gate-guard: Gate 3 error: " + err.message + "\n");
    process.exit(2);
  }

  // === GATE 7: VPM verification before git push / gh pr create ===
  try {
    if (toolName === "Bash" || isMcpExec) {
      const cmd = toolInput.command || toolInput.code || "";
      const isPushCmd = cmd.match(/\bgit\b[\s\S]*\bpush\b/) && !cmd.match(/\bgit\s+stash\s+push\b/);
      const isGhPrCmd = cmd.match(/\bgh\b.*\bpr\b.*\b(create|push)\b/);

      if (isPushCmd || isGhPrCmd) {
        if (state) {
          const pipelineType = state.pipeline || "standard";
          const taskType = state.type || "";
          const EXEMPT_PIPELINES = ["trivial"];
          const EXEMPT_TYPES = ["analysis", "analysis-security", "design", "docs"];
          const isExempt = EXEMPT_PIPELINES.includes(pipelineType)
            || EXEMPT_TYPES.includes(taskType)
            || (state.skipped_steps || []).includes("verify");

          if (!isExempt) {
            const gatesPassed = state.gates_passed || [];
            const hasVerifiedGate = gatesPassed.includes("verified");

            // Dual verification: gates_passed + verification.md content check
            let hasValidVerification = false;
            if (artifactDir) {
              const vPath = path.join(artifactDir, "verification.md");
              try {
                const vContent = fs.readFileSync(vPath, "utf8");
                hasValidVerification = vContent.length > 200 && vContent.includes("## Verdict");
              } catch {}
            }

            if (!hasVerifiedGate || !hasValidVerification) {
              const reasons = [];
              if (!hasVerifiedGate) reasons.push("VPM verification not completed (\"verified\" not in gates_passed)");
              if (!hasValidVerification) reasons.push("verification.md missing or incomplete (need ## Verdict + >200 bytes)");
              process.stderr.write(
                "GATE 7 BLOCKED: Cannot push — VPM verification not completed.\n" +
                reasons.join("\n") + "\n" +
                "Complete verification: engine-transition <dir> verify → dispatch verification-pm\n"
              );
              writeAuditLog("Gate 7", toolName, "", input?.session_id);
              process.exit(2);
            }
          }
        }
        // No active pipeline (state===null) → allow push (completed pipeline or non-forge project)
      }
    }
  } catch (err) {
    process.stderr.write("forge-gate-guard: Gate 7 error: " + err.message + "\n");
    process.exit(2);
  }

  // === GATE 4: verification before report.md ===
  try {
    if (toolName === "Write") {
      const filePath = toolInput.file_path || "";
      const basename = path.basename(filePath);
      if (basename === "report.md" && (filePath.includes(".forge/") || (artifactDir && filePath.startsWith(artifactDir)))) {
        if (!artifactExists(artifactDir, "verification.md")) {
          const skipped = state.skipped_steps || [];
          if (!skipped.includes("verify")) {
            process.stderr.write(
              "🚫 GATE 4 BLOCKED: Cannot create report.md — verification.md does not exist.\n" +
              "Complete verification first.\n" +
              "Run: node forge-tools.js engine-transition <artifact-dir> verify"
            );
            writeAuditLog("Gate 4", toolName, filePath, input.session_id);
            process.exit(2);
          }
        }
      }
    }
  } catch (err) {
    process.stderr.write("forge-gate-guard: Gate 4 error: " + err.message + "\n");
    process.exit(2);
  }

  // === GATE 5: Large change warning ===
  try {
    if (toolName === "Edit") {
      const oldString = toolInput.old_string || "";
      if (oldString.length > LARGE_EDIT_THRESHOLD) {
        process.stdout.write(
          `⚠ LARGE EDIT WARNING: Replacing ${oldString.length} characters. ` +
          `This is a significant change. Verify it's intentional.`
        );
        // Warning only, not a block
      }
    }
    if (toolName === "Write") {
      const filePath = toolInput.file_path || "";
      if (filePath && !filePath.includes(".forge/")) {
        try {
          if (fs.existsSync(filePath)) {
            const existing = fs.readFileSync(filePath, "utf8");
            const existingLines = existing.split("\n").length;
            if (existingLines > LARGE_WRITE_THRESHOLD) {
              process.stdout.write(
                `⚠ LARGE OVERWRITE WARNING: Replacing ${existingLines}-line file ${path.basename(filePath)}. ` +
                `Consider using Edit for targeted changes instead.`
              );
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    // Gate 5 is warning-only, fail-open
  }

  // === GATE 5T: Trivial pipeline line limit (per-edit + cumulative) ===
  try {
    if (state && state.pipeline === "trivial" && toolName === "Edit") {
      const oldStr = toolInput.old_string || "";
      const newStr = toolInput.new_string || "";
      const maxLines = Math.max(oldStr.split("\n").length, newStr.split("\n").length);
      const TRIVIAL_PER_EDIT_LIMIT = 3;
      const TRIVIAL_CUMULATIVE_LIMIT = 10;

      // Per-edit limit
      if (maxLines > TRIVIAL_PER_EDIT_LIMIT) {
        process.stderr.write(
          `🚫 GATE 5T BLOCKED: Trivial pipeline allows max ${TRIVIAL_PER_EDIT_LIMIT} lines per edit (got ${maxLines}).\n` +
          "For larger changes, use:\n" +
          "  /forge --quick    (단일 파일, ≤50줄)\n" +
          "  /forge            (표준 파이프라인)"
        );
        writeAuditLog("Gate 5T", toolName, "", input.session_id);
        process.exit(2);
      }

      // Cumulative limit — track total lines edited in this trivial session
      const cumulativeTotal = (state.trivial_edit_lines || 0) + maxLines;
      if (cumulativeTotal > TRIVIAL_CUMULATIVE_LIMIT) {
        process.stderr.write(
          `🚫 GATE 5T BLOCKED: Trivial pipeline cumulative limit exceeded (${cumulativeTotal}/${TRIVIAL_CUMULATIVE_LIMIT} lines).\n` +
          "This change is too large for --trivial. Use:\n" +
          "  /forge --quick    (단일 파일, ≤50줄)\n" +
          "  /forge            (표준 파이프라인)"
        );
        writeAuditLog("Gate 5T-cumul", toolName, "", input.session_id);
        process.exit(2);
      }

      // Update cumulative count in pipeline-state.json
      try {
        const artifactDir = findArtifactDir(state);
        if (artifactDir) {
          const statePath = path.join(artifactDir, "pipeline-state.json");
          state.trivial_edit_lines = cumulativeTotal;
          fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
        }
      } catch {}
    }
  } catch (err) {
    process.stderr.write("forge-gate-guard: Gate 5T error: " + err.message + "\n");
    process.exit(2);
  }

  // === GATE 6: Secret/credential detection — ISOLATED (fail-closed) ===
  // Separate try-catch so upstream parse errors cannot disable secret detection
  try {
    if (!input) { process.exit(0); }
    const toolName6 = input.tool_name;
    const toolInput6 = input.tool_input || {};

    if (["Edit", "Write", "NotebookEdit"].includes(toolName6)) {
      const content = toolInput6.new_string || toolInput6.content || "";
      const filePath6 = toolInput6.file_path || "";
      const basename = path.basename(filePath6);

      // Check for sensitive file names
      if (SENSITIVE_FILES.includes(basename)) {
        // Allow template/example files
        const SAFE_SENSITIVE = [".env.example", ".env.template", ".env.sample"];
        if (SAFE_SENSITIVE.includes(basename)) {
          process.stdout.write(
            `⚠ SENSITIVE TEMPLATE: Writing to ${basename}. Ensure no real credentials.`
          );
        } else {
          writeAuditLog("Gate 6 Sensitive", toolName6, filePath6, input?.session_id);
          process.stderr.write(
            `🚫 GATE 6 BLOCKED: Cannot write to sensitive file "${basename}".\n` +
            `Use environment variables or a secrets manager instead.\n` +
            `Allowed: .env.example, .env.template, .env.sample`
          );
          process.exit(2);
        }
      }

      // Check content for secret patterns — HARD BLOCK
      if (content.length > 0) {
        for (const pattern of SECRET_PATTERNS) {
          if (pattern.test(content)) {
            process.stderr.write(
              `🚫 GATE 6 BLOCKED: Detected potential secret/credential in content.\n` +
              `Pattern matched: ${pattern.toString().slice(0, 60)}...\n` +
              `DO NOT hardcode secrets. Use environment variables or a secrets manager.\n` +
              `If this is a false positive (e.g., example/placeholder), note it in your response.`
            );
            writeAuditLog("Gate 6", toolName6, filePath6, input?.session_id);
            process.exit(2);
          }
        }
      }
    }

    // Gate 6: also scan Bash commands for secrets
    if (toolName6 === "Bash") {
      const command = toolInput6.command || "";
      if (command.length > 0) {
        for (const pattern of SECRET_PATTERNS) {
          if (pattern.test(command)) {
            process.stderr.write(
              `🚫 GATE 6 BLOCKED: Detected potential secret/credential in Bash command.\n` +
              `Pattern matched: ${pattern.toString().slice(0, 60)}...\n` +
              `DO NOT hardcode secrets in commands. Use environment variables.\n` +
              `If this is a false positive (e.g., example/placeholder), note it in your response.`
            );
            writeAuditLog("Gate 6", toolName6, "", input?.session_id);
            process.exit(2);
          }
        }
      }
    }
  } catch (err) {
    process.stderr.write("forge-gate-guard: Gate 6 error: " + err.message + "\n");
    process.exit(2);
  }
  process.exit(0);
}

main();
