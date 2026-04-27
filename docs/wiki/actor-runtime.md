# Actor Runtime

> Status
>
> - Implemented now: this repo snapshot provides behavioral runtime primitives (`src/behavioral/*`) and associated tests. A dual-lane boundary-contract runtime authority surface is not present in current source.
> - Target direction: actor-style boundary execution remains a doctrine target under the dual-lane + BCG model.

## Runtime Baseline

### Implemented now

- `behavioral()` coordination, `bThread`, `bSync`, `useFeedback`, `useSnapshot`, frontier/replay helpers.
- Snapshot-based diagnostics and schema-backed validation patterns in shipped surfaces.

### Target direction

- Actor runtimes become execution-plane policy enforcement points for exchange-lane contracts.
- Supervisor/orchestrator logic evaluates grants, routes scoped execution, and emits contract-linked diagnostics.

## Contract Responsibilities at Runtime Boundaries

### Implemented now

- No source-backed global contract-boundary runtime exists yet.

### Target direction

Runtime boundaries enforce contracts with these minimum fields:

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

## Identity Plane vs Execution Plane

### Implemented now

- Plane split is documented doctrine, not fully implemented runtime architecture.

### Target direction

- Identity plane adapters verify DID/VC/VP and claim status.
- Execution plane handlers enforce contract scope and mint/validate capability tokens.
- Runtime authority is tokenized and policy-approved.

## End-to-End Runtime Flow

### Implemented now

1. Event enters behavioral/runtime surface.
2. Validation and selection happen in local runtime.
3. Handlers publish snapshots/diagnostics.

### Target direction

1. Ingress classified as private lane or exchange lane.
2. Identity checks run for exchange ingress.
3. Runtime resolves boundary contract.
4. Execution plane approves/denies and mints short-lived capability token on approval.
5. Scoped resource/service action executes.
6. Runtime emits diagnostics and provenance keyed by contract id.

## Threat Model Notes

### Implemented now

- Existing runtime has no universal token-based authority enforcement.

### Target direction

- Reject malformed ingress with explicit diagnostics.
- Reject denied execution with policy reason and contract id.
- Enforce expiry/delegation constraints on every execution path.
- Record provenance for all premium asset actions.

## Policy Example (Runtime View)

```json
{
  "contractId": "bcg.creator.asset.download.v1",
  "audience": { "kind": "purchaser", "id": "did:plaited:user-abc" },
  "allowedActions": ["read_download"],
  "executionPlaneResponsibilities": ["evaluate_policy", "mint_capability_token", "enforce_scope"],
  "diagnostics": { "deniedCode": "policy_denied" }
}
```

## Premium Creator Distribution Example

At runtime, premium text/audio/video/game delivery should be enforced as:

- entitlement verification input from identity plane
- capability-token-gated execution in execution plane
- provenance + watermark policy attached to delivery events
- local-only projection rendering by each client

## Related

- [Architecture](architecture.md)
- [Boundary Contract Graph](boundary-contract-graph.md)
- [Node-To-Node Auth](node-to-node-auth.md)
- [Plaited Runtime Skill](../../skills/plaited-runtime/SKILL.md)
- [Boundary Contract Review Skill](../../skills/boundary-contract-review/SKILL.md)
