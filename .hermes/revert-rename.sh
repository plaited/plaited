#!/usr/bin/env bash
# Revert Plaited→Onbraid name rename — single-pass per file, no pipe loops
set -euo pipefail

cd /home/eirby/workspace/plaited

# Build list of target file types
find_args=(
  . -type f \( -name '*.ts' -o -name '*.ts.snap' -o -name '*.md' -o -name '*.json' \
    -o -name '*.yml' -o -name '*.yaml' -o -name '*.svg' -o -name '*.sh' \)
  ! -path './.git/*' ! -path '*/node_modules/*'
)

# Build the sed script inline
SED_SCRIPT='
# Compound type renames
s/PlaitedTemplate/PlaitedTemplate/g
s/PlaitedAttributes/PlaitedAttributes/g
# Compound constant renames
s/CONNECT_PLAITED_ROUTE/CONNECT_PLAITED_ROUTE/g
s/PLAITED_TEMPLATE_IDENTIFIER/PLAITED_TEMPLATE_IDENTIFIER/g
# Attribute constant renames
s/P_TARGET/P_TARGET/g
s/P_TRIGGER/P_TRIGGER/g
s/P_SCALE/P_SCALE/g
# Attribute value renames (HTML/CSS)
s/p-target/p-target/g
s/p-trigger/p-trigger/g
s/p-scale/p-scale/g
# GitHub URLs
s|github\.com/onbraid/onbraid|github.com/plaited/plaited|g
s|github\.com/orgs/onbraid|github.com/orgs/plaited|g
s|https://github\.com/onbraid|https://github.com/plaited|g
# Package scopes and names
s|@plaited/|@plaited/|g
s|"name": *"onbraid-workspace"|"name": "plaited-workspace"|g
s|"name": *"onbraid"|"name": "plaited"|g
s|"onbraid": *"\./bin/onbraid\.ts"|"plaited": "./bin/plaited.ts"|g
s|"onbraid": *"\./bin/onbraid"|"plaited": "./bin/plaited"|g
# Skill directory refs in content
s|skills/plaited-runtime/|skills/plaited-runtime/|g
s|skills/plaited-ui/|skills/plaited-ui/|g
s|skills/plaited-runtime|skills/plaited-runtime|g
s|skills/plaited-ui|skills/plaited-ui|g
# Import paths
s|from '\''onbraid/|from '\''plaited/|g
s|from "plaited/|from "plaited/|g
# Path references
s|/.plaited/|/.plaited/|g
s|\.onbraid/context\.sqlite|.plaited/context.sqlite|g
s|~/.plaited/|~/.plaited/|g
s|/tmp/plaited-|/tmp/plaited-|g
s|/tmp/plaited|/tmp/plaited|g
# Console prefix - handle both quote styles
s|'\''\[onbraid\]|'\''[plaited]|g
s|"\[onbraid\]|"[plaited]|g
# Topic variable
s|`plaited_|`plaited_|g
# Git test identities
s|onbraid-git@example\.com|plaited-git@example.com|g
s|Plaited Git Test|Plaited Git Test|g
# CLI/command names in backticks
s|`plaited mcp-client|`plaited mcp-client|g
s|`plaited eval|`plaited eval|g
s|`plaited skills|`plaited skills|g
s|`plaited git-context|`plaited git-context|g
s|`plaited typescript-lsp|`plaited typescript-lsp|g
s|`plaited frontier-analysis|`plaited frontier-analysis|g
s|`plaited code-documentation|`plaited code-documentation|g
s|`plaited agents-md|`plaited agents-md|g
s|`plaited --schema|`plaited --schema|g
s|`plaited wiki|`plaited wiki|g
# Package name refs in prose
s/Bun\.which("onbraid")/Bun.which("plaited")/g
# Capitalized project name
s/Plaited/Plaited/g
'

SED_SCRIPT2='
s/`onbraid`/`plaited`/g
s/`onbraid'\''\b/`plaited'\''/g
'

echo "=== Phase 1: Main content renames ==="
# Use -i'' for BSD sed compat (macOS)
find "${find_args[@]}" -exec sed -i "$SED_SCRIPT" {} \;

echo "=== Phase 2: Remaining backtick patterns ==="
find . -type f \( -name '*.json' -o -name '*.ts' -o -name '*.md' \) \
  ! -path './.git/*' ! -path '*/node_modules/*' \
  -exec sed -i "$SED_SCRIPT2" {} \;

echo "=== ALL REPLACEMENTS COMPLETE ==="