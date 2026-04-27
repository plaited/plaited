# Plaited Experience Standard

> Status: active conceptual standard aligned to dual-lane + boundary-contract doctrine.

## Position

Plaited treats local projection as a local UX concern, not a shared interoperability contract.

## Current vs Target

### Implemented now

- Local runtime/projection surfaces exist in `src/ui/*` and related runtime code.
- End-to-end boundary-contract enforcement with capability-token authority is not fully implemented in current source.

### Target direction

- Exchange-lane interoperability is defined by boundary contracts over data/resources/services/provenance.
- Identity-plane verification informs policy.
- Execution-plane authority is capability-token based after policy approval.

## Responsibility Split

| Layer | Responsibility |
|---|---|
| Agent | Propose facts/services/projections from user input |
| Runtime policy | Evaluate contracts, grants, and enforcement decisions |
| Identity plane | Verify DID/VC/VP evidence, freshness, and revocation/status |
| Execution plane | Mint and enforce scoped short-lived capability tokens |
| Human | Approve sensitive policy transitions and destructive changes |

## Minimum Contract Requirements

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

## Premium Creator Distribution Example

Creator-owned premium text/audio/video/game assets use entitlement-aware boundary contracts:

- verified claims enter via identity plane
- execution authority is short-lived capability token issuance
- outputs include provenance/watermark requirements
- each client renders local projection UI

## Related

- [Architecture](architecture.md)
- [Dual-Lane HyperNode Model](dual-lane-node-model.md)
- [Node-To-Node Auth](node-to-node-auth.md)
