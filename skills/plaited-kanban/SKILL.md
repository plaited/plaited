---
name: plaited-kanban
description: Use Plaited's durable kanban CLI for work-item facts, board inspection, simple ready queues, discoveries, decisions, and event records.
license: ISC
compatibility: Requires bun
---

# plaited-kanban

Use this skill when a task involves durable work-item state, analyst-to-coder
handoff facts, board inspection, discovery records, decision audit history, or
generic work-item events.

## Purpose

`plaited kanban` is a durable ledger and projection boundary. It stores work-item
facts that agents and behavioral threads can read later. It does not decide
workflow policy, run merge simulations, verify behavioral frontiers, create
worktrees, or clean branches.

Databases created with the old policy-heavy kanban schema are rejected instead
of silently migrated. Reset or migrate those databases outside kanban before
using the ledger CLI.

Recommended loop:

1. Gather repo evidence with `plaited-context` and other evidence tools.
2. Record or update generic kanban facts.
3. Read `board`, `ready-queue`, `item`, or `decision-audit` projections.
4. Let behavioral threads or the active operator decide the next workflow action.

## Discovery

Always inspect schemas before using unfamiliar modes:

```bash
plaited kanban --schema input
plaited kanban --schema output
```

## Read Modes

Board overview:

```bash
plaited kanban '{"mode":"board","dbPath":".plaited/kanban.sqlite"}'
```

Simple ready queue:

```bash
plaited kanban '{"mode":"ready-queue","dbPath":".plaited/kanban.sqlite"}'
```

Detailed item projection:

```bash
plaited kanban '{"mode":"item","dbPath":".plaited/kanban.sqlite","workItemId":"item-123"}'
```

Decision audit:

```bash
plaited kanban '{"mode":"decision-audit","dbPath":".plaited/kanban.sqlite","workItemId":"item-123","limit":20}'
```

## Write Modes

Initialize a kanban database:

```bash
plaited kanban '{"mode":"init-db","dbPath":".plaited/kanban.sqlite"}'
```

Create or update work-item facts:

```bash
plaited kanban '{"mode":"create-work-item","dbPath":".plaited/kanban.sqlite","requestId":"req-1","requestSummary":"local task","workItemId":"item-123","title":"Implement generic ledger writes","actorType":"agent","actorId":"analyst","status":"formulated"}'
```

```bash
plaited kanban '{"mode":"update-work-item","dbPath":".plaited/kanban.sqlite","workItemId":"item-123","status":"review_pending","specPath":"specs/item-123.json","specCommitSha":"abc123"}'
```

Record related facts:

```bash
plaited kanban '{"mode":"add-dependency","dbPath":".plaited/kanban.sqlite","workItemId":"item-123","dependsOnWorkItemId":"item-122"}'
```

```bash
plaited kanban '{"mode":"record-discovery","dbPath":".plaited/kanban.sqlite","discoveryId":"disc-1","workItemId":"item-123","artifactVersion":1,"rules":[],"examples":[],"openQuestions":[],"outOfScope":[],"collectedAt":"2026-05-05T00:00:00.000Z","staleAfterAt":"2026-05-06T00:00:00.000Z"}'
```

```bash
plaited kanban '{"mode":"record-decision","dbPath":".plaited/kanban.sqlite","decisionId":"decision-1","workItemId":"item-123","decisionKind":"analyst_handoff","decision":"approved","actorType":"agent","actorId":"analyst","reason":"facts are ready","evidenceRefs":[]}'
```

```bash
plaited kanban '{"mode":"record-event","dbPath":".plaited/kanban.sqlite","workItemId":"item-123","eventKind":"status_observed","payload":{"source":"agent"}}'
```

Run behavioral-frontier, git worktree, merge, and cleanup actions through their
own tools or explicit operator commands. Kanban only stores and projects the
resulting facts.

## Source Authority

When behavior is unclear, trust the command schemas and implementation:

- `src/kanban/kanban.schemas.ts`
- `src/kanban/kanban.ts`
