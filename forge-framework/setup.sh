#!/usr/bin/env bash
set -euo pipefail

# Forge Framework v8.0 "Nova" — One-line Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/EcoKG/forge-skills/main/forge-framework/setup.sh | bash

REPO="https://github.com/EcoKG/forge-skills.git"
INSTALL_DIR="$HOME/.claude/skills/forge-skills"
FRAMEWORK_DIR="$INSTALL_DIR/forge-framework"

echo ""
echo "Forge Framework v8.0 \"Nova\" Installer"
echo "==================================================="
echo ""

# 1. Prerequisites check
echo "Checking prerequisites..."

command -v node >/dev/null 2>&1 || { echo "  ERROR: Node.js not found. Install: https://nodejs.org/"; exit 1; }
NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
[ "$NODE_VER" -ge 18 ] || { echo "  ERROR: Node.js 18+ required (found: v$NODE_VER)"; exit 1; }
echo "  OK: Node.js $(node -v)"

command -v git >/dev/null 2>&1 || { echo "  ERROR: Git not found. Install: https://git-scm.com/"; exit 1; }
echo "  OK: Git $(git --version | cut -d' ' -f3)"

command -v claude >/dev/null 2>&1 || { echo "  ERROR: Claude Code not found. Install: https://claude.ai/code"; exit 1; }
echo "  OK: Claude Code $(claude --version 2>/dev/null | head -1)"

echo ""

# 2. Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating existing installation..."
  cd "$INSTALL_DIR"
  git pull --ff-only origin main 2>/dev/null || git pull origin main
  echo "  OK: Updated"
else
  echo "Cloning forge-skills..."
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone "$REPO" "$INSTALL_DIR"
  echo "  OK: Cloned to $INSTALL_DIR"
fi

echo ""

# 3. Install hooks
echo "Installing hooks..."
node "$FRAMEWORK_DIR/core/install.js"

echo ""

# 4. Verify
echo "Verifying installation..."
node "$FRAMEWORK_DIR/core/install.js" verify

echo ""
echo "==================================================="
echo "  OK: Forge Framework v8.0 \"Nova\" installed!"
echo ""
echo "  Next steps:"
echo "    1. Restart Claude Code (or type /clear)"
echo "    2. Try: \"캐싱 로직 추가해줘\""
echo "    3. Gatekeeper will auto-route to forge"
echo ""
echo "  Docs:"
echo "    Getting Started: $FRAMEWORK_DIR/docs/getting-started-ko.md"
echo "    Scenarios:        $FRAMEWORK_DIR/docs/usage-scenarios-ko.md"
echo "==================================================="
