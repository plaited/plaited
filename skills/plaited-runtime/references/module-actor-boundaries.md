# Module Actor Boundary Reference

This reference summarizes module actor review doctrine aligned with
`plaited-context` module analysis and `mss-module-review` checklist guidance.

## Required Evidence Workflow

```bash
bun skills/plaited-context/scripts/context.ts '{"task":"review module actor diagnostics","mode":"review","paths":["<module-files>"]}'
bun skills/plaited-context/scripts/module-patterns.ts '{"files":["<module-files>"]}'
bun skills/plaited-context/scripts/module-flow.ts '{"files":["<module-files>"],"format":"json"}'
bun skills/plaited-context/scripts/module-flow.ts '{"files":["<module-files>"],"format":"mermaid"}'
```

Optional recording:
- add `"record": true` only when DB initialization or explicit `dbPath` is in
  place.

## Boundary Rules

- Keep core module actors flat in `src/modules/*.ts`.
- Do not create nested module implementation folders under `src/modules`.
- External transport ingress parses in `try/catch` and emits transport-level
  diagnostics plus snapshot observability.
- Internal `useExtension(...)` handlers parse strictly and do not locally catch
  `ZodError`.
- Actor/runtime diagnostics use `reportSnapshot(...)`.
- Avoid synthetic diagnostic events unless there is a real protocol consumer.
- Preserve source/provenance in received envelopes/messages.
