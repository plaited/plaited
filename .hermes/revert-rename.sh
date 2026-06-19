#!/usr/bin/env bash
# Revert Plaited→Onbraid name rename — single pass per file
# Run from repo root
set -euo pipefail

cd /home/eirby/workspace/plaited

find . -type f \
  \( -name '*.ts' -o -name '*.ts.snap' -o -name '*.md' -o -name '*.json' -o -name '*.yml' -o -name '*.yaml' \
     -o -name '*.svg' -o -name '*.sh' \) \
  ! -path './.git/*' ! -path '*/node_modules/*' \
  -print0 | while IFS= read -r -d '' f; do

  # Skip SQLite artifacts
  case "$f" in *.sqlite*) continue;; esac

  sed -i \
    # === LONGEST / MOST SPECIFIC FIRST ===
    # Compound type renames (exact case)
    -e 's/OnBraidTemplate/PlaitedTemplate/g' \
    -e 's/OnBraidAttributes/PlaitedAttributes/g' \
    # Compound constant renames
    -e 's/CONNECT_ONBRAID_ROUTE/CONNECT_PLAITED_ROUTE/g' \
    -e 's/ONBRAID_TEMPLATE_IDENTIFIER/PLAITED_TEMPLATE_IDENTIFIER/g' \
    # Attribute constant renames
    -e 's/O_TARGET/P_TARGET/g' \
    -e 's/O_TRIGGER/P_TRIGGER/g' \
    -e 's/O_SCALE/P_SCALE/g' \
    # Attribute value renames (HTML/CSS)
    -e 's/o-target/p-target/g' \
    -e 's/o-trigger/p-trigger/g' \
    -e 's/o-scale/p-scale/g' \
    # GitHub URLs
    -e 's|github\.com/onbraid/onbraid|github.com/plaited/plaited|g' \
    -e 's|github\.com/orgs/onbraid|github.com/orgs/plaited|g' \
    -e 's|https://github\.com/onbraid|https://github.com/plaited|g' \
    # Package scopes and names
    -e 's|@onbraid/|@plaited/|g' \
    -e 's|"name": *"onbraid-workspace"|"name": "plaited-workspace"|g' \
    -e 's|"name": *"onbraid"|"name": "plaited"|g' \
    -e 's|"onbraid": *"\./bin/onbraid\.ts"|"plaited": "./bin/plaited.ts"|g' \
    -e 's|"onbraid": *"\./bin/onbraid"|"plaited": "./bin/plaited"|g' \
    # Skill directory references in content
    -e 's|skills/onbraid-runtime/|skills/plaited-runtime/|g' \
    -e 's|skills/onbraid-ui/|skills/plaited-ui/|g' \
    -e 's|skills/onbraid-runtime|skills/plaited-runtime|g' \
    -e 's|skills/onbraid-ui|skills/plaited-ui|g' \
    # Import paths
    -e "s|from 'onbraid/|from 'plaited/|g" \
    -e 's|from "onbraid/|from "plaited/|g' \
    # Path references
    -e 's|/.onbraid/|/.plaited/|g' \
    -e 's|\.onbraid/context\.sqlite|.plaited/context.sqlite|g' \
    -e 's|~/.onbraid/|~/.plaited/|g' \
    -e 's|/tmp/onbraid-|/tmp/plaited-|g' \
    -e 's|/tmp/onbraid|/tmp/plaited|g' \
    # Console prefix
    -e "s|'\\[onbraid\\]|'[plaited]|g" \
    -e 's|"\\[onbraid\\]|"[plaited]|g' \
    # Topic variable
    -e 's|`onbraid_|`plaited_|g' \
    # Git test identities
    -e 's|onbraid-git@example\.com|plaited-git@example.com|g' \
    -e 's|OnBraid Git Test|Plaited Git Test|g' \
    # CLI/command names in backticks and code fences (not package names)
    -e 's|`onbraid mcp-client|`plaited mcp-client|g' \
    -e 's|`onbraid eval|`plaited eval|g' \
    -e 's|`onbraid skills|`plaited skills|g' \
    -e 's|`onbraid git-context|`plaited git-context|g' \
    -e 's|`onbraid typescript-lsp|`plaited typescript-lsp|g' \
    -e 's|`onbraid frontier-analysis|`plaited frontier-analysis|g' \
    -e 's|`onbraid code-documentation|`plaited code-documentation|g' \
    -e 's|`onbraid agents-md|`plaited agents-md|g' \
    -e 's|`onbraid --schema|`plaited --schema|g' \
    -e 's|`onbraid wiki|`plaited wiki|g' \
    # Package name references in skill YAML frontmatter
    -e 's|compatibility:.*Requires `onbraid`|compatibility: Requires `plaited`|g' \
    -e 's|Bun\.which("onbraid")|Bun.which("plaited")|g' \
    -e 's|Bun\.which(\\"onbraid\\")|Bun.which(\\"plaited\\")|g' \
    # CLI command references in prose (not in backticks)
    # These use word boundary carefully
    -e 's/ requires `onbraid` CLI/ requires `plaited` CLI/g' \
    # Capitalized project name in prose
    -e 's/OnBraid/Plaited/g' \
    # Remaining lowercase references (broader — after specific patterns)
    # This handles standalone onbraid in prose, e.g. "uses onbraid CLI"
    "$f"
done

# Post-processing: fix remaining bare `onbraid` in backtick contexts that don't start a command
# (e.g. skill name references in YAML frontmatter)
find . -type f \
  \( -name '*.json' -o -name '*.ts' -o -name '*.md' \) \
  ! -path './.git/*' ! -path '*/node_modules/*' \
  -print0 | while IFS= read -r -d '' f; do
  case "$f" in *.sqlite*) continue;; esac
  # Handle `onbraid` as standalone (not part of a command like `onbraid eval`)
  sed -i \
    -e 's/`onbraid`/`plaited`/g' \
    -e 's/`onbraid'\''/`plaited'\''/g' \
    "$f"
done

echo "=== ALL REPLACEMENTS COMPLETE ==="