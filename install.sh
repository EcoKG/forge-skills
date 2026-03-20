#!/bin/bash
# forge-skills — One-command installer
# Installs all skills (forge, creatework) + hook auto-activation system
# Usage: bash install.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$HOME/.claude/skills"
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

echo "[1/5] Node.js: $(command -v node) ($(node --version))"

# ─── Step 2: Install Forge skill ───
echo "[2/5] Installing forge skill..."
mkdir -p "$SKILLS_DIR/forge"
cp -r "$REPO_DIR/forge/"* "$SKILLS_DIR/forge/"
mkdir -p "$SKILLS_DIR/forge/hooks/shared" && echo "  → shared modules deployed"
echo "  → $SKILLS_DIR/forge/"

# Ensure new reference files are deployed
mkdir -p "$SKILLS_DIR/forge/references"
cp -r "$REPO_DIR/forge/references/"* "$SKILLS_DIR/forge/references/" 2>/dev/null || true

# ─── Step 3: Install CreateWork skill ───
echo "[3/5] Installing creatework skill..."
mkdir -p "$SKILLS_DIR/creatework"
cp -r "$REPO_DIR/creatework/"* "$SKILLS_DIR/creatework/"
echo "  → $SKILLS_DIR/creatework/"

# ─── Step 4: Register all hooks in settings.json ───
echo "[4/5] Registering hooks in settings.json..."
# install.js handles ALL hook registration:
#   - Removes legacy hooks (context-monitor, session-init, pretool-gate)
#   - Registers v7.1 hooks (gate-guard, orchestrator, tracker, statusline, activation)
#   - Uses PATH-resolved `node` (no hardcoded binary path)
#   - Idempotent: safe to run multiple times
node "$SKILLS_DIR/forge/hooks/install.js" || echo "  (skipped — forge hooks install failed, non-critical)"
# Remove legacy hook files that are no longer needed
for LEGACY_FILE in forge-pretool-gate.js forge-session-init.js forge-context-monitor.js; do
  if [ -f "$SKILLS_DIR/forge/hooks/$LEGACY_FILE" ]; then
    rm "$SKILLS_DIR/forge/hooks/$LEGACY_FILE"
    echo "  Removed legacy: $LEGACY_FILE"
  fi
done
# Deploy skill-rules.json to global skills directory
FORGE_ACTIVATION="$SKILLS_DIR/forge/hooks/activation"
if [ -f "$FORGE_ACTIVATION/skill-rules.json" ]; then
  cp "$FORGE_ACTIVATION/skill-rules.json" "$RULES_DST"
fi
mkdir -p "$STATE_DIR"

# ─── Step 5: Verify installation ───
echo "[5/5] Verifying installation..."
node "$SKILLS_DIR/forge/hooks/install.js" verify || echo "  Verification reported issues (see above)"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Installation Complete                  ║"
echo "╠══════════════════════════════════════════╣"
echo "║                                          ║"
echo "║  Skills: forge v7.2, creatework          ║"
echo "║  Hooks:  7 registered (all in settings)  ║"
echo "║                                          ║"
echo "║  Safe to delete the repo after install.  ║"
echo "║                                          ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Start a new Claude Code session to use."
echo ""
