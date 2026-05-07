# Infrastructure

> Status
>
> - Implemented now: local runtime/tooling surfaces exist in `src/`, including behavioral runtime, UI runtime, worker runtime, and MCP schema/util layers.
> - Target direction: Dual-Lane HyperNode infrastructure with BCG-governed exchange exposure, DID/VC/SSI trust handling, and runtime capability-token authority.

## Deployment Posture

### Implemented now

- Framework components run locally with pluggable deployment choices by downstream users.
- No single source-backed reference deployment enforces dual-lane policy end-to-end.

### Target direction

- Every node maintains:
  - private lane for local execution and local projection
  - exchange lane for cross-node contract-governed interoperability
- Infrastructure keeps lane boundaries explicit at ingress, policy, and execution boundaries.

## Lane Responsibilities

### Implemented now

- Lane classification is a doctrine requirement, not a global runtime invariant yet.

### Target direction

- **Private lane**: local-only tools/resources/UI composition.
- **Exchange lane**: contract-governed publication of data/resources/services/provenance.
- Cross-lane movement requires explicit boundary contracts and policy checks.

## Boundary Contract Infrastructure

### Implemented now

- No source-backed global boundary-contract graph engine is present.

### Target direction

Infrastructure services must support contract storage, retrieval, and enforcement for contracts containing:

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

## Identity Plane Infrastructure

### Implemented now

- Auth/schema utilities exist in specific surfaces.
- No source-backed unified DID/VC/SSI control plane exists in this repo snapshot.

### Target direction

- Pairwise DID identity resolution.
- VC/VP verification and issuer trust-chain checks.
- Revocation/status-list checks.
- Freshness checks for time-sensitive claims.
- Identity evidence export for execution-plane policy decisions.

## Execution Plane Infrastructure

### Implemented now

- Local execution and validation primitives exist.
- Capability-token minting and universal contract enforcement are not implemented as a shared runtime authority subsystem.

### Target direction

- Policy evaluation service for boundary contracts.
- Grant issuance records with provenance.
- Runtime minting of short-lived capability tokens.
- Enforcement at tool/resource/service boundaries.
- Standard denial diagnostics for malformed ingress, entitlement failure, and revocation failure.

## End-to-End Request Flow

### Implemented now

1. Local runtime receives and validates input.
2. Surface-specific policy/validation logic executes.
3. Outputs are projected locally through existing UI/runtime primitives.

### Target direction

1. Ingress is classified as private lane or exchange lane.
2. Exchange lane requests carry identity evidence.
3. Identity plane validates DID/VC/VP + status/freshness.
4. Execution plane resolves applicable boundary contracts.
5. Approved requests receive short-lived capability token.
6. Scoped execution runs and emits provenance + diagnostics.
7. Clients perform local projection.

## Threat Model Notes

### Implemented now

- Infrastructure does not yet provide a fully unified authority stack across all lanes.

### Target direction

- Mitigate token replay with TTL/nonces and status checks.
- Mitigate cross-audience abuse by audience-bound tokens.
- Mitigate over-broad grants through strict scope/delegation fields.
- Require provenance and watermark policy for premium media distribution.

## Policy and Contract Example

```yaml
contractId: bcg.media.stream.v1
contractType: resource-access
producer: did:plaited:creator-node
consumer: did:plaited:subscriber-node
audience:
  kind: subscriber
  id: did:plaited:user-42
resource:
  id: asset://creator/audio/season1/ep2
  kind: premium-audio
allowedActions: [read_stream]
entitlementRequirements:
  - vc.type == "PremiumSubscription"
provenanceRequirements:
  - watermark.required == true
expiryFreshness:
  tokenTtl: PT2M
  claimMaxAge: PT5M
delegation:
  allowDelegation: false
revocationStatus:
  required: true
diagnostics:
  deniedCode: entitlement_missing
projectionPolicy:
  localOnly: true
identityPlaneResponsibilities:
  - verify_did
  - verify_vc
  - check_status
executionPlaneResponsibilities:
  - evaluate_policy
  - mint_capability_token
  - enforce_scope
```

## Premium Creator Distribution Example

Creator-owned premium text/audio/video/game assets are distributed by exchange-lane contracts:

- entitlement verification in identity plane
- scoped capability-token authority in execution plane
- provenance and watermark obligations embedded in each successful delivery
- consumer apps render local projection experiences without shared UI interoperability requirements

## Related

- [Architecture](architecture.md)
- [Dual-Lane HyperNode Model](dual-lane-node-model.md)
- [Boundary Contract Graph](boundary-contract-graph.md)
- [Node-To-Node Auth](node-to-node-auth.md)
- [Plaited Runtime Skill](../../skills/plaited-runtime/SKILL.md)
