# Architecture

> Status
>
> - Implemented now: shipped framework surfaces are behavioral runtime, UI projection/runtime primitives, MCP schemas/utilities, worker runtime, and CLI/eval tooling under `src/`.
> - Target direction: Dual-Lane HyperNode doctrine with Boundary Contract Graph (BCG), DID/VC/SSI trust assertions, and runtime capability-token authority.

## Scope

### Implemented now

- Plaited is a framework library with local runtime primitives and tooling.
- Current code does not include a source-backed cross-node contract-graph authority runtime.

### Target direction

- Architecture is organized around private lane execution and exchange lane interoperability.
- Cross-node authority is governed by boundary contracts, not shared UI components.

## Active Doctrine Anchors

### Implemented now

- Local coordination and projection are available.
- Interoperability doctrine is mostly documentation-level and not fully encoded in runtime execution flows.

### Target direction

- [Dual-Lane HyperNode Model](dual-lane-node-model.md)
- [Boundary Contract Graph](boundary-contract-graph.md)
- [Node-To-Node Auth](node-to-node-auth.md)

These pages are normative doctrine for future architecture decisions.

## Interoperability Unit

### Implemented now

- UI APIs exist as local runtime/browser surfaces.
- There is no source-backed shared-UI interoperability contract.

### Target direction

- Shared interoperability unit is data/resources/services/provenance/contracts.
- Projection is local rendering policy only.
- Different nodes may render different UI from the same exchange-lane contract.

## Boundary Contract Baseline

### Implemented now

- Contract completeness checks are not yet a required global runtime gate.

### Target direction

Every active boundary contract defines at minimum:

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

## Identity Plane and Execution Plane

### Implemented now

- `src/` contains auth-related schema/util layers in specific surfaces.
- Full node-to-node DID/VC/SSI verification and capability-token grant flow is not source-backed end-to-end.

### Target direction

- Identity plane verifies trust assertions (DID/VC/VP/SSI, revocation, freshness).
- Execution plane performs policy evaluation, grant issuance, capability-token minting, scope enforcement, and execution.
- Verified claims inform policy; they do not grant authority by themselves.

## End-to-End Architecture Flow

### Implemented now

1. Local runtime receives input/events.
2. Runtime coordination and validation occur in shipped modules/schemas.
3. Local UI projection/runtime APIs present outputs.

### Target direction

1. Request arrives on private or exchange lane.
2. Identity plane validates claims and status.
3. Execution plane evaluates applicable boundary contracts.
4. Approved requests receive short-lived capability tokens.
5. Scoped execution returns data/resources/services plus provenance.
6. Client performs local projection.

## Threat Model Notes

### Implemented now

- Baseline schema validation and diagnostics are available in shipped surfaces.
- Global contract-graph enforcement is not yet implemented.

### Target direction

- Enforce audience-bound, scope-bound, short-lived authority.
- Require revocation/status checks for trust-derived decisions.
- Preserve provenance obligations for premium creator distribution.
- Prevent delegated authority creep with explicit delegation constraints.

## Premium Creator Distribution Scenario

### Implemented now

- Premium entitlement and watermark enforcement are doctrinal targets.

### Target direction

- Creator-owned premium text/audio/video/game assets are exposed through exchange-lane boundary contracts.
- Subscribers present verifiable entitlement claims.
- Execution authority is capability-token based, short-lived, and contract-scoped.
- Outputs include provenance and policy-required watermark metadata.

## Related

- [Infrastructure](infrastructure.md)
- [Actor Runtime](actor-runtime.md)
- [Agent Loop](agent-loop.md)
- [Training And Improvement](training-and-improvement.md)
- [Plaited Runtime Skill](../../skills/plaited-runtime/SKILL.md)
- [Boundary Contract Review Skill](../../skills/boundary-contract-review/SKILL.md)
- [Node Auth Skill](../../skills/node-auth/SKILL.md)
