---
name: wiki
description: Scan workspace markdown docs for task-relevant context, local link diagnostics, and suggested follow-up commands.
license: ISC
compatibility: Requires bun
metadata:
  plaited:
    kind: skill
    origin:
      kind: first-party
    capabilities:
      - id: docs.wiki
        type: cli
        lane: private
        phase: context
        audience: [analyst, coder]
        actions: [context, diagnose]
        sideEffects: read-only
        handler:
          type: cli
          command: scripts/wiki.ts
        source:
          type: first-party
---

# Wiki

Use this skill to scan workspace markdown documentation for task-relevant context and local-link diagnostics.

## Usage

```bash
bun run skills/wiki/scripts/wiki.ts '{"mode":"context","rootDir":".","paths":["docs"],"task":"review runtime boundary"}'
bun run skills/wiki/scripts/wiki.ts '{"mode":"diagnose","rootDir":".","paths":["docs"]}'
```
