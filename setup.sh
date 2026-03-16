#!/bin/bash
# forge-skills — Clone + Install in one command
# Usage: curl -sL https://raw.githubusercontent.com/EcoKG/forge-skills/main/setup.sh | bash
#    or: bash setup.sh

set -euo pipefail

INSTALL_DIR="$HOME/.forge-skills"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   forge-skills — One-Line Setup          ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Updating existing repo..."
  cd "$INSTALL_DIR" && git pull --ff-only
else
  echo "Cloning forge-skills..."
  rm -rf "$INSTALL_DIR"
  git clone https://github.com/EcoKG/forge-skills.git "$INSTALL_DIR"
fi

# Run installer
cd "$INSTALL_DIR"
bash install.sh
