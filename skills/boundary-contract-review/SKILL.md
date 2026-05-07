---
name: boundary-contract-review
description: Boundary-contract architectural review checklist for dual-lane node doctrine. Validates contract completeness, projection scope, entitlement/provenance gates, and identity-plane vs execution-plane responsibilities.
license: ISC
compatibility: Requires bun
---

# boundary-contract-review

Use this skill for doctrine-aligned review of boundary exposure and execution authority.

## Scope

Review contract-governed boundaries for:

- contract completeness
- projection scope policy
- audience/scope/expiry/delegation constraints
- entitlement checks
- provenance checks
- revocation/status checks
- malformed ingress diagnostics
- denied-execution diagnostics
- identity-plane vs execution-plane separation

## Required Contract Fields

Every reviewed boundary contract must define:

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

## Review Commands

Gather source-grounded context first:

```bash
plaited agents-md '{"mode":"relevant","rootDir":".","paths":["<paths>"]}'
plaited git '{"mode":"context","base":"origin/dev","paths":["<paths>"],"includeWorktrees":true}'
plaited wiki '{"mode":"context","rootDir":".","paths":["docs"],"task":"review boundary contract policy"}'
```

Run targeted checks on touched files when runtime code is involved:

```bash
bun --bun tsc --noEmit
bun test <targeted-files-or-surface>
plaited typescript-lsp '{"file":"<file>","operations":[{"type":"symbols"}]}'
```

## Boundary Review Checklist

1. Contract completeness
- all required fields present
- no implied/unstated authority paths

2. Projection scope checks
- projection policy is explicitly local rendering policy
- cross-node interoperability unit is data/resources/services/provenance/contracts, not shared UI

3. Audience/scope/expiry/delegation checks
- audience binding is explicit
- allowed actions/scope are narrow
- expiry/freshness rules are explicit
- delegation rules are explicit and bounded

4. Entitlement checks
- entitlement requirements map to verifiable claims
- missing or invalid entitlement paths produce explicit denial diagnostics

5. Provenance checks
- provenance requirements are explicit for exposed resources/services
- premium distribution paths include provenance/watermark requirements when applicable

6. Revocation/status checks
- revocation/status checks are required where trust assertions affect access
- stale/revoked claims cannot pass policy gates

7. External boundary ingress parsing rules
- external ingress uses strict parse + explicit malformed-ingress diagnostics
- internal handlers do not silently drop invalid control payloads

8. Diagnostics expectations
- malformed ingress is observable with stable diagnostic categories
- denied execution includes reasoned failure mode

9. Plane-separation checks
- identity plane verifies trust assertions (DID/VC/VP/SSI + status)
- execution plane evaluates policy, issues grants, mints/enforces capability tokens
- trust assertions are not treated as direct runtime authority

## Final Handoff Format

Report:

- contracts reviewed
- missing/weak fields
- ingress/denial diagnostic quality
- identity-plane vs execution-plane separation findings
- projection-policy findings
- risk-ranked remediation list

## Related Skills

- `plaited-runtime`
- `node-auth`
- `plaited-context`
- `typescript-lsp`
