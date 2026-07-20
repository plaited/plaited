---
name: frontier-analysis
description: Analyze replay-safe behavioral specs with `replayToFrontier`, `exploreFrontiers`, and `verifyFrontiers`. Use when replaying selected-event snapshots, exploring reachable frontiers, testing supplied trigger events, comparing scheduler policies, or verifying deadlock findings in Plaited behavioral code.
license: ISC
compatibility: Requires `plaited` package (SDK util)
allowed-tools: Bash Read
---

# Frontier Analysis

## Purpose

Use this skill for deterministic analysis of replay-safe behavioral specs
through the three SDK util functions exported from `plaited/behavioral`:

- `replayToFrontier` — replay a known selected-event snapshot trace and inspect the resulting frontier
- `exploreFrontiers` — explore reachable histories to surface deadlocks
- `verifyFrontiers` — verify whether a thread set is deadlock-free within an explored boundary

Use it when you need to:

- replay a known selected-event snapshot trace and inspect the resulting frontier
- explore reachable histories to surface deadlocks
- verify whether a thread set is deadlock-free within an explored boundary
- inspect frontier candidate and enabled event sets
- include supplied external trigger events in exploration
- compare scheduler behavior with all-enabled exploration

## API Surface

### Signature

```ts
replayToFrontier({ threads: Thread[], snapshotMessages?: SnapshotMessage[], topic?: string }): ReplayToFrontierResult
exploreFrontiers(args: ExploreFrontiersArgs): ExploreFrontiersResult
verifyFrontiers(args: ExploreFrontiersArgs): VerifyFrontiersResult
```

### Types

Threads are JSON tuples: `['label', { rules: Idioms[], once?: true }]`.

```ts
type Thread = [string, { rules: Idioms[]; once?: true }]
```

Each `Idiom` is a sync point with `request`, `waitFor`, `block`, and/or `interrupt`.
`detailSchema` on listeners is JSON Schema (compiled via Ajv at registration time).

## When To Use Which Function

- `replayToFrontier`: inspect one concrete history and the frontier that follows it
- `exploreFrontiers`: enumerate reachable histories and collect deadlock findings
- `verifyFrontiers`: derive a compact pass/fail/truncated result from exploration

Use `replayToFrontier` first when you already have a suspected event sequence.
Use `exploreFrontiers` when you need to find problematic histories.
Use `verifyFrontiers` when you need a pass/fail/truncated summary.

## Usage Examples

### Replay One History

```ts
import { replayToFrontier } from 'plaited/behavioral'
import type { Thread, SnapshotMessage } from 'plaited/behavioral'

const threads: Thread[] = [
  ['chooseA', { rules: [{ request: { type: 'A' } }], once: true }],
]

const snapshotMessages: SnapshotMessage[] = []

const result = replayToFrontier({ threads, snapshotMessages })
// result.frontier.status === 'ready' with candidate 'A'
```

### Explore Reachable Histories

```ts
import { exploreFrontiers } from 'plaited/behavioral'
import type { Thread } from 'plaited/behavioral'

const threads: Thread[] = [
  ['watcher', { rules: [{ waitFor: [{ type: 'ping' }] }, { request: { type: 'ack' } }], once: true }],
]

const result = exploreFrontiers({
  threads,
  triggers: [{ type: 'ping' }],
  strategy: 'bfs',
  maxDepth: 2,
})
// result.findings — any deadlocks found
// result.report.visitedCount — how many distinct frontiers were explored
// result.report.truncated — true if maxDepth stopped exploration
```

### Verify Scheduler Policy

```ts
import { verifyFrontiers } from 'plaited/behavioral'

const result = verifyFrontiers({
  threads,
  strategy: 'bfs',
  selectionPolicy: 'scheduler',
  maxDepth: 8,
})
// result.status: 'verified' | 'failed' | 'truncated'
```

## Output Interpretation

- `deadlock` frontier status means candidates exist but none are enabled
- `idle` means no candidate events are currently requested
- `traces[].snapshotMessages` records each explored history plus its frontier
- `findings[].snapshotMessages` is the reproducible sequence to replay first
- `report.truncated` means `maxDepth` stopped exploration before completion
- `topic` is passed through to `generateRulesFunctions` for topic-stamped thread rules

## Review Discipline

- Prefer replaying a finding history before claiming a bug
- Do not treat `truncated` verification as a pass
- When deadlocks appear, inspect whether the issue is real coordination logic
  or an intentionally blocked frontier
- Pair frontier findings with nearby tests before changing runtime behavior
- Threads are pure JSON tuples carrying JSON-Schema `detailSchema` constraints
  — no Zod schemas, no non-serializable values reach the frontier engine