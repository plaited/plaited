---
name: plaited-kanban
description: Use Plaited's durable kanban CLI for analyst/coder handoff, board inspection, ready queues, gate decisions, execution lifecycle actions, and decision audits.
license: ISC
compatibility: Requires bun
---

# plaited-kanban

Use this skill when a task involves durable work-item state, analyst-to-coder handoff,
ready work selection, red/frontier/merge gates, execution lifecycle transitions, or
reviewing kanban decision history.

## Purpose

`plaited kanban` is the durable memory boundary for small local actor loops.
Do not rely on chat memory to pass context from analyst to coder. The analyst
should gather evidence, write durable kanban state, and the coder should read
the ready queue and item projection before acting.

Recommended loop:

1. Analyst gathers repo evidence with `plaited-context` and other evidence tools.
2. Analyst records or updates kanban gate/work state.
3. Coder reads `ready-queue` and `item` projections.
4. Coder executes the next event against the durable item contract.
5. Analyst reviews `decision-audit` and records follow-up gates.

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

Ready queue for the next deterministic action:

```bash
plaited kanban '{"mode":"ready-queue","dbPath":".plaited/kanban.sqlite"}'
```

Detailed item context for coder execution:

```bash
plaited kanban '{"mode":"item","dbPath":".plaited/kanban.sqlite","workItemId":"item-123"}'
```

Decision audit for analyst review:

```bash
plaited kanban '{"mode":"decision-audit","dbPath":".plaited/kanban.sqlite","workItemId":"item-123","limit":20}'
```

## Write Modes

Initialize a kanban database:

```bash
plaited kanban '{"mode":"init-db","dbPath":".plaited/kanban.sqlite"}'
```

Record a red approval decision after evidence is assembled:

```bash
plaited kanban '{"mode":"record-red-approval","dbPath":".plaited/kanban.sqlite","decisionId":"gate-red-1","workItemId":"item-123","actorType":"agent","actorId":"analyst","reason":"targeted failing behavior is captured","discoveryArtifactId":"disc-1","failures":[{"category":"expected_behavior_fail","checkName":"bun test src/kanban/tests/kanban.cli.spec.ts","detail":"expected behavior is not implemented"}],"evidenceRefs":[]}'
```

Other write modes are schema-described and wrap the corresponding durable
kanban operations:

- `revoke-stale-red-approval`
- `record-frontier-verification`
- `record-merge-simulation`
- `record-escalation`
- `start-execution`
- `run-post-merge-cleanup`

## Actor IDs

Use stable actor ids from `AGENT_RUNTIMES`:

- `analyst` for evidence gathering, gate review, and decision recording
- `coder` for implementation execution and worktree actions

Concrete model IDs and inference engines belong to `src/engines`, not kanban
state or skill instructions.

## Source Authority

When behavior is unclear, trust the command schemas and implementation:

- `src/kanban/kanban.schemas.ts`
- `src/kanban/kanban.ts`
