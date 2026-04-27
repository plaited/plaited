# Runtime Boundary Review Reference

Status: active boundary review reference.

## Required Evidence Workflow

```bash
bun skills/plaited-context/scripts/context.ts '{"task":"review boundary contract policy","mode":"review","paths":["<paths>"]}'
bun --bun tsc --noEmit
bun test <targeted-files-or-surface>
bun skills/typescript-lsp/scripts/run.ts '{"file":"<boundary-file>","operations":[{"type":"symbols"}]}'
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
