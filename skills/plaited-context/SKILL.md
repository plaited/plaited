---
name: plaited-context
description: Mutable context meta-skill that orchestrates stable plaited CLI evidence tools and owns user-tunable findings persistence/adaptation surfaces.
license: ISC
compatibility: Requires bun
metadata:
  plaited:
    kind: skill
    origin:
      kind: first-party
    capabilities:
      - id: context.init
        type: cli
        lane: private
        phase: context
        audience: [analyst]
        actions: [initialize]
        sideEffects: workspace-write
        handler:
          type: cli
          command: scripts/init-db.ts
        source:
          type: first-party
      - id: context.record-finding
        type: cli
        lane: private
        phase: analysis
        audience: [analyst]
        actions: [record, persist]
        sideEffects: workspace-write
        handler:
          type: cli
          command: scripts/record-finding.ts
        source:
          type: first-party
      - id: context.query-cache
        type: cli
        lane: private
        phase: context
        audience: [analyst, coder]
        actions: [query, read]
        sideEffects: read-only
        handler:
          type: cli
          command: scripts/query-cache.ts
        source:
          type: first-party
      - id: workflow.context-orchestration
        type: workflow
        lane: private
        phase: context
        audience: [analyst]
        actions: [collect, cache, synthesize]
        sideEffects: workspace-write
        source:
          type: first-party
---

# plaited-context

## Purpose

`plaited-context` is a mutable meta skill. It orchestrates stable `plaited`
CLI evidence tools and owns the user-tunable persistence and finding adaptation
surface for review workflows.

Use it before:

- implementing a feature or fix
- reviewing a slice or PR
- reviewing agent-authored worktree state before PR handoff
- updating wiki/reference docs and checking for stale guidance
- large code, docs, or skill edits that need source-grounded context first

## Evidence Producers

Use stable `plaited` tools for evidence collection:

- `plaited agents-md`
- `plaited git`
- `plaited kanban`
- `plaited wiki`
- `plaited skills`
- `plaited typescript-lsp`

Examples:

```bash
plaited agents-md '{"mode":"relevant","rootDir":".","paths":["src/worker/worker.ts"]}'
plaited git '{"mode":"context","base":"origin/dev","paths":["src/worker/worker.ts"],"includeWorktrees":true}'
plaited kanban '{"mode":"item","dbPath":".plaited/kanban.sqlite","workItemId":"item-123"}'
plaited wiki '{"mode":"context","rootDir":".","paths":["docs"],"task":"review runtime boundary architecture"}'
plaited typescript-lsp '{"file":"src/worker/worker.ts","operations":[{"type":"symbols"}]}'
plaited skills '{"mode":"catalog","rootDir":"."}'
```

## Mutable Persistence Surface

This skill owns persistence semantics and remains mutable by user choice:

- DB backend choice (SQLite by default, replaceable)
- `assets/schema.sql` and any local migration/init policy
- finding row semantics
- cached top-level CLI evidence rows
- export semantics for persisted findings and cache rows

Do not assume context storage must be pre-created for every task. Create it
only when findings persistence/export is needed.

### Optional initialization

```bash
bun skills/plaited-context/scripts/init-db.ts '{"dbPath":".plaited/context.sqlite"}'
```

### Record findings

```bash
bun skills/plaited-context/scripts/record-finding.ts '{"finding":{"kind":"anti-pattern","status":"candidate","summary":"Internal handlers should not catch ZodError locally.","evidence":[{"path":"src/worker/worker.ts","line":100,"symbol":"startWorker"}]}}'
```

### Export findings

```bash
bun skills/plaited-context/scripts/export-review.ts '{"status":["candidate","validated"],"format":"json"}'
```

### Cache evidence rows

```bash
bun skills/plaited-context/scripts/cache-evidence.ts '{"tool":"git","topic":"context","key":"src/worker","command":"plaited git \"{...}\"","input":{"mode":"context"},"output":{"ok":true},"tags":["review"]}'
```

### Query cached evidence

```bash
bun skills/plaited-context/scripts/query-cache.ts '{"tool":"git","topic":"context","limit":10}'
```

## Mutable Adaptation Surface

`adapt-findings.ts` is a skill-local best-effort converter for generated tool
or skill output that does not have a stable canonical envelope yet.

Contract:

- returns `{ ok, findings, warnings }`
- never writes DB state directly
- may drop malformed entries with warnings

## Follow-Up Analysis

`plaited-context` does not assemble or index repository context directly.
Collect evidence with top-level `plaited` commands, then cache/query/export
with the persistence scripts in this skill.

When a task mentions behavioral specs, frontiers, replay, deadlocks, trigger
sequences, or scheduler-policy sensitivity, use `plaited-frontier-analysis`
with the `behavioral-frontier` CLI workflow.

When a task needs durable analyst/coder handoff, board state, ready queues,
or gate decision audits, use `plaited-kanban` after evidence collection.

When a task mentions dynamic skills, generated skills, capability registries,
MCP-backed skill generation, or converting external tool surfaces into local
skills, collect context from the dynamic skills doctrine and skill generation
surfaces:

- `docs/wiki/dynamic-skills-agent.md`
- `src/skills/skills.schema.ts`
- `skills/add-remote-mcp/SKILL.md`
- `skills/add-protected-remote-mcp/SKILL.md`

Useful follow-up commands:

```bash
plaited behavioral-frontier --schema input
plaited behavioral-frontier '{"mode":"verify","specPath":"./specs.jsonl","strategy":"bfs","selectionPolicy":"scheduler","maxDepth":8}'
plaited kanban --schema input
plaited wiki '{"mode":"context","rootDir":".","paths":["docs/wiki","src/skills","skills"],"task":"dynamic skill generation capability registry"}'
plaited skills '{"mode":"registry","rootDir":"."}'
```

## Evidence Rule

Do not promote guesses into validated findings.

- `candidate` findings may have optional evidence while being triaged.
- `validated` and `retired` findings must include evidence.

## Source Authority

When sources conflict in review work, prioritize:

1. code in `src/` and other executable sources
2. `AGENTS.md` operational instructions by scope
3. skill instructions (`skills/*/SKILL.md`)
4. wiki/reference docs (for synthesis and background)

`AGENTS.md` files are operational instructions, not wiki docs.

Wiki docs are searchable synthesis/reference material and do not outrank code,
`AGENTS.md`, or applicable skills.

Use direct `plaited` evidence commands for collection, then optionally cache
and query results with `cache-evidence.ts` and `query-cache.ts`.

## Script Contracts

All remaining mutable scripts accept one JSON argument and print JSON output.
They support schema introspection:

```bash
bun skills/plaited-context/scripts/<script>.ts --schema input
bun skills/plaited-context/scripts/<script>.ts --schema output
```

Remaining script surfaces:

- `init-db.ts`
- `adapt-findings.ts`
- `record-finding.ts`
- `cache-evidence.ts`
- `query-cache.ts`
- `export-review.ts`

JSON exports are intended for PR and human review workflows.
