#!/bin/bash
# forge-skills — One-command installer
# Installs all skills (forge, creatework) + hook auto-activation system
# Usage: bash install.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$HOME/.claude/skills"
SETTINGS_FILE="$HOME/.claude/settings.json"
HOOKS_DIR="$REPO_DIR/hooks"
HOOK_ENTRY="$HOOKS_DIR/dist/src/skill-activation.js"
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
echo "[1/6] Node.js: $NODE_BIN ($(node --version))"

# ─── Step 2: Install Forge skill ───
echo "[2/6] Installing forge skill..."
mkdir -p "$SKILLS_DIR/forge"
cp -r "$REPO_DIR/forge/"* "$SKILLS_DIR/forge/"
echo "  → $SKILLS_DIR/forge/"

# ─── Step 3: Install CreateWork skill ───
echo "[3/6] Installing creatework skill..."
mkdir -p "$SKILLS_DIR/creatework"
cp -r "$REPO_DIR/creatework/"* "$SKILLS_DIR/creatework/"
echo "  → $SKILLS_DIR/creatework/"

# ─── Step 4: Build hook (TypeScript → JS) ───
if [ ! -f "$HOOK_ENTRY" ]; then
  echo "[4/6] Building hook TypeScript..."
  cd "$HOOKS_DIR"
  npm install --silent 2>/dev/null
  node ./node_modules/typescript/bin/tsc
  cd "$REPO_DIR"
else
  echo "[4/6] Hook build already exists — skipping"
fi

# ─── Step 5: Deploy rules + state ───
echo "[5/6] Deploying skill-rules.json + state directory..."
cp "$RULES_SRC" "$RULES_DST"
mkdir -p "$STATE_DIR"
echo "  → $RULES_DST"
echo "  → $STATE_DIR"

# ─── Step 6: Register hook in settings.json ───
echo "[6/6] Registering hook in settings.json..."

HOOK_CMD="$NODE_BIN $HOOK_ENTRY"

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
  if grep -q "skill-activation" "$SETTINGS_FILE" 2>/dev/null; then
    echo "  Hook already registered — skipping"
  else
    node -e "
      const fs = require('fs');
      const settings = JSON.parse(fs.readFileSync('$SETTINGS_FILE', 'utf-8'));
      if (!settings.hooks) settings.hooks = {};
      if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];
      const exists = settings.hooks.UserPromptSubmit.some(h =>
        h.hooks?.some(hh => hh.command?.includes('skill-activation'))
      );
      if (!exists) {
        settings.hooks.UserPromptSubmit.push({
          matcher: '',
          hooks: [{
            type: 'command',
            command: '$HOOK_CMD',
            timeout: 5
          }]
        });
        fs.writeFileSync('$SETTINGS_FILE', JSON.stringify(settings, null, 2));
        console.log('  Hook registered');
      } else {
        console.log('  Hook already registered — skipping');
      }
    "
  fi
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Installation Complete                  ║"
echo "╠══════════════════════════════════════════╣"
echo "║                                          ║"
echo "║  Skills installed:                       ║"
echo "║    • forge       — /forge                ║"
echo "║    • creatework  — /creatework           ║"
echo "║                                          ║"
echo "║  Hook: auto-activation enabled           ║"
echo "║                                          ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Start a new Claude Code session to use."
echo ""
echo "Quick test:"
echo "  echo '{\"session_id\":\"test\",\"prompt\":\"기능 구현\"}' | node $HOOK_ENTRY"
echo ""
