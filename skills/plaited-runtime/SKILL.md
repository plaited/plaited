---
name: plaited-runtime
description: Plaited runtime doctrine for behavioral coordination, MSS/module boundaries, projection semantics, and generated module actor rules. Use with plaited-context for source-grounded implementation and review.
license: ISC
compatibility: Requires bun
---

# plaited-runtime

## Purpose

Use this skill as the compact doctrine for current Plaited runtime work:
behavioral coordination, MSS/module boundaries, projection semantics, and
module actor boundaries.

## Before Coding Or Reviewing

Run `plaited-context` first for source-grounded context assembly:

```bash
bun skills/plaited-context/scripts/context.ts '{"task":"<task>","mode":"review","paths":["<paths>"]}'
```

For module actor work, run deterministic pattern and flow evidence:

```bash
bun skills/plaited-context/scripts/module-patterns.ts '{"files":["<module-files>"]}'
bun skills/plaited-context/scripts/module-flow.ts '{"files":["<module-files>"],"format":"json"}'
bun skills/plaited-context/scripts/module-flow.ts '{"files":["<module-files>"],"format":"mermaid"}'
```

Use `"record": true` only when a plaited-context DB has already been
initialized or a `dbPath` is provided for the review run.

## Behavioral Runtime Rules

- Behavioral programming is the deterministic runtime coordination substrate.
- Use `behavioral()`, `bThread`, `bSync`, `useFeedback`, and `useSnapshot`.
- Do not write raw generators/yields in repo behavioral code.
- Threads coordinate timing and constraints; handlers perform side effects.
- Blocks are observable in snapshots and do not queue blocked events.
- Add dynamic threads before triggering events they must observe.
- Use `detailMatch: 'invalid'` when blocking malformed payloads.

## Module / MSS Rules

- MSS defines what may be projected.
- Runtime or supervisor decides whether projection is allowed.
- Protocol adapters expose approved projections.
- Protocols are mechanics, not ontology.
- Preserve source/provenance; do not rewrite source to fake approval.
- Auth/session/token mechanics are not modnet ontology.

## Projection Rules

- Treat projection policy as runtime-governed semantics, not transport default.
- Expose only approved projections through adapters and module boundaries.
- Keep trust/authority assumptions explicit in runtime policy.

## Module Actor Boundary Rules

- Core modules under `src/modules` are flat single TypeScript files.
- Do not create nested module implementation folders under `src/modules`.
- External boundary ingress should parse with `.parse(...)` inside `try/catch`
  and publish diagnostics/snapshots.
- Internal `useExtension(...)` feedback/control handlers parse strictly and
  should not catch `ZodError` locally.
- Actor/runtime failures use `reportSnapshot(...)`, not transport diagnostics
  or synthetic diagnostic events unless there is a real protocol consumer.

## Diagnostics And Parsing Rules

- External transports may emit transport diagnostics for malformed ingress.
- Internal actor/control parsing failures should surface as
  `feedback_error`/`extension_error` snapshot diagnostics.
- Prefer strict `.parse(...)` in runtime handlers over local `safeParse`
  silent-drop patterns.

## What Not To Assume

Other than the two-model inference approach and its communication through the
inference websocket runtime actor/server, docs and skills are not authoritative
when they mention event names, module names, actor APIs, server surfaces, or
runtime contracts that do not exist in current `src/` code or tests.

Do not promote doc-only names into doctrine unless they exist in source/tests
or are required by an external spec.

Treat `docs/INFRASTRUCTURE.md` as deployment target material, not implemented
runtime doctrine. Treat `docs/hypothetical-architecture.md` as non-normative
research.

## References

- [references/behavioral-runtime.md](references/behavioral-runtime.md)
- [references/modnet-mss-lineage.md](references/modnet-mss-lineage.md)
- [references/module-actor-boundaries.md](references/module-actor-boundaries.md)
- [references/agent-runtime-notes.md](references/agent-runtime-notes.md)

## Related Skills

- `plaited-context`
- `mss-module-review`
- `typescript-lsp`
- `plaited-development`
