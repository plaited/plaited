#!/usr/bin/env zsh
set -euo pipefail

serial_file_list=$(mktemp)
all_file_list=$(mktemp)
parallel_file_list=$(mktemp)
trap 'rm -f "$serial_file_list" "$all_file_list" "$parallel_file_list"' EXIT

rg -F -l 'Bun.serve(' src scripts skills -g '*.spec.ts' | sort -u > "$serial_file_list"
cat >> "$serial_file_list" <<'LIST'
src/mcp/tests/mcp.spec.ts
src/modules/server/tests/server-module.spec.ts
src/ui/dom/tests/controller-browser.spec.ts
LIST
sort -u -o "$serial_file_list" "$serial_file_list"

rg --files -g '*.spec.ts' src scripts skills | sort > "$all_file_list"
grep -Fvxf "$serial_file_list" "$all_file_list" > "$parallel_file_list" || true

serial_count=$(wc -l < "$serial_file_list" | tr -d ' ')
parallel_count=$(wc -l < "$parallel_file_list" | tr -d ' ')

echo "[test-runner] serial batch (${serial_count} files, max-concurrency=1)"
if [ "$serial_count" -gt 0 ]; then
  exec 3< "$serial_file_list"
  while IFS= read -r serial_file <&3; do
    [ -n "$serial_file" ] || continue
    bun test --max-concurrency=1 "$serial_file"
    sleep 1
  done
  exec 3<&-
fi

echo "[test-runner] parallel batch (${parallel_count} files, max-concurrency=20)"
if [ "$parallel_count" -gt 0 ]; then
  xargs bun test --max-concurrency=20 < "$parallel_file_list"
fi
