---
name: git-context
description: Gather structured local Git context before editing, reviewing, or committing via the `plaited git-context` CLI. Four modes — status, history, worktrees, context — returning branch, HEAD, upstream, staged/unstaged files, merge-base, commits-since-base, and per-path history as JSON. Replaces chaining 8+ raw git commands.
license: ISC
compatibility: Requires bun and the plaited CLI
allowed-tools: Bash
---

# Git Context

Reference for an agent assisting an engineer in gathering local Git context
before editing, reviewing, or committing. `plaited git-context` returns
structured JSON instead of raw `git status` / `git log` prose, so an agent
can parse repo state directly without scraping terminal output. It is the
structured-replacement for the 8+ raw git commands an agent would otherwise
chain to learn branch, HEAD, upstream, staged/unstaged files, merge-base,
commits-since-base, changed files, and per-path history.

## Operator surface

`plaited git-context` is a CLI command (JSON-in / JSON-out over stdio),
registered under `bin/plaited.ts`. It is **not** a library import — there
is no `plaited/git-context` public module. Invoke it as a subprocess and
parse its stdout JSON.

```bash
plaited git-context '{"mode":"context","cwd":".","base":"main"}'
```

Run `plaited git-context --help` for the usage block, or
`plaited git-context --schema input` for the full Zod-derived input schema.

## The four modes

| Mode | Returns | Required fields |
|------|---------|-----------------|
| `status` | Branch, HEAD, upstream, staged/unstaged/untracked files with counts | — |
| `history` | Merge-base, commits since `base`, changed files, per-path history | `base` |
| `worktrees` | Parsed worktree list with lock/prune metadata | — |
| `context` | Combined status + history + optional worktrees in one call | `base` |

All modes accept optional `cwd` (default `.`). `history` and `context` also
accept `paths` (default `[]`, scopes per-path history), `limit` (default 20,
max 200, caps commits-per-path), and `context` accepts `includeWorktrees`
(default `false`).

## When to use which

| Need | Mode | Notes |
|------|------|-------|
| Full picture in one round-trip | `context` | Replaces 8+ raw git commands; prefer this as the starting point |
| Just staged/unstaged state before editing | `status` | No `base` needed; cheap |
| Review what changed on a branch | `context` or `history` with `base` | `base` is the integration branch (`main`, `dev`) for the merge-base |
| Enumerate `.worktrees/<task-slug>/` per AGENTS.md lifecycle | `worktrees`, or `context` with `includeWorktrees:true` | Parsed lock/prune metadata included |
| Deep per-path history | `history` with raised `limit` | Capped at 200 to bound output |

## Examples

```bash
# Status only (no merge-base needed)
plaited git-context '{"mode":"status","cwd":"."}'

# History since the dev branch, scoped to two paths
plaited git-context '{"mode":"history","cwd":".","base":"dev","paths":["src","tests"],"limit":50}'

# Combined context with worktrees
plaited git-context '{"mode":"context","cwd":".","base":"main","includeWorktrees":true}'
```

## A common wiring mistake to avoid

Forgetting `base` on `history` or `context`. Both modes compute the
merge-base against an integration branch, and `base` is required — without
it the call errors with a Zod validation failure. Use the branch the
current work integrates into (`main`, `dev`, etc.), not the current
branch. If you only need working-tree state and don't care about
"commits since base," use `status` or `worktrees` instead, which don't
require `base`.

The second common mistake: treating `limit` as a cap on the *total* commit
list. It caps per-path history depth, not the overall commit list — raising
it pulls more history per changed file, not a broader set of commits. Raise
it for deep per-path analysis; leave the default for a review summary.

## Inspecting the contract

`plaited git-context` is a tool to use, not code to explore. Its contract is
exposed by the standard CLI flags — reach for these, not the implementation
source:

- `plaited git-context --help` — the usage block (modes, required fields,
  examples).
- `plaited git-context --schema input` — the full Zod-derived input schema
  (all four modes), the authoritative source for what each mode accepts.
- `plaited git-context --schema output` — the output schema, what each mode
  returns.

## See also

- [Behavioral](../plaited-framework/references/behavioral.md) — the runtime
  whose commits this skill helps contextualize before editing.
