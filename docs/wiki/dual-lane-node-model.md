# Dual-Lane HyperNode Model

> Status
>
> - Implemented now: Plaited ships behavioral coordination (`src/behavioral/*`), UI projection primitives (`src/ui/*`), MCP schemas/utils (`src/mcp/*`), and worker/runtime shells (`src/worker/*`). There is no source-backed dual-lane authority runtime yet.
> - Target direction: every node runs a **private lane** for local operation and an **exchange lane** for cross-node interoperability under explicit boundary contracts.

## Core Concepts

### Implemented now

- Runtime coordination is local and event-driven.
- UI rendering is local to the host application/browser runtime.
- Auth and token concepts exist as schema utilities in MCP-related code, not as a full node-to-node doctrine runtime.

### Target direction

- **Private lane**: local tools, local state, local projection policy, private execution.
- **Exchange lane**: explicit cross-node exposure of data/resources/services/provenance/contracts.
- **Projection is local**: UI interoperability is not the shared contract unit.
- **Boundary contract graph (BCG)** is the system of record for cross-lane and cross-node exposure.

## Identity Plane vs Execution Plane

### Identity plane (trust assertions)

- DID/VC/VP/SSI identity and entitlement evidence.
- Verification, issuer trust, revocation/status checks, and freshness checks.
- Produces verified claims for policy input.

### Execution plane (runtime authority)

- Policy evaluation of verified claims.
- Grant issuance and short-lived capability token minting.
- Scope/audience/delegation enforcement at runtime boundaries.
- Tool/resource/service execution and denial diagnostics.

Rule: trust assertions are not runtime authority. Verified claims only inform policy. Authority starts after policy approval and capability token minting.

## Minimum Boundary Contract Shape

Every boundary contract in this model includes:

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

## End-to-End Request Flow

1. Consumer sends exchange-lane request with identity evidence.
2. Identity plane verifies DID/VC/VP evidence and revocation/freshness.
3. Execution plane resolves boundary contract and evaluates policy.
4. If approved, runtime mints a short-lived capability token with audience/scope/expiry/delegation constraints.
5. Execution plane executes scoped action and records provenance/diagnostics.
6. Producer returns data/resource/service result; consumer renders local projection.

## Threat Model Notes

### Implemented now

- Validation and schema checks exist in shipped surfaces.
- There is no source-backed DID/VC verifier and no runtime capability-token minting path.

### Target direction

- Block identity replay with nonce + expiry + status checks.
- Block confused-deputy behavior with audience-bound tokens.
- Constrain blast radius via narrow scope + short TTL + delegation limits.
- Require provenance for premium content and entitlement-derived access.

## Policy and Contract Example

```yaml
contractId: bcg.creator.asset.stream.v1
contractType: resource-access
producer: did:plaited:creator-node
consumer: did:plaited:buyer-node
audience:
  kind: subscriber
  id: did:plaited:buyer-account
resource:
  id: asset://creator/premium/video/ep-07
  kind: premium-video
allowedActions:
  - read_stream
entitlementRequirements:
  - vc.type == "PremiumSubscription"
  - vc.subject == audience.id
provenanceRequirements:
  - watermark.required == true
  - attribution.required == true
expiryFreshness:
  contractTtl: PT24H
  claimMaxAge: PT5M
delegation:
  allowDelegation: false
revocationStatus:
  required: true
  method: status-list-2021
diagnostics:
  deniedCode: entitlement_missing
projectionPolicy:
  localOnly: true
identityPlaneResponsibilities:
  - verify_did
  - verify_vc
  - check_revocation
executionPlaneResponsibilities:
  - evaluate_policy
  - mint_capability_token
  - enforce_scope
```

## Premium Creator Distribution Example

Creator publishes text/audio/video/game assets behind entitlement gates:

- identity plane verifies subscriber claims
- execution plane mints short-lived `read_stream` capability tokens
- runtime embeds watermark/provenance metadata per contract
- clients render their own local UI (storefront, player, library) from the same contract-governed exchange exposure

## Related

- [Boundary Contract Graph](boundary-contract-graph.md)
- [Node-To-Node Auth](node-to-node-auth.md)
- [Architecture](architecture.md)
- [Dynamic Skills Agent Model](dynamic-skills-agent.md)
- [Infrastructure](infrastructure.md)
- [Plaited Runtime Skill](../../skills/plaited-runtime/SKILL.md)
