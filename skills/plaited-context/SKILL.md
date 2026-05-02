---
name: plaited-context
description: SQLite-backed Plaited codebase search and context assembly. Use before implementing, reviewing, or updating docs to gather source-grounded files, symbols, patterns, tests, skills, and prior findings.
license: ISC
compatibility: Requires bun
---

# plaited-context

## Purpose

`plaited-context` is a script-first operational context layer for Plaited. It
indexes source files, AGENTS operational instructions, wiki/reference docs,
skills, and findings into SQLite so follow-on work starts from source-grounded
evidence instead of memory. It is also the canonical home for deterministic
runtime boundary analysis and flow review evidence.

Use it before:

- implementing a feature or fix
- reviewing a slice or PR
- reviewing agent-authored worktree state before PR handoff
- updating wiki/reference docs and checking for stale guidance
- large code, docs, or skill edits that need source-grounded context first

## Operational Context

The scripts resolve runtime context into one of three modes:

- `repo`: running inside the Plaited source repository
- `package`: running from a `node_modules/plaited` installation
- `workspace`: running from another workspace context

The resolver reports:

```ts
type OperationalContext = {
  mode: 'repo' | 'package' | 'workspace'
  cwd: string
  workspaceRoot: string
  repoRoot?: string
  packageRoot?: string
  nodeHome?: string
  dbPath: string
}
```

Override order for DB path:

1. JSON input `dbPath`
2. `PLAITED_CONTEXT_DB`
3. default `.plaited/context.sqlite` under resolved workspace/node-home

`PLAITED_NODE_HOME` is respected. Defaults never target writable paths inside
`node_modules` package files.

## DB Location Rules

- `assets/` is static shipped material only (`schema.sql`, query templates).
- Writable DB storage is outside skill assets by default.
- Recommended default DB location: `.plaited/context.sqlite`.

## Script Workflow

1. Initialize DB

```bash
bun skills/plaited-context/scripts/init-db.ts '{"dbPath":".plaited/context.sqlite"}'
```

2. Scan and index source/wiki/skills/AGENTS instructions

```bash
bun skills/plaited-context/scripts/scan.ts '{"rootDir":".","include":["AGENTS.md","src","skills","docs"],"force":false}'
```

3. Assemble task context

```bash
bun skills/plaited-context/scripts/context.ts '{"task":"review runtime boundary diagnostics","mode":"review","paths":["src/worker/worker.ts"]}'
```

4. Assemble wiki context (relevance + cleanup candidates)

```bash
bun skills/plaited-context/scripts/wiki-context.ts '{"task":"review runtime boundary architecture","paths":["src/worker"],"limit":10}'
```

5. Run targeted search

```bash
bun skills/plaited-context/scripts/search.ts '{"query":"useSnapshot reportSnapshot","limit":20}'
```

6. Run TypeScript LSP probes for alias-heavy boundary flows:

```bash
bun skills/typescript-lsp/scripts/run.ts '{"file":"src/worker/worker.ts","operations":[{"type":"symbols"}]}'
bun skills/typescript-lsp/scripts/run.ts '{"file":"src/worker/worker.ts","operations":[{"type":"references","line":120,"character":8}]}'
bun skills/typescript-lsp/scripts/run.ts '{"file":"src/worker/worker.ts","operations":[{"type":"definition","line":120,"character":8}]}'
```

8. Assemble local read-only Git context for review/planning evidence

```bash
bun skills/plaited-context/scripts/git-context.ts '{"base":"origin/dev","paths":["skills/plaited-context"],"includeWorktrees":true}'
bun skills/plaited-context/scripts/git-history.ts '{"base":"origin/dev","paths":["skills/plaited-context"],"limit":20}'
bun skills/plaited-context/scripts/git-worktrees.ts '{}'
```

7. Record findings with evidence

```bash
bun skills/plaited-context/scripts/record-finding.ts '{"finding":{"kind":"anti-pattern","status":"candidate","summary":"Internal handlers should not catch ZodError locally.","evidence":[{"path":"src/worker/worker.ts","line":100,"symbol":"startWorker"}]}}'
```

8. Export review JSON

```bash
bun skills/plaited-context/scripts/export-review.ts '{"status":["candidate","validated"],"format":"json"}'
```

## Follow-Up Analysis

`plaited-context` assembles source-grounded context; it does not run
verification tools by default. When a task mentions behavioral specs,
frontiers, replay, deadlocks, trigger sequences, or priority-order sensitivity,
assemble context first, then use `plaited-frontier-analysis` for the
`behavioral-frontier` CLI workflow.

Useful follow-up commands:

```bash
bun ./bin/plaited.ts behavioral-frontier --schema input
bun ./bin/plaited.ts behavioral-frontier '{"mode":"verify","specPath":"./specs.jsonl","strategy":"bfs","selectionPolicy":"scheduler","priorityOrderMode":"rotations"}'
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

All scripts accept one JSON argument and print JSON output. They support schema
introspection:

```bash
bun skills/plaited-context/scripts/<script>.ts --schema input
bun skills/plaited-context/scripts/<script>.ts --schema output
```

JSON exports are intended for PR and human review workflows.
