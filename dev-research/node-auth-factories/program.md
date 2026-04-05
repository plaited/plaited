# Node Auth Factories

## Goal

Research how node authentication should participate in the factory-composed
Plaited agent architecture without widening the minimal agent core.

This lane is not just about verifying a session token. It should determine how
authentication mode shapes:

- public vs trusted node exposure
- Agent Card projection
- inbound request authority
- compatibility with A2A and three-axis control
- what auth-related policy should ship in the default factory bundle

## Why This Lane Exists

The repo already has a bounded implementation seam for node authentication, and
[skills/node-auth](../../skills/node-auth) captures the current technical modes:

- WebAuthn passkeys for sovereign/local nodes
- JWT verification for hosted platform edges
- OIDC verification for enterprise SSO
- dev-mode bypass for local development

What remains open is the default-factory question:

- how should auth facts and trust state influence shipped behavior?

The missing work is policy and composition:

- how authentication affects what a node exposes publicly
- how trusted vs untrusted callers map onto capability surfaces
- how node auth composes with A2A routes and peer trust
- how approval, verification, and authority narrowing should vary by auth mode

## Dependency Order

1. [src/agent/create-agent.ts](../../src/agent/create-agent.ts) defines the minimal executable core
2. [src/agent/agent.types.ts](../../src/agent/agent.types.ts) defines the factory contract
3. [skills/node-auth/SKILL.md](../../skills/node-auth/SKILL.md) defines the current auth seam and auth modes
4. [dev-research/a2a-factories/program.md](../a2a-factories/program.md) defines A2A exposure and routing
5. [dev-research/three-axis-factories/program.md](../three-axis-factories/program.md) defines cross-cutting
   authority and autonomy control
6. This lane hill-climbs the auth slice and feeds winning candidates back into
   the default-factories umbrella

## Core Hypothesis

Authentication should not remain an isolated server implementation detail.

Instead:

- auth mode should become an explicit input to factory-owned policy
- exposure, authority, and approval behavior should depend on authenticated
  context
- the minimal core should remain generic while auth-sensitive behavior emerges
  from composed factories

## Local Inputs

Primary local inputs:

- [skills/node-auth/SKILL.md](../../skills/node-auth/SKILL.md)
- [skills/node-auth/references/webauthn-sovereign.md](../../skills/node-auth/references/webauthn-sovereign.md)
- [skills/node-auth/references/platform-jwt.md](../../skills/node-auth/references/platform-jwt.md)
- [skills/node-auth/references/oidc-enterprise.md](../../skills/node-auth/references/oidc-enterprise.md)
- [skills/node-auth/references/dev-mode.md](../../skills/node-auth/references/dev-mode.md)
- [src/factories/server-factory/server-factory.ts](../../src/factories/server-factory/server-factory.ts)
- [src/factories/server-factory/server-factory.types.ts](../../src/factories/server-factory/server-factory.types.ts)
- [src/factories/server-factory/server-factory.schemas.ts](../../src/factories/server-factory/server-factory.schemas.ts)
- [src/agent/create-agent.ts](../../src/agent/create-agent.ts)
- [src/factories/a2a-factory/](../../src/factories/a2a-factory)

Important research companions:

- [dev-research/default-factories/program.md](../default-factories/program.md)
- [dev-research/a2a-factories/program.md](../a2a-factories/program.md)
- [dev-research/three-axis-factories/program.md](../three-axis-factories/program.md)

Reference skills:

- [skills/node-auth](../../skills/node-auth)
- [skills/behavioral-core](../../skills/behavioral-core)
- [skills/typescript-lsp](../../skills/typescript-lsp)

## Product Target

The first shipped auth-aware factory bundle should support:

1. representing auth mode as explicit runtime context
2. shaping public vs trusted node exposure from that context
3. gating inbound routes and capabilities based on authenticated identity
4. narrowing authority envelopes based on trust level and deployment profile
5. composing cleanly with A2A and three-axis factories
6. preserving a clean split between:
   - auth verification seam
   - local runtime policy
   - node exposure policy

## Required Architectural Properties

### 1. Auth Verification And Policy Stay Separate

This lane should assume:

- token/passkey verification remains a bounded seam
- policy based on auth outcomes should live in factories
- the core agent runtime should not absorb deployment-specific auth doctrine

### 2. Auth Must Influence Exposure

Candidate designs should decide:

- which surfaces are public
- which require an authenticated local user
- which require a trusted platform or enterprise edge
- which A2A capabilities should be hidden, reduced, or expanded based on auth

### 3. Auth Must Influence Authority

Authentication is not just “can connect.”

Candidate bundles should express how authenticated context narrows or expands:

- file authority
- execution authority
- remote communication authority
- capability discovery
- approval/confirmation requirements

### 4. Deployment Profiles Must Stay First-Class

This lane should support at least:

- sovereign/local profile
- hosted platform profile
- enterprise profile
- dev profile

The auth bundle should vary by deployment without changing the core engine.

### 5. A2A Trust And Local Auth Must Compose Cleanly

This lane should not collapse:

- local user authentication
- peer trust
- platform control-plane identity

into one undifferentiated “authenticated” state.

## Research Questions

This lane should answer questions such as:

- what runtime auth/trust state should factories observe?
- should auth mode be represented as signals, capability tags, or both?
- how should auth affect Agent Card projection?
- when should trusted callers see expanded capability surfaces?
- how should auth compose with approvals and three-axis authority envelopes?
- what is the smallest default auth-aware factory bundle worth shipping?

## Candidate Factory Hypotheses

### 1. Exposure-Gated First

Auth primarily shapes what is visible or callable.

Hypothesis:

- the highest-value first step is separating public, trusted, and private node
  surfaces

### 2. Authority-Gated First

Auth primarily shapes what resources can be affected.

Hypothesis:

- auth becomes much more useful when it directly narrows authority envelopes

### 3. Approval-Aware First

Auth primarily shapes when confirmation is needed.

Hypothesis:

- deployment context plus auth state should alter approval defaults without
  hiding the policy layer

## Evaluation Questions

Candidate bundles should be judged on:

- does the design keep auth verification and policy clearly separated?
- does auth context shape exposure in an explicit, reviewable way?
- does the design compose with A2A and three-axis lanes cleanly?
- are trust and authority distinctions explicit rather than accidental?
- is the resulting bundle understandable enough to ship by default?
- does the design avoid widening [src/agent](../../src/agent) with deployment-specific auth
  policy?

## Deliverables

This lane should produce:

- candidate auth-aware factory bundles
- integration notes for auth state, exposure, and authority shaping
- tests or eval tasks for auth-sensitive node behavior
- a recommendation for how auth should participate in the default shipped
  factory bundle

## Negative Goal

This lane should not:

- replace [skills/node-auth](../../skills/node-auth) as the coding seam reference
- hardcode one deployment model as the only valid node shape
- collapse local auth, peer trust, and platform identity into one concept
- widen [src/agent/create-agent.ts](../../src/agent/create-agent.ts) with auth-specific policy logic
