---
name: node-auth
description: Node-to-node auth doctrine for pairwise DID identity, VC/VP verification, revocation checks, and capability-token execution authority.
license: ISC
compatibility: Requires bun
---

# node-auth

Use this skill for node-to-node auth design/review under dual-lane + boundary-contract doctrine.

## Purpose

Define and review trust-plane evidence handling and execution-plane authority issuance.

Key rule:

- trust assertions are not runtime authority
- verified claims inform policy
- execution authority begins only after policy approval and short-lived capability-token minting

## Identity Plane Responsibilities

- pairwise DID resolution and verification
- VC/VP signature verification
- issuer trust-chain checks
- revocation/status checks
- freshness checks for time-sensitive claims
- entitlement evidence validation

## Execution Plane Responsibilities

- policy evaluation against boundary contract constraints
- grant issuance decision
- runtime capability-token minting
- enforcement of audience/scope/expiry/delegation constraints
- denial diagnostics for malformed/unauthorized execution

## Required Mapping Checks

For each auth-enabled contract, verify mapping from trust assertions to execution constraints:

- audience mapping
- scope mapping
- expiry/freshness mapping
- delegation mapping
- revocation/status dependency mapping

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

## Flow Checklist

1. request arrives with DID + VC/VP evidence
2. identity plane verifies claims/status/freshness
3. execution plane evaluates boundary contract policy
4. execution plane approves/denies
5. on approval, runtime mints short-lived capability token
6. execution proceeds with scope enforcement
7. diagnostics + provenance are recorded

## References

- [references/oidc-enterprise.md](references/oidc-enterprise.md)
- [references/platform-jwt.md](references/platform-jwt.md)

Use these references as deployment-profile examples. Active doctrine authority remains the identity-plane/execution-plane split above.

## Related

- `boundary-contract-review`
- `plaited-runtime`
- `plaited-context`
