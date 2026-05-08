---
name: agents-md
description: Read and validate scoped AGENTS.md instruction files for the active workspace.
license: ISC
compatibility: Requires bun
metadata:
  plaited:
    kind: skill
    origin:
      kind: first-party
    capabilities:
      - id: context.agents-md
        type: cli
        lane: private
        phase: context
        audience: [analyst, coder]
        actions: [list, relevant]
        sideEffects: read-only
        handler:
          type: cli
          command: scripts/agents-md.ts
        source:
          type: first-party
---

# AGENTS.md

Use this skill to discover root and scoped `AGENTS.md` files, validate their
local markdown links, and load only the entries relevant to target paths.

## Usage

```bash
bun run skills/agents-md/scripts/agents-md.ts --schema input
bun run skills/agents-md/scripts/agents-md.ts '{"mode":"relevant","rootDir":".","paths":["src/worker/worker.ts"]}'
```
