#!/usr/bin/env python3
"""Handle remaining onbraid→plaited replacements in 30 files with precise targeting."""

import re
import os
import sys
from pathlib import Path

BASE = Path("/home/eirby/workspace/plaited")
os.chdir(BASE)

def replace_in_file(rel_path: str, replacements: list[tuple[str, str]]) -> None:
    """Read file, apply replacements in order, write back."""
    full = BASE / rel_path
    if not full.exists():
        print(f"  SKIP: {rel_path} not found")
        return
    orig = full.read_text()
    text = orig
    for old, new in replacements:
        text = text.replace(old, new)
    if text == orig:
        print(f"  NO CHANGE: {rel_path}")
        return
    full.write_text(text)
    changes = orig.count('\n') - text.count('\n')
    print(f"  UPDATED: {rel_path} ({(len(orig) - len(text)):-d} chars)")


# ======================================================================
# CATEGORY 1: CLI help text with escaped single quotes in .ts files
# Pattern: '  onbraid <cmd> ...\''
# ======================================================================
replacements_cli_help = [
    ("'  onbraid code-documentation \\'{\"targets\":[\"src/**/*.ts\"]}\\''",
     "'  plaited code-documentation \\'{\"targets\":[\"src/**/*.ts\"]}\\''"),
    ("'  onbraid code-documentation \\'{\"targets\":[\"src/agent/agent.ts\"]}\\''",
     "'  plaited code-documentation \\'{\"targets\":[\"src/agent/agent.ts\"]}\\''"),
    ("'  onbraid git-context \\'{\"mode\":\"status\",\"cwd\":\".\"}\\''",
     "'  plaited git-context \\'{\"mode\":\"status\",\"cwd\":\".\"}\\''"),
    ("'  onbraid git-context \\'{\"mode\":\"history\",\"cwd\":\".\",\"base\":\"main\"}\\''",
     "'  plaited git-context \\'{\"mode\":\"history\",\"cwd\":\".\",\"base\":\"main\"}\\''"),
    ("'  onbraid git-context \\'{\"mode\":\"context\",\"cwd\":\".\",\"base\":\"main\",\"includeWorktrees\":true}\\''",
     "'  plaited git-context \\'{\"mode\":\"context\",\"cwd\":\".\",\"base\":\"main\",\"includeWorktrees\":true}\\''"),
    ("'  onbraid typescript-lsp \\'{\"mode\":\"execute\",\"file\":\"src/index.ts\",\"requests\":[{\"method\":\"textDocument/hover\",\"params\":{\"textDocument\":{\"uri\":\"file://src/index.ts\"},\"position\":{\"line\":5,\"character\":10}}}]}\\''",
     "'  plaited typescript-lsp \\'{\"mode\":\"execute\",\"file\":\"src/index.ts\",\"requests\":[{\"method\":\"textDocument/hover\",\"params\":{\"textDocument\":{\"uri\":\"file://src/index.ts\"},\"position\":{\"line\":5,\"character\":10}}}]}\\''"),
    ("'  onbraid typescript-lsp \\'{\"mode\":\"discover\"}\\''",
     "'  plaited typescript-lsp \\'{\"mode\":\"discover\"}\\''"),
]

for old, new in replacements_cli_help:
    # Find the file that contains this pattern
    for root, dirs, files in os.walk(BASE / "framework/src/cli"):
        if 'node_modules' in root:
            continue
        for fn in files:
            if not fn.endswith('.ts'):
                continue
            fpath = os.path.join(root, fn)
            rel = os.path.relpath(fpath, BASE)
            try:
                content = open(fpath).read()
                if old in content:
                    new_content = content.replace(old, new)
                    open(fpath, 'w').write(new_content)
                    print(f"  UPDATED: {rel} (CLI help text)")
            except Exception as e:
                pass

# ======================================================================
# CATEGORY 2: eval.schemas.ts — .describe('...onbraid eval...')
# ======================================================================
replace_in_file("framework/src/cli/eval.schemas.ts", [
    (".describe('Canonical trial row used by onbraid eval.')",
     ".describe('Canonical trial row used by plaited eval.')"),
    (".describe('Top-level onbraid eval input schema.')",
     ".describe('Top-level plaited eval input schema.')"),
    (".describe('Top-level onbraid eval output schema.')",
     ".describe('Top-level plaited eval output schema.')"),
])

# ======================================================================
# CATEGORY 3: mcp-client.ts — CLIENT_INFO and path refs
# ======================================================================
replace_in_file("framework/src/cli/mcp-client.ts", [
    ("{ name: 'onbraid', version: '0.0.0' }",
     "{ name: 'plaited', version: '0.0.0' }"),
    ("`${home}/.onbraid/mcp/tokens/${host}.json`",
     "`${home}/.plaited/mcp/tokens/${host}.json`"),
    ("client_name: 'onbraid remote mcp',",
     "client_name: 'plaited remote mcp',"),
])

# ======================================================================
# CATEGORY 4: Test temp directory names
# ======================================================================
replace_in_file("framework/src/cli/tests/git-context.spec.ts", [
    ("onbraid-git-cli-", "plaited-git-cli-"),
])
replace_in_file("framework/src/cli/tests/typescript-lsp.spec.ts", [
    ("onbraid-lsp-", "plaited-lsp-"),
])
replace_in_file("framework/src/cli/tests/markdown.spec.ts", [
    ("onbraid-markdown-cli-", "plaited-markdown-cli-"),
])

# ======================================================================
# CATEGORY 5: Snapshot with [onbraid] console prefix
# ======================================================================
replace_in_file("framework/src/ui/tests/__snapshots__/template.spec.ts.snap", [
    ("console.log(&#39;[onbraid]", "console.log(&#39;[plaited]"),
])

# ======================================================================
# CATEGORY 6: framework/AGENTS.md
# ======================================================================
replace_in_file("framework/AGENTS.md", [
    ("`gh pr checks <pr-number> --repo onbraid/onbraid`.", "`gh pr checks <pr-number> --repo plaited/plaited`."),
    ("`bin/onbraid.ts`.", "`bin/plaited.ts`."),
    ("`plaited --schema` and invokable as `onbraid <command> '<json>'`.", "`plaited --schema` and invokable as `plaited <command> '<json>'`."),
    ("use `onbraid-runtime` skill", "use `plaited-runtime` skill"),
    ("use `onbraid-ui` for controller protocol", "use `plaited-ui` for controller protocol"),
])

# ======================================================================
# CATEGORY 7: framework/README.md
# ======================================================================
replace_in_file("framework/README.md", [
    ("onbraid.ts", "plaited.ts"),
    ("onbraid-ui", "plaited-ui"),
    ("onbraid/onbraid", "plaited/plaited"),
    ("/Users/eirby/Workspace/onbraid/", "/Users/eirby/Workspace/plaited/"),
    ("bun run ./bin/plaited.ts bootstrap '{\"targetDir\":\".\",\"name\":\"my-agent\"}'", "bun run ./bin/plaited.ts bootstrap '{\"targetDir\":\".\",\"name\":\"my-agent\"}'"),
])

# ======================================================================
# CATEGORY 8: framework/scripts/setup.sh
# ======================================================================
replace_in_file("framework/scripts/setup.sh", [
    ('"linking local onbraid CLI"', '"linking local plaited CLI"'),
])

# ======================================================================
# CATEGORY 9: framework/src/agent/agent-architecture.md
# ======================================================================
replace_in_file("framework/src/agent/agent-architecture.md", [
    (".onbraid/", ".plaited/"),
    ("onbraid mcp-client", "plaited mcp-client"),
])

# ======================================================================
# CATEGORY 10: dev-research README
# ======================================================================
replace_in_file("dev-research/agent-harness-research/catalog/README.md", [
    ("/Users/eirby/Workspace/onbraid/", "/Users/eirby/Workspace/plaited/"),
])

# ======================================================================
# CATEGORY 11: docs/kotlin-behavioral-design.md — com/onbraid/ paths
# ======================================================================
replace_in_file("docs/kotlin-behavioral-design.md", [
    ("com/onbraid/", "com/plaited/"),
])

# ======================================================================
# CATEGORY 12: skills/add-remote-mcp/SKILL.md
# ======================================================================
replace_in_file("skills/add-remote-mcp/SKILL.md", [
    ("Covers CLI (onbraid mcp-client)", "Covers CLI (plaited mcp-client)"),
    ("   onbraid mcp-client '{\"mode\":\"discover\",\"url\":\"https://example.com/mcp\"}'", "   plaited mcp-client '{\"mode\":\"discover\",\"url\":\"https://example.com/mcp\"}'"),
    ("   onbraid mcp-client '{\"mode\":\"call-tool\",\"url\":\"https://example.com/mcp\",\"tool\":\"search\",\"args\":{\"query\":\"...\"}}'", "   plaited mcp-client '{\"mode\":\"call-tool\",\"url\":\"https://example.com/mcp\",\"tool\":\"search\",\"args\":{\"query\":\"...\"}}'"),
    ("~/.onbraid/mcp/tokens/", "~/.plaited/mcp/tokens/"),
])

# ======================================================================
# CATEGORY 13: skills/bun-runtime/SKILL.md
# ======================================================================
replace_in_file("skills/bun-runtime/SKILL.md", [
    ('Bun.spawnSync(["onbraid", "skills"])', 'Bun.spawnSync(["plaited", "skills"])'),
])

# ======================================================================
# CATEGORY 14: skills/code-documentation/SKILL.md
# ======================================================================
replace_in_file("skills/code-documentation/SKILL.md", [
    ("via onbraid code-documentation CLI", "via plaited code-documentation CLI"),
    ("echo '{\"targets\":[\"src/agent/agent.ts\"]}' | onbraid code-documentation", "echo '{\"targets\":[\"src/agent/agent.ts\"]}' | plaited code-documentation"),
])

# ======================================================================
# CATEGORY 15: skills/code-patterns/SKILL.md
# ======================================================================
replace_in_file("skills/code-patterns/SKILL.md", [
    ("`onbraid/utils`", "`plaited/utils`"),
    ("onbraid-runtime", "plaited-runtime"),
    ("'onbraid/utils'", "'plaited/utils'"),
])

# ======================================================================
# CATEGORY 16: skills/grill-me/SKILL.md — YAML key
# ======================================================================
replace_in_file("skills/grill-me/SKILL.md", [
    ("  onbraid:", "  plaited:"),
])

# ======================================================================
# CATEGORY 17: skills/onbraid-runtime/SKILL.md
# ======================================================================
replace_in_file("skills/onbraid-runtime/SKILL.md", [
    ("name: onbraid-runtime", "name: plaited-runtime"),
    ("# onbraid-runtime", "# plaited-runtime"),
    ("`onbraid git '{\"mode\":\"context\",\"base\":\"origin/dev\",\"paths\":[\"<paths>\"],\"includeWorktrees\":true}'", "`plaited git '{\"mode\":\"context\",\"base\":\"origin/dev\",\"paths\":[\"<paths>\"],\"includeWorktrees\":true}'"),
    ("- `onbraid-context`", "- `plaited-context`"),
])

# ======================================================================
# CATEGORY 18: skills/onbraid-ui/SKILL.md
# ======================================================================
replace_in_file("skills/onbraid-ui/SKILL.md", [
    ("name: onbraid-ui", "name: plaited-ui"),
    ("Use `onbraid-runtime`", "Use `plaited-runtime`"),
    ("- `onbraid-runtime`", "- `plaited-runtime`"),
])

# ======================================================================
# CATEGORY 19: skills/train-neuro-symbolic-agent/SKILL.md
# ======================================================================
replace_in_file("skills/train-neuro-symbolic-agent/SKILL.md", [
    ("onbraid CLI, inference worker", "plaited CLI, inference worker"),
    ("<onbraid_context_json>", "<plaited_context_json>"),
    (".onbraid/", ".plaited/"),
])

# ======================================================================
# CATEGORY 20: skills/train-neuro-symbolic-agent/reference/icb-analyst-reference.md
# ======================================================================
replace_in_file("skills/train-neuro-symbolic-agent/reference/icb-analyst-reference.md", [
    ("<onbraid_context>", "<plaited_context>"),
    ("</onbraid_context>", "</plaited_context>"),
])

# ======================================================================
# CATEGORY 21: skills/onbraid-runtime/references/runtime-boundary-review.md
# ======================================================================
replace_in_file("skills/onbraid-runtime/references/runtime-boundary-review.md", [
    ("`onbraid", "`plaited"),
])

# ======================================================================
# CATEGORY 22: skills/typescript-lsp/SKILL.md
# ======================================================================
replace_in_file("skills/typescript-lsp/SKILL.md", [
    ("echo '<json>' | onbraid typescript-lsp", "echo '<json>' | plaited typescript-lsp"),
])

# ======================================================================
# CATEGORY 23: skills/you/SKILL.md
# ======================================================================
replace_in_file("skills/you/SKILL.md", [
    ("via onbraid mcp-client", "via plaited mcp-client"),
    ("Requires onbraid CLI", "Requires plaited CLI"),
])

# ======================================================================
# VERIFY: Check what's left
# ======================================================================
import subprocess
result = subprocess.run(
    ["rg", "-n", "onbraid", "-g", "!node_modules", "-g", "!.git", "-g", "!*.sqlite*"],
    capture_output=True, text=True, cwd=BASE
)
remaining = result.stdout.strip()
if remaining:
    print(f"\n=== REMAINING 'onbraid' ({len(remaining.split(chr(10)))} lines) ===")
    print(remaining)
else:
    print("\n=== NO REMAINING 'onbraid' references ===")