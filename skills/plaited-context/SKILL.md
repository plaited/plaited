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
evidence instead of memory.

Use it before:

- implementing a feature or fix
- reviewing a slice or PR
- updating wiki/reference docs and checking for stale guidance

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
bun skills/plaited-context/scripts/context.ts '{"task":"review module actor diagnostics","mode":"review","paths":["src/modules/example.ts"]}'
```

4. Run targeted search

```bash
bun skills/plaited-context/scripts/search.ts '{"query":"useSnapshot reportSnapshot","limit":20}'
```

5. Record findings with evidence

```bash
bun skills/plaited-context/scripts/record-finding.ts '{"finding":{"kind":"anti-pattern","status":"candidate","summary":"Internal handlers should not catch ZodError locally.","evidence":[{"path":"src/modules/example.ts","line":100,"symbol":"server_start"}]}}'
```

6. Export review JSON

```bash
bun skills/plaited-context/scripts/export-review.ts '{"status":["candidate","validated"],"format":"json"}'
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

## Script Contracts

All scripts accept one JSON argument and print JSON output. They support schema
introspection:

```bash
bun skills/plaited-context/scripts/<script>.ts --schema input
bun skills/plaited-context/scripts/<script>.ts --schema output
```

JSON exports are intended for PR and human review workflows.
