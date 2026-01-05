#!/bin/bash
# Install Plaited Workshop plugin for AI coding agents
# Supports: Claude Code, Cursor, OpenCode, Amp, Goose, Factory
#
# Usage:
#   ./install-workshop.sh                    # Interactive: asks which agent
#   ./install-workshop.sh --agent claude     # Direct: install for Claude Code
#   ./install-workshop.sh --update           # Update existing installation
#   ./install-workshop.sh --uninstall        # Remove installation

set -e

# ============================================================================
# Configuration
# ============================================================================

REPO="https://github.com/plaited/plaited.git"
BRANCH="main"
TEMP_DIR=""

# ============================================================================
# Agent Directory Mappings (functions for bash 3.x compatibility)
# ============================================================================

get_skills_dir() {
  case "$1" in
    claude)   echo ".claude/skills" ;;
    cursor)   echo ".claude/skills" ;;     # Cursor reads .claude/skills
    opencode) echo ".opencode/skill" ;;    # OpenCode uses 'skill' (singular)
    amp)      echo ".agents/skills" ;;
    goose)    echo ".claude/skills" ;;     # Goose falls back to .claude/skills
    factory)  echo ".factory/skills" ;;
    *)        echo "" ;;
  esac
}

get_commands_dir() {
  case "$1" in
    claude)   echo ".claude/commands" ;;
    opencode) echo ".opencode/command" ;;  # OpenCode uses 'command' (singular)
    amp)      echo ".agents/commands" ;;
    *)        echo "" ;;
  esac
}

get_agents_dir() {
  case "$1" in
    claude)   echo ".claude/agents" ;;
    opencode) echo ".opencode/agent" ;;    # OpenCode uses 'agent' (singular)
    *)        echo "" ;;
  esac
}

get_hooks_dir() {
  case "$1" in
    claude)   echo ".claude/hooks" ;;
    *)        echo "" ;;
  esac
}

supports_commands() {
  case "$1" in
    claude|opencode|amp) return 0 ;;
    *) return 1 ;;
  esac
}

supports_agents() {
  case "$1" in
    claude|opencode) return 0 ;;
    *) return 1 ;;
  esac
}

supports_hooks() {
  case "$1" in
    claude) return 0 ;;
    *) return 1 ;;
  esac
}

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Plaited Workshop Installer"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

print_success() {
  echo "✓ $1"
}

print_info() {
  echo "→ $1"
}

print_error() {
  echo "✗ $1" >&2
}

cleanup() {
  if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
  fi
}

trap cleanup EXIT

# ============================================================================
# Agent Detection
# ============================================================================

detect_agent() {
  # Check for existing installations
  if [ -d ".claude" ]; then
    echo "claude"
  elif [ -d ".opencode" ]; then
    echo "opencode"
  elif [ -d ".agents" ]; then
    echo "amp"
  elif [ -d ".factory" ]; then
    echo "factory"
  elif [ -d ".cursor" ]; then
    echo "cursor"
  else
    echo ""
  fi
}

ask_agent() {
  local detected
  detected=$(detect_agent)

  echo "Which AI coding agent are you using?"
  echo ""
  echo "  ┌─────────────┬──────────────────┬─────────────────────────────────────┐"
  echo "  │ Agent       │ Directory        │ Supported Features                  │"
  echo "  ├─────────────┼──────────────────┼─────────────────────────────────────┤"
  echo "  │ 1) Claude   │ .claude/         │ skills, commands, agents, hooks     │"
  echo "  │ 2) Cursor   │ .claude/         │ skills                              │"
  echo "  │ 3) OpenCode │ .opencode/       │ skills, commands, agents            │"
  echo "  │ 4) Amp      │ .agents/         │ skills, commands                    │"
  echo "  │ 5) Goose    │ .claude/         │ skills                              │"
  echo "  │ 6) Factory  │ .factory/        │ skills                              │"
  echo "  └─────────────┴──────────────────┴─────────────────────────────────────┘"
  echo ""

  if [ -n "$detected" ]; then
    echo "  Detected: $detected"
    echo ""
  fi

  printf "Select agent [1-6]: "
  read choice

  case "$choice" in
    1) echo "claude" ;;
    2) echo "cursor" ;;
    3) echo "opencode" ;;
    4) echo "amp" ;;
    5) echo "goose" ;;
    6) echo "factory" ;;
    *)
      print_error "Invalid choice"
      exit 1
      ;;
  esac
}

# ============================================================================
# Installation Functions
# ============================================================================

clone_repo() {
  TEMP_DIR=$(mktemp -d)
  print_info "Cloning Plaited repository..."

  git clone --depth 1 --filter=blob:none --sparse "$REPO" "$TEMP_DIR" --branch "$BRANCH" 2>/dev/null
  cd "$TEMP_DIR"
  git sparse-checkout set .claude/skills .claude/agents .claude/commands .claude/hooks 2>/dev/null
  cd - > /dev/null

  print_success "Repository cloned"
}

install_skills() {
  local agent="$1"
  local target_dir
  target_dir=$(get_skills_dir "$agent")

  if [ -z "$target_dir" ]; then
    print_error "Unknown agent: $agent"
    return 1
  fi

  print_info "Installing skills to $target_dir/"
  mkdir -p "$target_dir"
  cp -r "$TEMP_DIR/.claude/skills/"* "$target_dir/"
  print_success "Skills installed"
}

adapt_command_for_opencode() {
  local src="$1"
  local dest="$2"
  local filename
  filename=$(basename "$src")

  # OpenCode format is similar - copy as-is
  # OpenCode will ignore fields it doesn't understand
  cp "$src" "$dest/$filename"
}

adapt_command_for_amp() {
  local src="$1"
  local dest="$2"
  local filename
  filename=$(basename "$src")

  # Amp uses simpler format but handles frontmatter
  cp "$src" "$dest/$filename"
}

install_commands() {
  local agent="$1"
  local target_dir

  if ! supports_commands "$agent"; then
    return 0
  fi

  target_dir=$(get_commands_dir "$agent")
  if [ -z "$target_dir" ]; then
    return 0
  fi

  print_info "Installing commands to $target_dir/"
  mkdir -p "$target_dir"

  case "$agent" in
    claude)
      cp -r "$TEMP_DIR/.claude/commands/"* "$target_dir/"
      ;;
    opencode)
      for cmd in "$TEMP_DIR/.claude/commands/"*.md; do
        [ -f "$cmd" ] && adapt_command_for_opencode "$cmd" "$target_dir"
      done
      ;;
    amp)
      for cmd in "$TEMP_DIR/.claude/commands/"*.md; do
        [ -f "$cmd" ] && adapt_command_for_amp "$cmd" "$target_dir"
      done
      ;;
  esac

  print_success "Commands installed"
}

adapt_agent_for_opencode() {
  local src="$1"
  local dest="$2"
  local filename
  filename=$(basename "$src")

  # Read source content
  local content
  content=$(cat "$src")

  # OpenCode agents need 'mode: subagent' in frontmatter
  # Check if it already has frontmatter
  if echo "$content" | head -1 | grep -q "^---"; then
    # Has frontmatter - add mode: subagent after first ---
    echo "$content" | awk 'NR==1{print; print "mode: subagent"; next}1' > "$dest/$filename"
  else
    # No frontmatter - add it
    {
      echo "---"
      echo "mode: subagent"
      echo "---"
      echo ""
      echo "$content"
    } > "$dest/$filename"
  fi
}

install_agents() {
  local agent="$1"
  local target_dir

  if ! supports_agents "$agent"; then
    return 0
  fi

  target_dir=$(get_agents_dir "$agent")
  if [ -z "$target_dir" ]; then
    return 0
  fi

  print_info "Installing agents to $target_dir/"
  mkdir -p "$target_dir"

  case "$agent" in
    claude)
      cp -r "$TEMP_DIR/.claude/agents/"* "$target_dir/"
      ;;
    opencode)
      for agent_file in "$TEMP_DIR/.claude/agents/"*.md; do
        [ -f "$agent_file" ] && adapt_agent_for_opencode "$agent_file" "$target_dir"
      done
      ;;
  esac

  print_success "Agents installed"
}

install_hooks() {
  local agent="$1"
  local target_dir

  if ! supports_hooks "$agent"; then
    return 0
  fi

  target_dir=$(get_hooks_dir "$agent")
  if [ -z "$target_dir" ]; then
    return 0
  fi

  print_info "Installing hooks to $target_dir/"
  mkdir -p "$target_dir"
  cp -r "$TEMP_DIR/.claude/hooks/"* "$target_dir/"
  print_success "Hooks installed"
}

# ============================================================================
# Main Installation
# ============================================================================

do_install() {
  local agent="$1"

  print_info "Installing for: $agent"
  echo ""

  clone_repo
  install_skills "$agent"
  install_commands "$agent"
  install_agents "$agent"
  install_hooks "$agent"

  local skills_dir commands_dir agents_dir hooks_dir
  skills_dir=$(get_skills_dir "$agent")
  commands_dir=$(get_commands_dir "$agent")
  agents_dir=$(get_agents_dir "$agent")
  hooks_dir=$(get_hooks_dir "$agent")

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Installation Complete!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "  Installed for: $agent"
  echo ""

  [ -d "$skills_dir" ] && echo "    • Skills:   $skills_dir/"
  [ -n "$commands_dir" ] && [ -d "$commands_dir" ] && echo "    • Commands: $commands_dir/"
  [ -n "$agents_dir" ] && [ -d "$agents_dir" ] && echo "    • Agents:   $agents_dir/"
  [ -n "$hooks_dir" ] && [ -d "$hooks_dir" ] && echo "    • Hooks:    $hooks_dir/"

  echo ""
  echo "  Next steps:"
  echo "    1. Restart your AI coding agent to load the new skills"
  echo "    2. Skills are auto-discovered and activated when relevant"
  echo ""
}

# ============================================================================
# Update
# ============================================================================

do_update() {
  local agent
  agent=$(detect_agent)

  if [ -z "$agent" ]; then
    print_error "No existing installation detected"
    print_info "Run without --update to install"
    exit 1
  fi

  print_info "Updating installation for: $agent"

  # Remove old installation
  local skills_dir commands_dir agents_dir hooks_dir
  skills_dir=$(get_skills_dir "$agent")
  commands_dir=$(get_commands_dir "$agent")
  agents_dir=$(get_agents_dir "$agent")
  hooks_dir=$(get_hooks_dir "$agent")

  [ -d "$skills_dir" ] && rm -rf "$skills_dir"
  [ -n "$commands_dir" ] && [ -d "$commands_dir" ] && rm -rf "$commands_dir"
  [ -n "$agents_dir" ] && [ -d "$agents_dir" ] && rm -rf "$agents_dir"
  [ -n "$hooks_dir" ] && [ -d "$hooks_dir" ] && rm -rf "$hooks_dir"

  # Reinstall
  do_install "$agent"
}

# ============================================================================
# Uninstall
# ============================================================================

do_uninstall() {
  local agent
  agent=$(detect_agent)

  if [ -z "$agent" ]; then
    print_error "No existing installation detected"
    exit 1
  fi

  print_info "Uninstalling Plaited Workshop for: $agent"

  local skills_dir commands_dir agents_dir hooks_dir
  skills_dir=$(get_skills_dir "$agent")
  commands_dir=$(get_commands_dir "$agent")
  agents_dir=$(get_agents_dir "$agent")
  hooks_dir=$(get_hooks_dir "$agent")

  # Only remove our specific directories, not the parent
  if [ -d "$skills_dir" ]; then
    rm -rf "$skills_dir"
    print_success "Removed $skills_dir/"
  fi

  if [ -n "$commands_dir" ] && [ -d "$commands_dir" ]; then
    rm -rf "$commands_dir"
    print_success "Removed $commands_dir/"
  fi

  if [ -n "$agents_dir" ] && [ -d "$agents_dir" ]; then
    rm -rf "$agents_dir"
    print_success "Removed $agents_dir/"
  fi

  if [ -n "$hooks_dir" ] && [ -d "$hooks_dir" ]; then
    rm -rf "$hooks_dir"
    print_success "Removed $hooks_dir/"
  fi

  echo ""
  print_success "Plaited Workshop uninstalled"
}

# ============================================================================
# CLI Parsing
# ============================================================================

show_help() {
  echo "Usage: install-workshop.sh [OPTIONS]"
  echo ""
  echo "Install Plaited Workshop plugin for AI coding agents."
  echo ""
  echo "Options:"
  echo "  --agent <name>    Install for specific agent"
  echo "  --update          Update existing installation"
  echo "  --uninstall       Remove installation"
  echo "  --help            Show this help message"
  echo ""
  echo "Agent Compatibility:"
  echo ""
  echo "  ┌─────────────┬──────────────────┬─────────────────────────────────────┐"
  echo "  │ Agent       │ Directory        │ Supported Features                  │"
  echo "  ├─────────────┼──────────────────┼─────────────────────────────────────┤"
  echo "  │ claude      │ .claude/         │ skills, commands, agents, hooks     │"
  echo "  │ cursor      │ .claude/         │ skills                              │"
  echo "  │ opencode    │ .opencode/       │ skills, commands, agents            │"
  echo "  │ amp         │ .agents/         │ skills, commands                    │"
  echo "  │ goose       │ .claude/         │ skills                              │"
  echo "  │ factory     │ .factory/        │ skills                              │"
  echo "  └─────────────┴──────────────────┴─────────────────────────────────────┘"
  echo ""
  echo "Examples:"
  echo "  ./install-workshop.sh                  # Interactive mode"
  echo "  ./install-workshop.sh --agent claude   # Install for Claude Code"
  echo "  ./install-workshop.sh --update         # Update existing"
  echo "  ./install-workshop.sh --uninstall      # Remove installation"
}

main() {
  local agent=""
  local action="install"

  while [ $# -gt 0 ]; do
    case "$1" in
      --agent)
        agent="$2"
        shift 2
        ;;
      --update)
        action="update"
        shift
        ;;
      --uninstall)
        action="uninstall"
        shift
        ;;
      --help|-h)
        show_help
        exit 0
        ;;
      *)
        print_error "Unknown option: $1"
        show_help
        exit 1
        ;;
    esac
  done

  print_header

  case "$action" in
    install)
      if [ -z "$agent" ]; then
        agent=$(ask_agent)
      fi

      # Validate agent
      local skills_dir
      skills_dir=$(get_skills_dir "$agent")
      if [ -z "$skills_dir" ]; then
        print_error "Unknown agent: $agent"
        print_info "Valid agents: claude, cursor, opencode, amp, goose, factory"
        exit 1
      fi

      do_install "$agent"
      ;;
    update)
      do_update
      ;;
    uninstall)
      do_uninstall
      ;;
  esac
}

main "$@"
