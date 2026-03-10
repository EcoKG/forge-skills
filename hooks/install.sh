#!/bin/bash
# Claude Code Hook Auto-Activation Installer
# Registers the skill-activation hook in ~/.claude/settings.json
# and copies skill-rules.json to ~/.claude/skills/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETTINGS_FILE="$HOME/.claude/settings.json"
RULES_SRC="$SCRIPT_DIR/skill-rules.json"
RULES_DST="$HOME/.claude/skills/skill-rules.json"
HOOK_ENTRY="$SCRIPT_DIR/dist/src/skill-activation.js"
STATE_DIR="$HOME/.claude/hooks/state"

echo "=== Claude Code Hook Auto-Activation Installer ==="
echo ""

# 1. Check prerequisites
if ! command -v node &>/dev/null; then
  # Try nvm
  export NVM_DIR="$HOME/.nvm"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
  fi
  if ! command -v node &>/dev/null; then
    echo "ERROR: Node.js not found. Install Node.js first."
    exit 1
  fi
fi

NODE_BIN=$(command -v node)
echo "[1/5] Node.js found: $NODE_BIN ($(node --version))"

# 2. Build if needed
if [ ! -f "$HOOK_ENTRY" ]; then
  echo "[2/5] Building TypeScript..."
  cd "$SCRIPT_DIR"
  npm install --silent
  node ./node_modules/typescript/bin/tsc
else
  echo "[2/5] Build already exists"
fi

# 3. Copy skill-rules.json
echo "[3/5] Copying skill-rules.json to $RULES_DST"
mkdir -p "$(dirname "$RULES_DST")"
cp "$RULES_SRC" "$RULES_DST"

# 4. Create state directory
echo "[4/5] Creating state directory: $STATE_DIR"
mkdir -p "$STATE_DIR"

# 5. Update settings.json
echo "[5/5] Updating $SETTINGS_FILE"

HOOK_CMD="$NODE_BIN $HOOK_ENTRY"

if [ ! -f "$SETTINGS_FILE" ]; then
  # Create new settings.json
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
  echo "  Created new settings.json with hook configuration"
else
  # Check if hooks already configured
  if grep -q "skill-activation" "$SETTINGS_FILE" 2>/dev/null; then
    echo "  Hook already registered in settings.json — skipping"
  else
    # Merge using node
    node -e "
      const fs = require('fs');
      const settings = JSON.parse(fs.readFileSync('$SETTINGS_FILE', 'utf-8'));
      if (!settings.hooks) settings.hooks = {};
      if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];

      // Check if already exists
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
        console.log('  Hook registered successfully');
      } else {
        console.log('  Hook already registered — skipping');
      }
    "
  fi
fi

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Hook entry:  $HOOK_ENTRY"
echo "Rules file:  $RULES_DST"
echo "State dir:   $STATE_DIR"
echo "Settings:    $SETTINGS_FILE"
echo ""
echo "The hook will activate on your next Claude Code session."
echo "To test manually:"
echo "  echo '{\"session_id\":\"test\",\"prompt\":\"기능 구현 해줘\"}' | node $HOOK_ENTRY"
