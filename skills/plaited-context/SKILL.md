---
name: plaited-context
description: Mutable context meta-skill that orchestrates stable plaited CLI evidence tools and owns user-tunable findings persistence/adaptation surfaces.
license: ISC
compatibility: Requires bun
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

- `plaited agents`
- `plaited git`
- `plaited wiki`
- `plaited skills`
- `skills/typescript-lsp/scripts/run.ts` (stable TypeScript LSP runner)

Examples:

```bash
bun ./bin/plaited.ts agents '{"mode":"relevant","rootDir":".","paths":["src/worker/worker.ts"]}'
bun ./bin/plaited.ts git '{"mode":"context","base":"origin/dev","paths":["src/worker/worker.ts"],"includeWorktrees":true}'
bun ./bin/plaited.ts wiki '{"mode":"context","rootDir":".","paths":["docs"],"task":"review runtime boundary architecture"}'
bun skills/typescript-lsp/scripts/run.ts '{"file":"src/worker/worker.ts","operations":[{"type":"symbols"}]}'
bun ./bin/plaited.ts skills '{"mode":"catalog","rootDir":"."}'
```

## Mutable Persistence Surface

This skill owns persistence semantics and remains mutable by user choice:

- DB backend choice (SQLite by default, replaceable)
- `assets/schema.sql` and any local migration/init policy
- finding row semantics and export semantics

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

## Mutable Adaptation Surface

`adapt-findings.ts` is a skill-local best-effort converter for generated tool
or skill output that does not have a stable canonical envelope yet.

Contract:

- returns `{ ok, findings, warnings }`
- never writes DB state directly
- may drop malformed entries with warnings

## Follow-Up Analysis

`plaited-context` assembles source-grounded context; it does not run
verification tools by default. When a task mentions behavioral specs,
frontiers, replay, deadlocks, trigger sequences, or scheduler-policy
sensitivity, assemble context first, then use `plaited-frontier-analysis` for the
`behavioral-frontier` CLI workflow.

Useful follow-up commands:

```bash
bun ./bin/plaited.ts behavioral-frontier --schema input
bun ./bin/plaited.ts behavioral-frontier '{"mode":"verify","specPath":"./specs.jsonl","strategy":"bfs","selectionPolicy":"scheduler","maxDepth":8}'
```

## Evidence Rule

Do not promote guesses into validated findings.

- `candidate` findings may have optional evidence while being triaged.
- `validated` and `retired` findings must include evidence.

## Source Authority

When sources conflict, prioritize:

1. code in `src/` and other executable sources
2. `AGENTS.md` operational instructions by scope
3. skill instructions (`skills/*/SKILL.md`)
4. wiki/reference docs (for synthesis and background)
5. other indexed text

`AGENTS.md` files are operational instructions, not wiki docs.

Wiki docs are searchable synthesis/reference material and do not outrank code,
`AGENTS.md`, or applicable skills.

Wiki cleanup candidates are review evidence only; they are not automatic rewrite
actions.

Use `scan.ts`, `search.ts`, `context.ts`, and `wiki-context.ts` to assemble
context instead of manually reading broad docs trees.

## Git Context Scope

Git context in this skill is read-only evidence for review and planning:

- local branch/HEAD/upstream state
- worktree state and possible stale/prunable branches
- merge-base, commits since base, changed files since base
- path-specific recent commit history

Git context augments code/test/skill/wiki context; it does not replace source
or test evidence and does not override `AGENTS.md`.

Git context commands in this skill do not authorize merge/rebase/reset/stash
mutation, branch deletion, or worktree removal.

## Script Contracts

All remaining mutable scripts accept one JSON argument and print JSON output.
They support schema introspection:

```bash
bun skills/plaited-context/scripts/<script>.ts --schema input
bun skills/plaited-context/scripts/<script>.ts --schema output
```

JSON exports are intended for PR and human review workflows.
