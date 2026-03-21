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
 *   4. forge-gate-guard (PreToolUse) — 9 gates — 8 hard blocks + 1 warning
 *   5. gatekeeper-init (SessionStart) — skill catalog + state initialization
 *   6. gatekeeper-router (UserPromptSubmit) — intent classification + skill routing
 */

const fs = require("fs");
const path = require("path");

const SETTINGS_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".claude",
  "settings.json"
);

// Auto-detect script directory (works from any cwd)
const HOOKS_DIR = __dirname;
const FRAMEWORK_DIR = path.dirname(HOOKS_DIR); // forge-framework/
const SKILLS_DIR = path.join(FRAMEWORK_DIR, 'skills'); // forge-framework/skills/

const FORGE_HOOKS = [
  // v7.0 Bastion hooks
  {
    event: "PostToolUse",
    id: "tracker",
    script: path.join(HOOKS_DIR, "tracker.js"),
    timeout: 30,
    description: "Forge v7.0: context monitor + agent dispatch tracker + build/test detector",
  },
  {
    event: "Notification",
    id: "statusline",
    script: path.join(HOOKS_DIR, "statusline.js"),
    timeout: 5,
    description: "Forge: displays project/phase status in statusline",
  },
  {
    event: "UserPromptSubmit",
    id: "orchestrator",
    script: path.join(HOOKS_DIR, "orchestrator.js"),
    timeout: 5,
    description: "Forge v7.0: pipeline state injection + crash recovery + project context",
  },
  {
    event: "PreToolUse",
    id: "gate-guard",
    script: path.join(HOOKS_DIR, "gate-guard.js"),
    matcher: "",
    timeout: 10,
    description: "Forge v8.0: 9 gates — 8 hard blocks + 1 warning + Gatekeeper-aware",
  },
  {
    event: "SessionStart",
    id: "gatekeeper-init",
    script: path.join(HOOKS_DIR, "gatekeeper-init.js"),
    timeout: 5,
    description: "Forge v8.0: skill catalog scan + state initialization on session start",
  },
  {
    event: "UserPromptSubmit",
    id: "gatekeeper-router",
    script: path.join(HOOKS_DIR, "gatekeeper-router.js"),
    timeout: 5,
    description: "Forge v8.0: intent classification + skill routing (replaces activation system)",
  },
];

// Old hooks to clean up during install (replaced by v7.0 hooks)
const LEGACY_HOOKS = [
  "forge-context-monitor",
  "forge-session-init",
  "forge-pretool-gate",
  // v7.0 activation system (replaced by v8.0 Gatekeeper)
  "skill-activation-guard",
  "skill-activation",
  "skill-activation-stop",
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

  // Clean up legacy hooks (replaced by v7.0)
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
          console.log(`  🔄 ${legacyId} — replaced by v7.0 hook`);
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

    // Remove any existing entry for this hook (ensures upgrade replaces old config)
    const beforeLen = settings.hooks[hook.event].length;
    settings.hooks[hook.event] = settings.hooks[hook.event].filter(
      (entry) =>
        !(entry.hooks?.some((h) => h.command?.includes(hook.id))) &&
        !(entry.command && entry.command.includes(hook.id))
    );
    if (beforeLen > settings.hooks[hook.event].length) {
      console.log(`  🔄 ${hook.id} — upgrading (replacing old entry)`);
    }

    // Use `node` (PATH-resolved) instead of hardcoded binary path.
    // This survives nvm version changes and cross-machine installs.
    settings.hooks[hook.event].push({
      matcher: hook.matcher || "",
      hooks: [
        {
          type: "command",
          command: `node "${hook.script}"`,
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
  console.log(`\nInstalled to: ${HOOKS_DIR}`);
  console.log(`Framework:    ${FRAMEWORK_DIR}`);
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

function verify() {
  const settings = readSettings();
  let ok = 0;
  let fail = 0;

  for (const hook of FORGE_HOOKS) {
    const entries = settings.hooks?.[hook.event] || [];
    const found = entries.some(
      (entry) => entry.hooks?.some((h) => h.command?.includes(hook.id))
    );
    if (found) {
      // Check script exists on disk
      if (fs.existsSync(hook.script)) {
        console.log(`  ✅ ${hook.id} — registered + script exists`);
        ok++;
      } else {
        console.log(`  ❌ ${hook.id} — registered but script MISSING: ${hook.script}`);
        fail++;
      }
    } else {
      console.log(`  ❌ ${hook.id} — NOT registered in settings.json`);
      fail++;
    }
  }

  console.log(`\nVerify: ${ok} OK, ${fail} FAILED`);
  if (fail > 0) {
    console.log("Run: node install.js  (to fix)");
    process.exit(1);
  }
}

// CLI
const action = process.argv[2] || "install";

const labels = { install: "Installer", uninstall: "Uninstaller", verify: "Verifier" };
console.log(`\nForge Hooks ${labels[action] || "Installer"}`);
console.log("─".repeat(40));

if (action === "uninstall") {
  uninstall();
} else if (action === "verify") {
  verify();
} else {
  install();
}
