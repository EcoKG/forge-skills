#!/usr/bin/env node

/**
 * Forge Hooks Installer
 *
 * Registers Forge hooks into the user's ~/.claude/settings.json
 * Run: node ~/.claude/skills/forge/hooks/install.js
 * Or triggered by: /forge --init (project initialization)
 *
 * Hooks installed:
 *   1. forge-tracker (PostToolUse) — context + agent + build/test tracking
 *   2. forge-statusline (Notification) — project status in statusline
 *   3. forge-orchestrator (UserPromptSubmit) — pipeline state injection
 *   4. forge-gate-guard (PreToolUse) — 6 gates — 5 hard blocks + 1 warning
 */

const fs = require("fs");
const path = require("path");

const SETTINGS_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".claude",
  "settings.json"
);

const HOOKS_DIR = path.dirname(__filename);

const FORGE_HOOKS = [
  // v6.0 Ironclad hooks
  {
    event: "PostToolUse",
    id: "forge-tracker",
    script: path.join(HOOKS_DIR, "forge-tracker.js"),
    timeout: 30,
    description: "Forge v6: context monitor + agent dispatch tracker + build/test detector",
  },
  {
    event: "Notification",
    id: "forge-statusline",
    script: path.join(HOOKS_DIR, "forge-statusline.js"),
    timeout: 5,
    description: "Forge: displays project/phase status in statusline",
  },
  {
    event: "UserPromptSubmit",
    id: "forge-orchestrator",
    script: path.join(HOOKS_DIR, "forge-orchestrator.js"),
    timeout: 5,
    description: "Forge v6: pipeline state injection + crash recovery + project context",
  },
  {
    event: "PreToolUse",
    id: "forge-gate-guard",
    script: path.join(HOOKS_DIR, "forge-gate-guard.js"),
    matcher: "Edit|Write|Bash",
    timeout: 10,
    description: "Forge v6: 6 gates — 5 hard blocks + 1 warning",
  },
];

// Old hooks to clean up during install (replaced by v6 hooks)
const LEGACY_HOOKS = [
  "forge-context-monitor",
  "forge-session-init",
  "forge-pretool-gate",
];

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeSettings(settings) {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
}

function install() {
  const settings = readSettings();

  if (!settings.hooks) {
    settings.hooks = {};
  }

  // Clean up legacy hooks (replaced by v6.0)
  for (const legacyId of LEGACY_HOOKS) {
    for (const event of Object.keys(settings.hooks || {})) {
      if (settings.hooks[event]) {
        const before = settings.hooks[event].length;
        settings.hooks[event] = settings.hooks[event].filter(
          (entry) =>
            !(entry.hooks?.some((h) => h.command?.includes(legacyId))) &&
            !(entry.command && entry.command.includes(legacyId))
        );
        if (before > settings.hooks[event].length) {
          console.log(`  🔄 ${legacyId} — replaced by v6.0 hook`);
        }
      }
    }
  }

  let installed = 0;
  let skipped = 0;

  for (const hook of FORGE_HOOKS) {
    if (!settings.hooks[hook.event]) {
      settings.hooks[hook.event] = [];
    }

    // Check if already installed (search in nested hooks format)
    const existing = settings.hooks[hook.event].find(
      (entry) =>
        entry.hooks?.some((h) => h.command?.includes(hook.id)) ||
        (entry.command && entry.command.includes(hook.id))
    );

    if (existing) {
      console.log(`  ⏭ ${hook.id} — already installed`);
      skipped++;
      continue;
    }

    // Use correct Claude Code hook format: {matcher, hooks: [...]}
    // Quote paths to handle spaces in Windows/WSL paths
    const nodeBin = process.execPath;
    settings.hooks[hook.event].push({
      matcher: hook.matcher || "",
      hooks: [
        {
          type: "command",
          command: `"${nodeBin}" "${hook.script}"`,
          timeout: hook.timeout || 5,
        },
      ],
    });

    console.log(`  ✅ ${hook.id} — installed (${hook.event})`);
    installed++;
  }

  if (installed > 0) {
    writeSettings(settings);
  }

  console.log(
    `\nDone: ${installed} installed, ${skipped} skipped (already present)`
  );
  return { installed, skipped };
}

function uninstall() {
  const settings = readSettings();

  if (!settings.hooks) {
    console.log("No hooks found in settings.");
    return;
  }

  let removed = 0;

  for (const hook of FORGE_HOOKS) {
    if (settings.hooks[hook.event]) {
      const before = settings.hooks[hook.event].length;
      settings.hooks[hook.event] = settings.hooks[hook.event].filter(
        (entry) =>
          !(entry.hooks?.some((h) => h.command?.includes(hook.id))) &&
          !(entry.command && entry.command.includes(hook.id))
      );
      const after = settings.hooks[hook.event].length;

      if (before > after) {
        console.log(`  🗑 ${hook.id} — removed`);
        removed++;
      }

      // Clean up empty arrays
      if (settings.hooks[hook.event].length === 0) {
        delete settings.hooks[hook.event];
      }
    }
  }

  if (removed > 0) {
    writeSettings(settings);
  }

  console.log(`\nDone: ${removed} removed`);
}

// CLI
const action = process.argv[2] || "install";

console.log(`\nForge Hooks ${action === "uninstall" ? "Uninstaller" : "Installer"}`);
console.log("─".repeat(40));

if (action === "uninstall") {
  uninstall();
} else {
  install();
}
