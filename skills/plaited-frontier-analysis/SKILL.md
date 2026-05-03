---
name: plaited-frontier-analysis
description: Analyze replay-safe behavioral specs with the `behavioral-frontier` CLI. Use when replaying selected-event snapshots, exploring reachable frontiers, testing supplied trigger events, comparing scheduler policies, or verifying deadlock findings in Plaited behavioral code.
license: ISC
compatibility: Requires bun
---

# plaited-frontier-analysis

## Purpose

Use this skill for deterministic analysis of replay-safe behavioral specs
through the `behavioral-frontier` command.

Use it when you need to:

- replay a known selected-event snapshot trace and inspect the resulting frontier
- explore reachable histories to surface deadlocks
- verify whether a thread set is deadlock-free within an explored boundary
- inspect frontier candidate and enabled event sets
- include supplied external trigger events in exploration
- compare scheduler behavior with all-enabled exploration

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
set.

## Input Rules

- provide exactly one of `specs` or `specPath`
- `specPath` is JSONL with one behavioral spec object per line
- use `cwd` when `specPath` should resolve from a specific base directory
- in `replay` mode, provide `snapshotMessages` when replaying a concrete trace
- selected ingress events use `selected.ingress: true`
- in `explore`/`verify`, use `triggers` to supply external events that may be
  selected when a pending thread waits for or is interrupted by them
- use `selectionPolicy: 'scheduler'` when priority order should follow runtime
  scheduler choice; default `all-enabled` explores every enabled request branch

## Common Workflows

### Replay One History

```bash
bunx plaited behavioral-frontier '{"mode":"replay","specs":[{"label":"chooseA","thread":{"once":true,"syncPoints":[{"request":{"type":"A"}}]}}],"snapshotMessages":[]}'
```

Read:

- `frontier.status`
- `frontier.candidates`
- `frontier.enabled`

### Explore Reachable Histories

```bash
bunx plaited behavioral-frontier '{"mode":"explore","specs":[{"label":"watcher","thread":{"once":true,"syncPoints":[{"waitFor":[{"type":"ping"}]},{"request":{"type":"ack"}}]}}],"triggers":[{"type":"ping"}],"strategy":"bfs","maxDepth":2}'
```

Start with `bfs` unless you have a reason to prefer `dfs`.
Use `maxDepth` to cap search when the state space is large.

### Verify Scheduler Policy

```bash
bunx plaited behavioral-frontier '{"mode":"verify","specPath":"./specs.jsonl","strategy":"bfs","selectionPolicy":"scheduler","maxDepth":8}'
```

Interpret status as:

- `verified`: no findings in explored space
- `failed`: one or more deadlock findings were found
- `truncated`: exploration was capped before a full conclusion

## Output Interpretation

- `deadlock` frontier status means candidates exist but none are enabled
- `idle` means no candidate events are currently requested
- `traces[].snapshotMessages` records each explored history plus its frontier
- `findings[].snapshotMessages` is the reproducible sequence to replay first
- `report.truncated` means `maxDepth` stopped exploration before completion

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
