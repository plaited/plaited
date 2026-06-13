---
name: git-context
description: Inspect local Git status, history, worktrees, and branch context through a structured CLI. Returns JSON instead of raw git output.
license: ISC
compatibility: Requires `onbraid` CLI and git
---

# Git Context

Use this skill for structured local Git context before editing, reviewing, or
committing work.

## Usage

```bash
`onbraid git-context --schema input
`onbraid git-context '{"mode":"context","cwd":".","base":"main"}'
```

## Modes

| Mode | Returns |
|------|---------|
| `status` | Branch, HEAD, upstream, staged/unstaged/untracked files with counts |
| `history` | Merge-base, commits since base, changed files, per-path history |
| `worktrees` | Parsed worktree list with lock/prune metadata |
| `context` | Combined status + history + optional worktrees in one call |

The `context` mode replaces 8+ raw git commands with a single structured JSON response.
