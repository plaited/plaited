# Boundary Contract Graph (BCG)

> Status
>
> - Implemented now: Plaited has schema- and snapshot-based validation patterns, but no source-backed graph runtime that enforces boundary contracts as first-class execution objects.
> - Target direction: BCG becomes the active interoperability doctrine for exchange-lane exposure, policy evaluation, grants, and capability-token issuance.

## Core Concepts

### Implemented now

- Existing code exposes validation, observability, and tooling primitives.
- Contract graph semantics are documented doctrine, not an implemented runtime subsystem.

### Target direction

- BCG is a graph of boundary contracts connecting producer/consumer identities, resources/services, and policy obligations.
- Each edge is executable policy, not prose metadata.
- Contract edges bind identity-plane evidence to execution-plane authority.

## Minimum Contract Shape

A BCG edge must define:

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

## Graph Semantics

### Implemented now

- No source-backed graph store or graph-evaluation engine is present in `src/`.

### Target direction

- **Nodes**: identities, resources, services, and policy principals.
- **Edges**: boundary contracts with executable constraints.
- **Snapshots**: graph mutations recorded with provenance for audit and replay.
- **Evaluation**: request resolution walks applicable edges and checks contract validity, claim status, and runtime context.

## End-to-End Request Flow

1. Consumer references contract edge for desired action.
2. Identity plane verifies credential set and status.
3. Execution plane evaluates edge predicates (`audience`, `scope`, `entitlement`, `delegation`, `freshness`).
4. Execution plane mints capability token scoped to approved action.
5. Runtime executes action and logs provenance + diagnostics against contract id.
6. Consumer receives data/service output and applies local projection policy.

## Threat Model Notes

### Implemented now

- Replay and denial semantics are not yet encoded as BCG-native runtime flows.

### Target direction

- Prevent stale claim use via freshness + status checks.
- Prevent cross-audience token reuse with audience binding.
- Prevent privilege creep via explicit delegation constraints.
- Detect contract drift with immutable contract ids and versioned upgrades.

## Policy and Contract Examples

### Contract edge (service)

```json
{
  "contractId": "bcg.creator.license.issue.v1",
  "contractType": "service-access",
  "producer": "did:plaited:creator-node",
  "consumer": "did:plaited:market-node",
  "audience": { "kind": "market-partner", "id": "did:plaited:partner-a" },
  "service": { "id": "svc://license/issue", "kind": "license-service" },
  "allowedActions": ["issue_license"],
  "entitlementRequirements": ["vc.type == 'DistributionPartner'"] ,
  "provenanceRequirements": ["signed_receipt.required == true"],
  "expiryFreshness": { "contractTtl": "PT12H", "claimMaxAge": "PT2M" },
  "delegation": { "allowDelegation": true, "maxDepth": 1 },
  "revocationStatus": { "required": true, "method": "status-list-2021" },
  "diagnostics": { "deniedCode": "partner_not_authorized" },
  "projectionPolicy": { "localOnly": true },
  "identityPlaneResponsibilities": ["verify_did", "verify_vc", "check_status"],
  "executionPlaneResponsibilities": ["evaluate_policy", "mint_token", "enforce_scope"]
}
```

## Premium Creator Distribution Example

A creator node uses BCG edges for:

- entitlement-gated access to premium text/audio/video/game assets
- partner licensing services for resale/distribution
- provenance and watermark obligations on every successful grant

Different consumer nodes may render entirely different storefronts or dashboards while interoperating on the same contract edges.

## Identity Plane vs Execution Plane Split

- Identity plane validates claims and revocation/status.
- Execution plane decides authority, mints capability tokens, and enforces runtime scope.
- BCG links both planes but does not collapse them.

## Related

- [Dual-Lane HyperNode Model](dual-lane-node-model.md)
- [Node-To-Node Auth](node-to-node-auth.md)
- [Infrastructure](infrastructure.md)
- [Actor Runtime](actor-runtime.md)
- [Boundary Contract Review Skill](../../skills/boundary-contract-review/SKILL.md)
- [Plaited Runtime Skill](../../skills/plaited-runtime/SKILL.md)
