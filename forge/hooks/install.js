#!/usr/bin/env node

/**
 * Forge Hooks Installer
 *
 * Registers Forge hooks into the user's ~/.claude/settings.json
 * Run: node ~/.claude/skills/forge/hooks/install.js
 * Or triggered by: /forge --init (project initialization)
 *
 * Hooks installed:
 *   1. forge-context-monitor (PostToolUse) — context pressure warnings
 *   2. forge-statusline (Notification) — project status in statusline
 *   3. forge-session-init (UserPromptSubmit) — session continuity
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
  {
    event: "PostToolUse",
    id: "forge-context-monitor",
    script: path.join(HOOKS_DIR, "forge-context-monitor.js"),
    description: "Forge: monitors context window usage and injects warnings",
  },
  {
    event: "Notification",
    id: "forge-statusline",
    script: path.join(HOOKS_DIR, "forge-statusline.js"),
    description: "Forge: displays project/phase status in statusline",
  },
  {
    event: "UserPromptSubmit",
    id: "forge-session-init",
    script: path.join(HOOKS_DIR, "forge-session-init.js"),
    description: "Forge: detects existing project on session start",
  },
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

  let installed = 0;
  let skipped = 0;

  for (const hook of FORGE_HOOKS) {
    if (!settings.hooks[hook.event]) {
      settings.hooks[hook.event] = [];
    }

    // Check if already installed
    const existing = settings.hooks[hook.event].find(
      (h) =>
        h.command &&
        h.command.includes(hook.id)
    );

    if (existing) {
      console.log(`  ⏭ ${hook.id} — already installed`);
      skipped++;
      continue;
    }

    settings.hooks[hook.event].push({
      command: `node "${hook.script}"`,
      description: hook.description,
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
        (h) => !h.command || !h.command.includes(hook.id)
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
