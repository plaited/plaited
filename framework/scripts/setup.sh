#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() {
  printf '[setup] %s\n' "$1"
}

fail() {
  printf '[setup] %s\n' "$1" >&2
  exit 1
}

have() {
  command -v "$1" >/dev/null 2>&1
}

run_installer() {
  local url="$1"

  if have curl; then
    curl -fsSL "$url" | bash
    return
  fi

  if have wget; then
    wget -qO- "$url" | bash
    return
  fi

  fail "Need either curl or wget to install tooling."
}

resolve_bun() {
  if have bun; then
    command -v bun
    return
  fi

  local bun_install_root="${BUN_INSTALL:-$HOME/.bun}"
  local bun_bin="${bun_install_root}/bin/bun"
  if [ -x "$bun_bin" ]; then
    printf '%s\n' "$bun_bin"
    return
  fi

  fail "Bun is not available. Run '$0 bun' first."
}

install_bun() {
  if have bun; then
    log "bun already installed: $(command -v bun)"
    return
  fi

  if [ "$(uname -s)" = "Linux" ] && ! have unzip; then
    fail "Bun's Linux installer requires unzip. Install unzip first, then retry."
  fi

  log "installing bun"
  run_installer "https://bun.com/install"
  log "bun install complete"
}

install_deps() {
  local bun_bin
  bun_bin="$(resolve_bun)"

  log "installing bun dependencies"
  cd "$repo_root"
  "$bun_bin" install
}

link_cli() {
  local bun_bin
  bun_bin="$(resolve_bun)"

  log "linking local plaited CLI"
  cd "$repo_root"
  "$bun_bin" link
}

usage() {
  cat <<'EOF'
Usage: scripts/setup.sh [all|bun|deps|link]

Commands:
  all   Install bun if needed, then run bun install and bun link.
  bun   Install bun if it is missing.
  deps  Run bun install in the repo root.
  link  Run bun link in the repo root.
EOF
}

command_name="${1:-all}"

case "$command_name" in
  all)
    install_bun
    install_deps
    link_cli
    ;;
  bun)
    install_bun
    ;;
  deps)
    install_deps
    ;;
  link)
    link_cli
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    fail "Unknown setup command: $command_name"
    ;;
esac
