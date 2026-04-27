---
name: plaited-runtime
description: Plaited runtime doctrine for dual-lane node boundaries, boundary contract graph semantics, local projection policy, and identity-plane/execution-plane authority split.
license: ISC
compatibility: Requires bun
---

# plaited-runtime

Use this skill as the active runtime doctrine for docs, design review, and runtime policy work.

## Active Doctrine

- dual-lane node model (`private lane`, `exchange lane`)
- boundary contract graph as interoperability doctrine
- projection policy as local rendering policy
- identity-plane trust assertions separated from execution-plane authority
- runtime-issued short-lived capability tokens for execution authority

## Before Coding Or Reviewing

Run source-grounded context assembly first:

```bash
bun skills/plaited-context/scripts/context.ts '{"task":"<task>","mode":"review","paths":["<paths>"]}'
```

For runtime boundary changes, run deterministic analysis:

```bash
bun --bun tsc --noEmit
bun test <targeted-files-or-surface>
bun skills/typescript-lsp/scripts/run.ts '{"file":"<boundary-file>","operations":[{"type":"symbols"}]}'
```

Legacy `module-patterns` / `module-flow` scripts are deprecated and are not active doctrine gates.

## Runtime Rules

1. Lane classification
- classify ingress and exposures as `private lane` or `exchange lane`

2. Boundary contracts
- exchange-lane boundaries must be contract-defined
- required contract fields must be explicit

3. Identity plane
- verifies DID/VC/VP/SSI trust assertions
- enforces revocation/status/freshness checks

4. Execution plane
- evaluates policy from verified claims
- issues grants and mints capability tokens
- enforces audience/scope/expiry/delegation at execution boundaries

5. Projection policy
- projection means local presentation/rendering policy
- shared interoperability unit is data/resources/services/provenance/contracts, not shared UI

## Required Contract Fields

- contract id / contract type
- producer / consumer identities
- audience
- resource or service being exposed
- allowed actions / scope
- entitlement requirements
- provenance requirements
- expiry / freshness rules
- delegation rules
- revocation / status checks
- diagnostics / failure modes
- projection policy
- identity-plane responsibilities
- execution-plane responsibilities

## Parsing and Diagnostics Rules

- external ingress parsing failures must be observable diagnostics
- denied execution paths must emit reasoned failure diagnostics
- do not silently drop invalid boundary/control payloads

## Implementation-Awareness Rule

Do not claim runtime handlers, token flows, auth surfaces, or boundary contracts as implemented unless they exist in current `src/` and tests. Mark non-implemented doctrine as target direction.

## Lineage vs Active Doctrine

- active doctrine: dual-lane + BCG + identity-plane/execution-plane split
- lineage references (Modnet/Structural IA/MSS terms) are non-normative context only
- legacy `scale` terminology is transitional compatibility context only

## References

- [references/behavioral-runtime.md](references/behavioral-runtime.md)
- [references/agent-runtime-notes.md](references/agent-runtime-notes.md)
- [references/module-actor-boundaries.md](references/module-actor-boundaries.md)
- [references/modnet-mss-lineage.md](references/modnet-mss-lineage.md)

## Related Skills

- `boundary-contract-review`
- `node-auth`
- `plaited-context`
- `typescript-lsp`
