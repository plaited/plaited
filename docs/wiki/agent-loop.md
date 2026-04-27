# Agent Loop

> Status
>
> - Implemented now: local loop coordination is built from shipped runtime primitives and tool surfaces in `src/`.
> - Target direction: loop decisions explicitly classify lane, evaluate boundary contracts, and separate identity-plane trust checks from execution-plane authority.

## Loop Baseline

### Implemented now

- Event-driven local runtime loop with validation and diagnostics.
- No source-backed universal exchange-lane contract gate for every loop cycle.

### Target direction

- Every non-local operation in the loop must pass through boundary contract evaluation.
- Loop state tracks identity evidence outcomes separately from execution grant outcomes.

## Contract-Aware Loop Semantics

### Implemented now

- Contract semantics are mostly doctrinal and not globally wired into runtime execution.

### Target direction

The loop handles:

- lane classification (private vs exchange)
- contract resolution
- identity-plane verification
- execution-plane grant/token issuance
- scoped execution and denial diagnostics
- local projection output

## Minimum Contract Shape For Loop Decisions

Loop-relevant contracts include:

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

## End-to-End Loop Flow

### Implemented now

1. Input enters local runtime.
2. Validation and handler execution occur.
3. Diagnostics and local projection output are produced.

### Target direction

1. Ingress is tagged private lane or exchange lane.
2. Exchange-lane requests attach identity assertions.
3. Identity plane verifies DID/VC/VP + status/freshness.
4. Execution plane evaluates contract policy.
5. Approved path mints short-lived capability token.
6. Scoped action executes; denied paths emit diagnostics.
7. Result is projected locally.

## Threat Model Notes

### Implemented now

- Loop does not yet guarantee doctrine-wide tokenized authority enforcement.

### Target direction

- Prevent trust-claim bypass of policy checks.
- Prevent scope escalation and stale-token replay.
- Guarantee explicit denial reasons for malformed ingress and denied execution.

## Loop Policy Example

```json
{
  "contractId": "bcg.creator.live-stream.v1",
  "lane": "exchange",
  "requiredEntitlement": "PremiumSubscription",
  "tokenTtl": "PT2M",
  "allowDelegation": false,
  "projectionPolicy": "local-only"
}
```

## Premium Creator Distribution Example

Loop behavior for premium text/audio/video/game delivery:

- exchange request enters with entitlement claims
- identity checks pass/fail independently of execution checks
- execution grants short-lived scoped capability token on approval
- runtime returns result with provenance/watermark obligations
- client renders local viewing/listening/play UI

## Related

- [Architecture](architecture.md)
- [Dual-Lane HyperNode Model](dual-lane-node-model.md)
- [Node-To-Node Auth](node-to-node-auth.md)
- [Plaited Runtime Skill](../../skills/plaited-runtime/SKILL.md)
- [Node Auth Skill](../../skills/node-auth/SKILL.md)
