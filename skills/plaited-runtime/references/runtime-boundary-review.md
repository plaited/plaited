# Runtime Boundary Review Reference

Status: active boundary review reference.

## Required Evidence Workflow

```bash
bun ./bin/plaited.ts agents '{"mode":"relevant","rootDir":".","paths":["<paths>"]}'
bun ./bin/plaited.ts git '{"mode":"context","base":"origin/dev","paths":["<paths>"],"includeWorktrees":true}'
bun ./bin/plaited.ts wiki '{"mode":"context","rootDir":".","paths":["docs"],"task":"review boundary contract policy"}'
bun --bun tsc --noEmit
bun test <targeted-files-or-surface>
bun ./bin/plaited.ts typescript-lsp '{"file":"<boundary-file>","operations":[{"type":"symbols"}]}'
```

## Boundary Rules

- classify boundaries as private lane or exchange lane
- define boundary contract before exchange-lane exposure
- separate identity-plane checks from execution-plane enforcement
- enforce explicit audience/scope/expiry/delegation constraints
- require observable malformed-ingress and denied-execution diagnostics
- treat projection policy as local rendering behavior

## Related

- `skills/boundary-contract-review/SKILL.md`
- `skills/node-auth/SKILL.md`
