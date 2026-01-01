#!/bin/bash
# Install Plaited AI plugin for non-Claude/Cursor users
# Copies skills, agents, and commands to .plaited directory

set -e

REPO="https://github.com/plaited/plaited.git"
BRANCH="main"
TARGET_DIR=".plaited"
TEMP_DIR=$(mktemp -d)

echo "Installing Plaited AI plugin..."
echo ""

# Clone with sparse checkout (only .claude directory)
git clone --depth 1 --filter=blob:none --sparse "$REPO" "$TEMP_DIR" --branch "$BRANCH" 2>/dev/null
cd "$TEMP_DIR"
git sparse-checkout set .claude/skills .claude/agents .claude/commands scripts/AGENTS.template.md 2>/dev/null

# Go back to original directory
cd - > /dev/null

# Create target directory
mkdir -p "$TARGET_DIR"

# Copy skills, agents, commands (not rules or hooks)
cp -r "$TEMP_DIR/.claude/skills" "$TARGET_DIR/"
cp -r "$TEMP_DIR/.claude/agents" "$TARGET_DIR/"
cp -r "$TEMP_DIR/.claude/commands" "$TARGET_DIR/"

# Copy AGENTS.md template
cp "$TEMP_DIR/scripts/AGENTS.template.md" "$TARGET_DIR/AGENTS.md"

# Cleanup
rm -rf "$TEMP_DIR"

echo "Plaited AI plugin installed to $TARGET_DIR/"
echo ""
echo "Directory structure:"
echo "  $TARGET_DIR/"
echo "  ├── skills/          # Framework patterns and knowledge"
echo "  ├── agents/          # Specialized review agents"
echo "  ├── commands/        # User commands"
echo "  └── AGENTS.md        # Instructions for AI agents"
echo ""
echo "Next steps:"
echo "  1. Add a link to your project's AGENTS.md (create if needed):"
echo "     - [Plaited Plugin](.plaited/AGENTS.md)"
echo ""
echo "  2. Point your AI agent to .plaited/AGENTS.md for Plaited guidance"
echo ""
