#!/bin/bash
# forge-skills — One-command installer
# Installs all skills (forge, creatework) + hook auto-activation system
# Usage: bash install.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$HOME/.claude/skills"
SETTINGS_FILE="$HOME/.claude/settings.json"
HOOKS_DIR="$REPO_DIR/hooks"
HOOK_SRC="$HOOKS_DIR/dist/src/skill-activation.js"
HOOK_DST="$SKILLS_DIR/forge/hooks/skill-activation.js"
RULES_SRC="$HOOKS_DIR/skill-rules.json"
RULES_DST="$SKILLS_DIR/skill-rules.json"
STATE_DIR="$HOME/.claude/hooks/state"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   forge-skills — Full Installer          ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ─── Step 1: Node.js ───
if ! command -v node &>/dev/null; then
  export NVM_DIR="$HOME/.nvm"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
  fi
  if ! command -v node &>/dev/null; then
    echo "ERROR: Node.js not found. Install Node.js v18+ first."
    exit 1
  fi
fi

NODE_BIN=$(command -v node)
echo "[1/7] Node.js: $NODE_BIN ($(node --version))"

# ─── Step 2: Install Forge skill ───
echo "[2/7] Installing forge skill..."
mkdir -p "$SKILLS_DIR/forge"
cp -r "$REPO_DIR/forge/"* "$SKILLS_DIR/forge/"
echo "  → $SKILLS_DIR/forge/"

# ─── Step 3: Install CreateWork skill ───
echo "[3/7] Installing creatework skill..."
mkdir -p "$SKILLS_DIR/creatework"
cp -r "$REPO_DIR/creatework/"* "$SKILLS_DIR/creatework/"
echo "  → $SKILLS_DIR/creatework/"

# ─── Step 4: Build hook (TypeScript → JS) ───
if [ ! -f "$HOOK_SRC" ]; then
  echo "[4/7] Building hook TypeScript..."
  cd "$HOOKS_DIR"
  npm install --silent 2>/dev/null
  node ./node_modules/typescript/bin/tsc
  cd "$REPO_DIR"
else
  echo "[4/7] Hook build already exists — skipping"
fi

# ─── Step 5: Deploy rules + state + activation hook ───
echo "[5/7] Deploying skill-rules.json + skill-activation.js..."
cp "$RULES_SRC" "$RULES_DST"
mkdir -p "$STATE_DIR"
# Copy activation hook to stable location (not repo-dependent)
cp "$HOOK_SRC" "$HOOK_DST"
echo "  → $RULES_DST"
echo "  → $HOOK_DST"

# ─── Step 6: Install forge workspace hooks ───
echo "[6/7] Installing forge workspace hooks..."
"$NODE_BIN" "$SKILLS_DIR/forge/hooks/install.js" 2>/dev/null || echo "  (skipped — forge hooks install failed, non-critical)"

# ─── Step 7: Register activation hook in settings.json ───
echo "[7/7] Registering activation hook in settings.json..."

# Use the INSTALLED path (not repo path) so it works after repo is deleted
HOOK_CMD="node $HOOK_DST"

if [ ! -f "$SETTINGS_FILE" ]; then
  mkdir -p "$(dirname "$SETTINGS_FILE")"
  cat > "$SETTINGS_FILE" << ENDJSON
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "$HOOK_CMD",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
ENDJSON
  echo "  Created new settings.json"
else
  # Remove old repo-path entries first, then add stable-path entry
  node -e "
    const fs = require('fs');
    const settings = JSON.parse(fs.readFileSync('$SETTINGS_FILE', 'utf-8'));
    if (!settings.hooks) settings.hooks = {};
    if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];

    // Remove ANY existing skill-activation entries (old repo paths)
    settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit.filter(entry =>
      !(entry.hooks?.some(h => h.command?.includes('skill-activation'))) &&
      !(entry.command && entry.command.includes('skill-activation'))
    );

    // Add with stable installed path
    settings.hooks.UserPromptSubmit.push({
      matcher: '',
      hooks: [{
        type: 'command',
        command: '$HOOK_CMD',
        timeout: 5
      }]
    });

    fs.writeFileSync('$SETTINGS_FILE', JSON.stringify(settings, null, 2));
    console.log('  Hook registered → $HOOK_DST');
  "
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Installation Complete                  ║"
echo "╠══════════════════════════════════════════╣"
echo "║                                          ║"
echo "║  Skills installed:                       ║"
echo "║    • forge v2.1  — /forge                ║"
echo "║    • creatework  — /creatework           ║"
echo "║                                          ║"
echo "║  Hooks installed:                        ║"
echo "║    • context-monitor (PostToolUse)       ║"
echo "║    • statusline (Notification)           ║"
echo "║    • session-init (UserPromptSubmit)     ║"
echo "║    • pretool-gate (PreToolUse)           ║"
echo "║    • skill-activation (UserPromptSubmit) ║"
echo "║                                          ║"
echo "║  All hooks are in ~/.claude/skills/forge ║"
echo "║  Safe to delete the repo after install.  ║"
echo "║                                          ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Start a new Claude Code session to use."
echo ""
echo "Quick test:"
echo "  echo '{\"session_id\":\"test\",\"prompt\":\"기능 구현\"}' | node $HOOK_DST"
echo ""
