# Identity Trust Modules

## Goal

Research how stable node identity, peer trust, credential verification, and
optional SSI-backed trust services should participate in the module-composed
Plaited architecture without widening the minimal agent core.

This lane should determine how the system:

- represents stable node identity independently of the current A2A URL
- verifies peer identity and trust claims
- composes DID, VC, SSI, or simpler cryptographic identity models with A2A
- supports both local/self-hosted and provider-managed trust services
- keeps identity portability aligned with the local-first node-home direction

The target is not one mandatory standards stack. The target is a module-owned
identity and trust policy layer that can support multiple infrastructure
profiles while preserving a coherent default model.

## Why This Lane Exists

The repo already has adjacent lanes, but none cleanly own this combined
problem:

- [dev-research/node-auth-modules/program.md](../node-auth-modules/program.md) owns local user, platform, and
  enterprise auth mode as deployment auth context
- [dev-research/a2a-modules/program.md](../a2a-modules/program.md) owns A2A transport and Agent Card
  behavior
- [dev-research/permission-audit-modules/program.md](../permission-audit-modules/program.md) owns durable authority
  and approval audit
- [dev-research/node-discovery-modules/program.md](../node-discovery-modules/program.md) owns discovery identity
  publication policy

What remains open is the missing trust fabric between them:

- what stable node identity should be
- how peer trust is represented beyond URL-based TOFU
- whether DID/VC/SSI should back peer identity and claims
- when a local trust service, self-hosted trust service, or provider-managed
  trust service is acceptable
- how trust state remains portable with the node home

Without this lane, node identity and trust policy risks being fragmented across
auth, discovery, A2A, and audit without one explicit owner.

## Relationship To Other Lanes

This lane sits under:

- [dev-research/default-modules/program.md](../default-modules/program.md)

It should integrate with:

- [dev-research/a2a-modules/program.md](../a2a-modules/program.md)
- [dev-research/node-auth-modules/program.md](../node-auth-modules/program.md)
- [dev-research/node-discovery-modules/program.md](../node-discovery-modules/program.md)
- [dev-research/permission-audit-modules/program.md](../permission-audit-modules/program.md)
- [dev-research/three-axis-modules/program.md](../three-axis-modules/program.md)

The intended split is:

- `identity-trust-modules` owns stable node identity, peer trust semantics,
  and trust-service integration
- `node-auth-modules` owns local user/platform auth mode
- `a2a-modules` owns the communication protocol and Agent Card mechanics
- `node-discovery-modules` owns publication and rebinding policy
- `permission-audit-modules` owns durable authority-decision retention

## Dependency Order

1. [docs/INFRASTRUCTURE.md](../../docs/INFRASTRUCTURE.md) defines the host / box / home split
2. [src/modules/a2a-module/](../../src/modules/a2a-module) defines the current A2A and peer trust seams
3. adjacent lanes define auth, discovery, audit, and three-axis constraints
4. this lane hill-climbs the identity/trust slice and feeds winners back into
   the default-modules umbrella

## Core Hypothesis

Plaited needs a stable node identity and peer trust model that does not depend
on one mutable URL and does not require the minimal agent core to understand a
full identity stack.

The best default design will likely separate:

- node-facing communication protocol
  - A2A
- stable node identity
  - cryptographic identity, DID, or equivalent
- trust and capability claims
  - VC, signed metadata, or equivalent
- trust-service implementation
  - local, self-hosted, or provider-managed

## Product Target

The first shipped identity/trust module bundle should support:

1. stable node identity independent of the current Agent Card URL
2. explicit peer trust state and trust transitions
3. verification of peer-presented identity and trust claims
4. optional use of DID/VC/SSI-style trust services without making them
   mandatory for every deployment
5. provider-managed trust services as an optional infrastructure profile
6. node-home-portable trust metadata and migration semantics

## Required Architectural Properties

### 1. Identity Must Be Separate From Locator

This lane should preserve a distinction between:

- stable node identity
- current reachable A2A endpoint or well-known URL

### 2. Trust Service Must Be Optional

Candidate designs may support:

- embedded or local trust tooling
- self-hosted trust services
- provider-managed trust services

But the architecture should not require one provider as a permanent root of
identity.

### 3. Portability Must Stay First-Class

If a provider-managed trust service exists, the resulting identity and trust
state should remain portable enough that the node can migrate without losing
its conceptual identity.

### 4. A2A Must Stay The Communication Layer

This lane should not replace A2A as the node interaction protocol.

It should instead determine how identity and trust are attached to A2A
surfaces such as:

- Agent Card signatures
- peer verification
- extension negotiation
- authenticated extended cards

## Research Questions

This lane should answer:

- what is the best default stable node identity model?
- should DID/VC/SSI be first-class, optional, or deferred?
- what trust claims belong in Agent Card metadata versus external credentials?
- how should peer trust transition beyond URL-keyed TOFU?
- what trust-service profiles should ship by default?
- how should identity and trust metadata persist in the node home?

## Candidate Module Hypotheses

### 1. Signed Card Plus Local Trust Store First

Hypothesis:

- the best first bundle extends the current signed Agent Card and peer trust
  store with better stable identifiers and rebinding semantics

### 2. DID-Backed Identity First

Hypothesis:

- DID gives the cleanest stable node identity layer while A2A remains the
  communication and discovery surface

### 3. SSI Service Optionality First

Hypothesis:

- the most practical architecture allows a local/self-hosted/provider-managed
  SSI service but does not require it for every deployment profile

## Deliverables

This lane should produce:

- candidate identity/trust module bundles
- integration notes for A2A, DID/VC/SSI, and peer trust policy
- eval tasks for rebinding, peer verification, and provider migration
- a recommendation for how identity and trust should participate in the
  default shipped bundle
