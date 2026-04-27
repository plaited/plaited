---
name: plaited-frontier-analysis
description: Analyze replay-safe behavioral thread modules with the `behavioral-frontier` CLI. Use when replaying selected event histories, exploring reachable frontiers, or verifying deadlock findings in Plaited behavioral code.
license: ISC
compatibility: Requires bun
---

# plaited-frontier-analysis

## Purpose

Use this skill for deterministic analysis of replay-safe behavioral thread
modules through the `behavioral-frontier` command.

Use it when you need to:

- replay a known selected-event history and inspect the resulting frontier
- explore reachable histories to surface deadlocks
- verify whether a thread set is deadlock-free within an explored boundary
- inspect pending-thread summaries and candidate event sets

Run `plaited-context` first to gather the relevant files and tests. Use
`plaited-runtime` when you need current doctrine for behavioral semantics.

## Command Surface

Prefer the installed CLI surface:

```bash
bunx plaited behavioral-frontier --schema input
bunx plaited behavioral-frontier --schema output
```

Inside this repository, `bin/plaited.ts` is equivalent:

```bash
bun ./bin/plaited.ts behavioral-frontier --schema input
```

## When To Use Which Mode

- `replay`: inspect one concrete history and the frontier that follows it
- `explore`: enumerate reachable histories and collect deadlock findings
- `verify`: derive a verification status from exploration output

Use `replay` first when you already have a suspected event sequence.
Use `explore` when you need to find problematic histories.
Use `verify` when you need a compact pass/fail/truncated result for a thread
module.

## Input Rules

- `modulePath` must point to a replay-safe thread module
- the module must export a `BThreads` object, a function returning `BThreads`,
  or an async function returning `BThreads`
- use `exportName` when the module does not use a default export
- use `cwd` when `modulePath` or `historyPath` should resolve from a specific
  base directory
- in `replay` mode, provide either `history` or `historyPath`, never both
- history rows use `source: 'trigger' | 'request'`

## Common Workflows

### Replay One History

```bash
bunx plaited behavioral-frontier '{"mode":"replay","modulePath":"src/behavioral/tests/fixtures/replay-safe-threads.ts","history":[{"type":"A","source":"request"}]}'
```

Read:

- `frontier.status`
- `frontier.candidates`
- `frontier.enabled`
- `pendingSummary`

### Explore Reachable Histories

```bash
bunx plaited behavioral-frontier '{"mode":"explore","modulePath":"src/behavioral/tests/fixtures/replay-safe-threads.ts","strategy":"bfs","includeFrontierSummaries":true}'
```

Start with `bfs` unless you have a reason to prefer `dfs`.
Use `maxDepth` to cap search when the state space is large.

### Verify A Thread Module

```bash
bunx plaited behavioral-frontier '{"mode":"verify","modulePath":"src/behavioral/tests/fixtures/replay-safe-threads.ts","strategy":"bfs"}'
```

Interpret status as:

- `verified`: no findings in explored space
- `failed`: one or more deadlock findings were found
- `truncated`: exploration was capped before a full conclusion

## Output Interpretation

- `deadlock` frontier status means candidates exist but none are enabled
- `idle` means no candidate events are currently requested
- `pendingSummary` shows which threads are waiting, blocking, or requesting
- `findings[].history` is the reproducible sequence to replay first
- `frontierSummaries` are useful when you need broad trace coverage, not just
  terminal findings

## Review Discipline

- Prefer replaying a finding history before claiming a bug
- Do not treat `truncated` verification as a pass
- When deadlocks appear, inspect whether the issue is real coordination logic
  or an intentionally blocked frontier
- Pair frontier findings with nearby tests before changing runtime behavior

## Related Skills

- `plaited-context`
- `plaited-runtime`
- `typescript-lsp`
