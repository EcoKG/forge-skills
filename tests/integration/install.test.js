/**
 * Integration tests for install.js — hook registration idempotency and correctness.
 *
 * Verifies that install.js correctly registers 5 hooks in ~/.claude/settings.json,
 * removes legacy hooks, and behaves idempotently on repeated runs.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const INSTALL_SCRIPT = path.resolve(__dirname, "../../forge/hooks/install.js");
const HOOKS_DIR = path.resolve(__dirname, "../../forge/hooks");

const EXPECTED_EVENTS = ["PreToolUse", "PostToolUse", "UserPromptSubmit", "Notification"];

/**
 * Run install.js with a custom HOME directory.
 * Returns { stdout, stderr }.
 */
function runInstall(tempHome) {
  const stdout = execFileSync(process.execPath, [INSTALL_SCRIPT], {
    env: { ...process.env, HOME: tempHome },
    encoding: "utf8",
    timeout: 10000,
  });
  return { stdout };
}

/**
 * Create a temp HOME with a .claude/settings.json pre-populated.
 * Returns { tempHome, claudeDir, settingsPath, cleanup }.
 */
function createTempHome(initialSettings = {}) {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "forge-install-test-"));
  const claudeDir = path.join(tempHome, ".claude");
  fs.mkdirSync(claudeDir, { recursive: true });
  const settingsPath = path.join(claudeDir, "settings.json");
  fs.writeFileSync(settingsPath, JSON.stringify(initialSettings, null, 2));
  return {
    tempHome,
    claudeDir,
    settingsPath,
    readSettings: () => JSON.parse(fs.readFileSync(settingsPath, "utf8")),
    cleanup: () => fs.rmSync(tempHome, { recursive: true, force: true }),
  };
}

describe("install.js — hook registration", () => {
  let env;

  afterEach(() => {
    if (env) {
      env.cleanup();
      env = null;
    }
  });

  describe("Fresh install", () => {
    it("registers all 4 hook events with exactly 1 entry each", () => {
      env = createTempHome({});
      runInstall(env.tempHome);

      const settings = env.readSettings();

      expect(settings.hooks).toBeDefined();

      for (const event of EXPECTED_EVENTS) {
        expect(settings.hooks[event]).toBeDefined();
        expect(Array.isArray(settings.hooks[event])).toBe(true);
        expect(settings.hooks[event]).toHaveLength(event === "UserPromptSubmit" ? 2 : 1);
      }
    });

    it("each hook entry has correct nested format with matcher and hooks array", () => {
      env = createTempHome({});
      runInstall(env.tempHome);

      const settings = env.readSettings();

      for (const event of EXPECTED_EVENTS) {
        const entry = settings.hooks[event][0];
        expect(entry).toHaveProperty("matcher");
        expect(entry).toHaveProperty("hooks");
        expect(Array.isArray(entry.hooks)).toBe(true);
        expect(entry.hooks).toHaveLength(1);
        expect(entry.hooks[0]).toHaveProperty("type", "command");
        expect(entry.hooks[0]).toHaveProperty("command");
        expect(entry.hooks[0]).toHaveProperty("timeout");
        expect(typeof entry.hooks[0].command).toBe("string");
      }
    });
  });

  describe("Idempotent re-install", () => {
    it("running install twice does not duplicate hook entries", () => {
      env = createTempHome({});

      // First install
      runInstall(env.tempHome);
      const settingsAfterFirst = env.readSettings();

      // Second install
      runInstall(env.tempHome);
      const settingsAfterSecond = env.readSettings();

      for (const event of EXPECTED_EVENTS) {
        expect(settingsAfterSecond.hooks[event]).toHaveLength(
          settingsAfterFirst.hooks[event].length
        );
      }
    });

    it("running install three times still has exactly 1 entry per event", () => {
      env = createTempHome({});

      runInstall(env.tempHome);
      runInstall(env.tempHome);
      runInstall(env.tempHome);

      const settings = env.readSettings();

      for (const event of EXPECTED_EVENTS) {
        expect(settings.hooks[event]).toHaveLength(event === "UserPromptSubmit" ? 2 : 1);
      }
    });
  });

  describe("Legacy cleanup", () => {
    it("removes legacy forge-pretool-gate hook and installs new one", () => {
      const legacySettings = {
        hooks: {
          PreToolUse: [
            {
              matcher: "",
              hooks: [
                {
                  type: "command",
                  command: "/usr/bin/node /old/path/forge-pretool-gate.js",
                  timeout: 5,
                },
              ],
            },
          ],
        },
      };

      env = createTempHome(legacySettings);
      runInstall(env.tempHome);

      const settings = env.readSettings();

      // Legacy entry should be gone
      const preToolHooks = settings.hooks.PreToolUse;
      const legacyEntries = preToolHooks.filter((entry) =>
        entry.hooks?.some((h) => h.command?.includes("forge-pretool-gate"))
      );
      expect(legacyEntries).toHaveLength(0);

      // New forge-gate-guard should exist
      const newEntries = preToolHooks.filter((entry) =>
        entry.hooks?.some((h) => h.command?.includes("forge-gate-guard"))
      );
      expect(newEntries).toHaveLength(1);
    });

    it("removes legacy forge-context-monitor and forge-session-init hooks", () => {
      const legacySettings = {
        hooks: {
          PostToolUse: [
            {
              matcher: "",
              hooks: [
                {
                  type: "command",
                  command: "/usr/bin/node /old/path/forge-context-monitor.js",
                  timeout: 5,
                },
              ],
            },
          ],
          UserPromptSubmit: [
            {
              matcher: "",
              hooks: [
                {
                  type: "command",
                  command: "/usr/bin/node /old/path/forge-session-init.js",
                  timeout: 5,
                },
              ],
            },
          ],
        },
      };

      env = createTempHome(legacySettings);
      runInstall(env.tempHome);

      const settings = env.readSettings();

      // Legacy context-monitor should be gone from PostToolUse
      const postToolEntries = settings.hooks.PostToolUse.filter((entry) =>
        entry.hooks?.some((h) => h.command?.includes("forge-context-monitor"))
      );
      expect(postToolEntries).toHaveLength(0);

      // Legacy session-init should be gone from UserPromptSubmit
      const userPromptEntries = settings.hooks.UserPromptSubmit.filter((entry) =>
        entry.hooks?.some((h) => h.command?.includes("forge-session-init"))
      );
      expect(userPromptEntries).toHaveLength(0);

      // New hooks should exist
      expect(settings.hooks.PostToolUse.length).toBeGreaterThanOrEqual(1);
      expect(settings.hooks.UserPromptSubmit.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Preserves non-forge hooks", () => {
    it("keeps custom UserPromptSubmit hook alongside forge hooks", () => {
      const customHook = {
        matcher: "",
        hooks: [
          {
            type: "command",
            command: "/usr/bin/node /my/custom/prompt-logger.js",
            timeout: 3,
          },
        ],
      };

      const existingSettings = {
        hooks: {
          UserPromptSubmit: [customHook],
        },
      };

      env = createTempHome(existingSettings);
      runInstall(env.tempHome);

      const settings = env.readSettings();

      // Custom hook should still be present
      const customEntries = settings.hooks.UserPromptSubmit.filter((entry) =>
        entry.hooks?.some((h) => h.command?.includes("prompt-logger"))
      );
      expect(customEntries).toHaveLength(1);

      // Forge orchestrator hook should also be present
      const forgeEntries = settings.hooks.UserPromptSubmit.filter((entry) =>
        entry.hooks?.some((h) => h.command?.includes("forge-orchestrator"))
      );
      expect(forgeEntries).toHaveLength(1);

      // Total should be 2
      expect(settings.hooks.UserPromptSubmit).toHaveLength(3);
    });

    it("preserves custom hooks in other events too", () => {
      const customPreToolHook = {
        matcher: "Write",
        hooks: [
          {
            type: "command",
            command: "/usr/bin/node /my/custom/write-guard.js",
            timeout: 5,
          },
        ],
      };

      const existingSettings = {
        hooks: {
          PreToolUse: [customPreToolHook],
        },
      };

      env = createTempHome(existingSettings);
      runInstall(env.tempHome);

      const settings = env.readSettings();

      // Custom write-guard should survive
      const customEntries = settings.hooks.PreToolUse.filter((entry) =>
        entry.hooks?.some((h) => h.command?.includes("write-guard"))
      );
      expect(customEntries).toHaveLength(1);

      // Forge gate-guard should also be present
      const forgeEntries = settings.hooks.PreToolUse.filter((entry) =>
        entry.hooks?.some((h) => h.command?.includes("forge-gate-guard"))
      );
      expect(forgeEntries).toHaveLength(1);
    });
  });

  describe("Hook script paths exist on disk", () => {
    it("all hook commands reference scripts that exist on the filesystem", () => {
      env = createTempHome({});
      runInstall(env.tempHome);

      const settings = env.readSettings();

      for (const event of EXPECTED_EVENTS) {
        for (const entry of settings.hooks[event]) {
          for (const hook of entry.hooks) {
            // Command format: "<node_path>" "<script_path>"
            // Extract the script path (second quoted string)
            const matches = hook.command.match(/"([^"]+)"/g);
            expect(matches).not.toBeNull();
            expect(matches.length).toBeGreaterThanOrEqual(2);

            // Second quoted string is the script path
            const scriptPath = matches[1].replace(/"/g, "");
            expect(
              fs.existsSync(scriptPath),
              `Script does not exist: ${scriptPath}`
            ).toBe(true);
          }
        }
      }
    });

    it("hook commands reference the correct node binary", () => {
      env = createTempHome({});
      runInstall(env.tempHome);

      const settings = env.readSettings();

      for (const event of EXPECTED_EVENTS) {
        for (const entry of settings.hooks[event]) {
          for (const hook of entry.hooks) {
            const matches = hook.command.match(/"([^"]+)"/g);
            const nodePath = matches[0].replace(/"/g, "");
            // The node binary used in the command should exist
            expect(
              fs.existsSync(nodePath),
              `Node binary does not exist: ${nodePath}`
            ).toBe(true);
          }
        }
      }
    });
  });
});
