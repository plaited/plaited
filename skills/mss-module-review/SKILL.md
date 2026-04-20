---
name: mss-module-review
description: Deterministic MSS/module actor review gate plus flow evidence generation with TypeScript-LSP-assisted ambiguity checks.
---

# mss-module-review

Use this skill as a compatibility/review entrypoint when reviewing or validating
agent-authored MSS/module runtime actors.

Primary ownership now lives in `skills/plaited-context/scripts/module-patterns.ts`
and `skills/plaited-context/scripts/module-flow.ts`. This skill keeps legacy
public command paths stable while delegating to the plaited-context
implementation.

It combines:
- deterministic module pattern diagnostics
- type-aware inspection with `typescript-lsp`
- module flow graph extraction
- Mermaid review diagrams
- generative architectural review

## Hard Gate vs Review Artifact

- `check-module-patterns.ts` remains the hard deterministic gate entrypoint
  (compatibility wrapper to `plaited-context/module-patterns.ts`).
- `render-module-flow.ts` remains required review evidence entrypoint
  (compatibility wrapper to `plaited-context/module-flow.ts`).
- TypeScript LSP probes are used to resolve ambiguity and verify symbol identity.
- Generative review is required to catch architectural drift not yet encoded as rules.

## Skill Coordination

Use the `typescript-lsp` skill when symbol identity, references, definitions, or alias-heavy helper flow is ambiguous.

Notes:
- `scanFile` / `workspace_scan` are import/export indexing only.
- `symbols`, `references`, and `definition` are the relevant TypeScript LSP probes for call-edge confidence.
- Type-aware probes are review evidence, not a replacement for deterministic rules.
- Do not claim there is no useful LSP support.

## Required Review Commands

Run hard gate first:

```bash
bun skills/mss-module-review/scripts/check-module-patterns.ts '{"files":["<module-files>"]}'
```

Run required review evidence:

```bash
bun skills/mss-module-review/scripts/render-module-flow.ts '{"files":["<module-files>"],"format":"json"}'
bun skills/mss-module-review/scripts/render-module-flow.ts '{"files":["<module-files>"],"format":"mermaid"}'
```

When ambiguity exists, run `typescript-lsp` probes:

```bash
bun skills/typescript-lsp/scripts/run.ts '{"file":"<module-file>","operations":[{"type":"symbols"}]}'
bun skills/typescript-lsp/scripts/run.ts '{"file":"<module-file>","operations":[{"type":"references","line":<line>,"character":<character>}]}'
bun skills/typescript-lsp/scripts/run.ts '{"file":"<module-file>","operations":[{"type":"definition","line":<line>,"character":<character>}]}'
```

## Review Checklist

- flat `src/modules/*.ts` file boundary
- forbidden nested module implementation folders
- external boundary vs internal `useExtension(...)` feedback/control parsing
- no internal handler `safeParse(...)` silent drops
- no internal handler `ZodError` recovery
- actor/runtime diagnostics use `reportSnapshot(...)`
- transport diagnostics stay at external transport boundaries
- no synthetic diagnostic events unless there is a real protocol consumer
- no hidden Bun/HTTP/WebSocket/MCP/A2A servers in semantic boundary actors
- source/provenance is not rewritten to fake approval
- supervisor/projection/transport ownership is respected

## Final Handoff Format

Report:
- module files reviewed
- hard gate output
- graph JSON summary
- Mermaid snippet
- TypeScript LSP probes run, if any
- architectural findings
- known limitations

## Script Behavior Contract

- Preserve current JSON contracts and exit codes.
- Preserve `check-module-patterns.ts` as the only hard violation gate.
- Preserve `render-module-flow.ts` as review artifact output only.

## Known Limitations

The flow renderer is AST-first and local to each `useExtension(...)` callback. It handles direct local helper chains and expression-bodied helpers, but may still miss alias-heavy, destructured, reassigned, imported, or cross-file helper indirection. Use the `typescript-lsp` skill to verify symbol identity when the graph is sparse or ambiguous.
