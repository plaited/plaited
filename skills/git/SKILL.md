---
name: git
description: Inspect local Git status, history, worktrees, and branch context through a structured CLI.
license: ISC
compatibility: Requires bun and git
metadata:
  plaited:
    kind: skill
    origin:
      kind: first-party
    capabilities:
      - id: context.git
        type: cli
        lane: private
        phase: context
        audience: [analyst, coder]
        actions: [status, history, worktrees, context]
        sideEffects: read-only
        handler:
          type: cli
          command: scripts/git.ts
        source:
          type: first-party
---

# Git

Use this skill for structured local Git context before editing, reviewing, or
committing work.

## Usage

```bash
bun run skills/git/scripts/git.ts --schema input
bun run skills/git/scripts/git.ts '{"mode":"context","cwd":"."}'
```
