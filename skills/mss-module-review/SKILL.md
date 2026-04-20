---
name: mss-module-review
description: MSS/module architectural review checklist delegating deterministic analysis and flow evidence to plaited-context.
---

# mss-module-review

Use this skill as an MSS/module review checklist and delegation layer.

Deterministic module diagnostics and flow evidence are owned by
`plaited-context`:
- `skills/plaited-context/scripts/context.ts`
- `skills/plaited-context/scripts/module-patterns.ts`
- `skills/plaited-context/scripts/module-flow.ts`

This skill no longer owns executable module-analysis scripts.

## Skill Coordination

Use the `typescript-lsp` skill when symbol identity, references, definitions, or alias-heavy helper flow is ambiguous.

Notes:
- `scanFile` / `workspace_scan` are import/export indexing only.
- `symbols`, `references`, and `definition` are the relevant TypeScript LSP probes for call-edge confidence.
- Type-aware probes are review evidence, not a replacement for deterministic rules.
- Do not claim there is no useful LSP support.

## Required Review Commands

Use plaited-context for context assembly:

```bash
bun skills/plaited-context/scripts/context.ts '{"task":"review module actor diagnostics","mode":"review","paths":["<module-files>"]}'
```

Run hard gate:

```bash
bun skills/plaited-context/scripts/module-patterns.ts '{"files":["<module-files>"]}'
```

Run required review evidence:

```bash
bun skills/plaited-context/scripts/module-flow.ts '{"files":["<module-files>"],"format":"json"}'
bun skills/plaited-context/scripts/module-flow.ts '{"files":["<module-files>"],"format":"mermaid"}'
```

When ambiguity exists, run `typescript-lsp` probes:

```bash
bun skills/typescript-lsp/scripts/run.ts '{"file":"<module-file>","operations":[{"type":"symbols"}]}'
bun skills/typescript-lsp/scripts/run.ts '{"file":"<module-file>","operations":[{"type":"references","line":<line>,"character":<character>}]}'
bun skills/typescript-lsp/scripts/run.ts '{"file":"<module-file>","operations":[{"type":"definition","line":<line>,"character":<character>}]}'
```

Optional: include DB recording in plaited-context commands with `"record": true`
and a configured `"dbPath"` when findings/evidence should be persisted.

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

## Known Limitations

The flow renderer is AST-first and local to each `useExtension(...)` callback. It handles direct local helper chains and expression-bodied helpers, but may still miss alias-heavy, destructured, reassigned, imported, or cross-file helper indirection. Use the `typescript-lsp` skill to verify symbol identity when the graph is sparse or ambiguous.
