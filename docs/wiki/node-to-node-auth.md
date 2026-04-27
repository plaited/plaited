# Node-To-Node Auth

> Status
>
> - Implemented now: source includes auth-oriented schemas/utilities (for example under `src/mcp/*`) but does not yet implement full DID/VC/SSI node-to-node verification and capability-token issuance.
> - Target direction: node-to-node interoperability uses pairwise DID identity, verifiable claims, revocation checks, and runtime-minted short-lived capability tokens.

## Core Concepts

### Implemented now

- Auth is surface-specific and does not yet provide a unified node-to-node authority plane.
- Capability-token semantics are doctrinal, not a shipped cross-node runtime feature.

### Target direction

- Pairwise DID relationships per node pair.
- VC/VP claim exchange for identity and entitlement evidence.
- Identity-plane verification before execution-plane authority.
- Policy-approved short-lived capability tokens for actual execution.

## Minimum Contract Shape For Auth

Auth contracts include:

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

### Identity plane responsibilities

- resolve pairwise DID documents
- verify VC/VP signatures and issuer trust chain
- check credential status/revocation
- validate claim freshness and audience alignment

### Execution plane responsibilities

- evaluate policy using verified claims
- issue grant decisions
- mint short-lived capability tokens
- enforce scope/audience/expiry/delegation at execution boundaries
- emit denial/expiry/abuse diagnostics

## End-to-End Request Flow

1. Consumer presents DID + VC/VP evidence for requested action.
2. Producer identity plane verifies DID docs, claim signatures, freshness, and status.
3. Producer execution plane evaluates boundary contract policy.
4. On approval, execution plane mints capability token bound to audience, scope, expiry, and delegation policy.
5. Request executes only with valid capability token.
6. Runtime records provenance and diagnostics; client applies local projection policy.

## Threat Model Notes

### Implemented now

- No source-backed end-to-end DID/VC/capability-token loop currently enforces all stages.

### Target direction

- Replay defense with short token TTL + nonce/jti checks.
- Token theft mitigation with audience and scope binding.
- Delegation abuse mitigation with explicit depth and chain constraints.
- Revoked-credential rejection via status-list checks on every authorization path.

## Policy and Contract Example

```yaml
contractId: bcg.creator.download.v1
contractType: resource-access
producer: did:plaited:creator-node
consumer: did:plaited:buyer-node
audience:
  kind: purchaser
  id: did:plaited:buyer-123
resource:
  id: asset://creator/game-pack/dlc-01
  kind: premium-game-asset
allowedActions:
  - read_download
entitlementRequirements:
  - vc.type == "PurchaseReceipt"
  - vc.subject == audience.id
provenanceRequirements:
  - signature.required == true
expiryFreshness:
  claimMaxAge: PT10M
  tokenTtl: PT2M
delegation:
  allowDelegation: false
revocationStatus:
  required: true
  method: status-list-2021
diagnostics:
  deniedCode: entitlement_invalid
projectionPolicy:
  localOnly: true
identityPlaneResponsibilities:
  - verify_pairwise_did
  - verify_vc_vp
  - check_status
executionPlaneResponsibilities:
  - evaluate_policy
  - mint_capability_token
  - enforce_execution_scope
```

## Premium Creator Distribution Example

For premium text/audio/video/game distribution:

- trust plane verifies subscriber/purchase claims
- execution plane grants `read_stream` or `read_download` by minted short-lived capability token
- every access includes provenance and watermark obligations from contract policy
- receiving clients remain free to build local projection UX per audience and device

## Related

- [Dual-Lane HyperNode Model](dual-lane-node-model.md)
- [Boundary Contract Graph](boundary-contract-graph.md)
- [Infrastructure](infrastructure.md)
- [Sources](sources.md)
- [Node Auth Skill](../../skills/node-auth/SKILL.md)
- [Boundary Contract Review Skill](../../skills/boundary-contract-review/SKILL.md)
