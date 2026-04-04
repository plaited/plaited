# Payment Factories

## Goal

Research a factory family that owns agentic payment behavior for the default
Plaited agent.

This lane should determine how the agent:

- discovers paid capability boundaries
- negotiates machine-readable payment requirements
- decides when payment is allowed, denied, or requires approval
- executes payment-bearing requests through explicit policy
- retains payment evidence suitable for audit, replay, and later model
  adaptation

The target is not a built-in billing subsystem inside [src/agent](../../src/agent). The target
is a composed factory layer around paid boundaries such as x402 and MPP.

## Why This Lane Exists

The current architecture already has the right high-level split for this work:

- [src/agent/create-agent.ts](../../src/agent/create-agent.ts) stays a minimal execution core
- three-axis control owns capability/autonomy/authority policy
- auth-aware node policy owns trusted vs public exposure
- verification owns explicit checks, simulation, and repair policy
- MCP and A2A own remote capability transport and boundary projection

What is still missing is one lane that owns the economic boundary itself:

- when a remote capability is paid rather than free
- how payment challenges are represented
- how the agent proves payment and receives receipts
- how spending authority is narrowed and approved
- how paid access composes with external search, MCP, A2A, and future node
  exposure

Without this lane, payment behavior risks being partially owned by auth,
verification, MCP, A2A, and prompt conventions without one explicit policy
surface integrating them.

## Relationship To Other Lanes

This lane is a focused subprogram under:

- [dev-research/default-factories/program.md](../default-factories/program.md)

It should integrate with:

- [dev-research/three-axis-factories/program.md](../three-axis-factories/program.md)
- [dev-research/node-auth-factories/program.md](../node-auth-factories/program.md)
- [dev-research/verification-factories/program.md](../verification-factories/program.md)
- [dev-research/mcp-factories/program.md](../mcp-factories/program.md)
- [dev-research/a2a-factories/program.md](../a2a-factories/program.md)
- [dev-research/search-factories/program.md](../search-factories/program.md)
- [dev-research/observability-factories/program.md](../observability-factories/program.md)
- [dev-research/projection-factories/program.md](../projection-factories/program.md)

The intended split is:

- `payment-factories` owns payment discovery, negotiation, spend-state policy,
  and payment evidence handling
- `three-axis-factories` owns cross-cutting approval and authority shaping
- `node-auth-factories` owns authenticated identity and trust context
- `verification-factories` owns correctness checks and repair routing
- `mcp-factories` and `a2a-factories` own remote transport and capability
  projection

This lane should not treat payment as a replacement for auth, nor auth as a
replacement for payment.

## Dependency Order

1. [src/agent/create-agent.ts](../../src/agent/create-agent.ts) defines the minimal executable core
2. [src/agent/agent.types.ts](../../src/agent/agent.types.ts) defines the factory contract
3. [dev-research/three-axis-factories/program.md](../three-axis-factories/program.md) defines capability,
   autonomy, and authority control
4. [dev-research/node-auth-factories/program.md](../node-auth-factories/program.md) defines trust and exposure
   shaping
5. [dev-research/verification-factories/program.md](../verification-factories/program.md) defines reviewable
   correctness and evidence checks
6. this lane hill-climbs the payment slice and feeds winning candidates back
   into the default-factories umbrella

## External Inputs

This lane should use current machine-payment protocols as input evidence rather
than copying one implementation wholesale.

Primary reference targets:

- `https://www.x402.org/`
- `https://docs.cdp.coinbase.com/x402/welcome`
- `https://mpp.dev/overview`
- `https://developers.cloudflare.com/agents/agentic-payments/mpp/`

Current external observations that matter:

- x402 revives HTTP `402 Payment Required` for programmatic access to APIs and
  content
- MPP generalizes machine-to-machine payment negotiation around the same HTTP
  boundary
- MPP presents payment credentials and receipts as first-class protocol
  artifacts
- MPP introduces both one-shot `charge` and streaming `session` intents
- Cloudflare documents MPP as backward-compatible with existing x402
  charge-style flows

Those facts are enough to justify a dedicated factory lane even if Plaited
ultimately supports only a narrower first slice.

## Core Hypothesis

Paid access is a boundary question.

The best default design will treat payment as a factory-owned policy layer
around external boundaries rather than:

- a prompt-only instruction
- a hidden SDK call inside one capability adapter
- a generic billing account feature
- a core runtime concern in [src/agent](../../src/agent)

That means:

- capability factories may expose paid and unpaid actions
- payment factories decide how paid actions are discovered, negotiated, and
  evidenced
- three-axis and auth layers decide whether the agent is allowed to spend under
  current conditions

## Product Target

The first shipped payment factory bundle should support:

1. identifying when a remote capability is free versus paid
2. representing payment requirements as explicit runtime state
3. representing spend policy such as:
   - not allowed
   - confirm-first
   - budget-limited
   - autonomous within bounded envelope
4. handling a challenge-based payment flow for paid requests
5. recording payment evidence such as:
   - challenge
   - chosen method
   - credential or proof
   - receipt
   - settlement outcome
6. composing with verification, auth, and three-axis policy
7. keeping protocol- or provider-specific mechanics outside the minimal core

## Payment Boundary Classes

### 1. Paid Capability Discovery

Examples:

- a paid HTTP API
- a paid MCP-exposed remote capability
- a paid A2A surface
- a future paid content or crawl boundary

This class is about noticing that access is economic, not merely technical.

### 2. Payment Negotiation

Examples:

- `402 Payment Required` challenge handling
- selecting among supported payment methods
- choosing between one-shot and session-style payment intents
- deciding whether the request should proceed at all

This class is about challenge interpretation and payment-path selection.

### 3. Spend Authority And Approval

Examples:

- deny all payment by default
- allow small bounded charges without confirmation
- require confirmation for new merchants or methods
- require owner approval for streaming/session spend

This class is about whether the agent may spend, not only whether it can pay.

### 4. Payment Evidence And Recovery

Examples:

- challenge retention
- credential retention
- receipt retention
- failed payment traces
- duplicate-charge avoidance and idempotency review

This class is about making payment outcomes observable, reviewable, and
repairable.

## Required Architectural Properties

### 1. Payment Is A Factory Surface

This lane should avoid burying payment behavior separately inside:

- MCP
- A2A
- auth
- search
- prompts alone

Payment policy should remain explicit and composable.

### 2. Economic Authority Must Be Explicit

Candidate designs should define a compact spend-policy record that can express:

- capability or endpoint
- provider or merchant identity
- allowed payment methods
- maximum amount or budget envelope
- autonomy mode
- receipt requirement
- retry or replay policy

This should support both runtime routing and operator review.

### 3. Payment Evidence Must Be Reviewable

Candidate designs should make it easy to inspect:

- why a payment was required
- what challenge was received
- what method was selected
- what proof was sent
- what receipt or settlement evidence came back
- what downstream decision the payment enabled

### 4. Verification Must Stay Pluggable

This lane should compose with:

- deterministic payment artifact checks
- protocol/schema checks
- model-assisted review where needed
- future provider-specific cryptographic or settlement verification

### 5. Auth And Payment Must Stay Distinct But Composable

This lane should not collapse:

- who is calling
- what they may access
- what they may spend

into one undifferentiated trust signal.

Authentication, spend authority, and payment proof are related but different
state classes.

### 6. Protocol Neutrality Should Be Preserved

The first implementation may target one narrow family first, but the
architecture should remain compatible with:

- x402-style flows
- MPP-style charge flows
- MPP-style session flows
- future paid-boundary protocols

The stable abstraction should be the payment boundary contract, not one vendor
SDK.

## Research Questions

This lane should answer questions such as:

- what is the smallest useful payment factory bundle worth shipping?
- should payment discovery be its own factory or part of remote capability
  projection?
- what spend state should live in signals?
- how should budgets, receipts, and pending approvals be represented?
- what evidence is sufficient to treat a payment as successful?
- how should failed or uncertain payment outcomes route into repair or review?
- how should session-style payment flows differ from one-shot charge flows?
- how should payment boundaries participate in default capability selection?

## Candidate Factory Hypotheses

### 1. Charge-First

A bundle where the first useful slice is one-shot paid request handling for
HTTP-style `402` boundaries.

Hypothesis:

- a narrow charge flow captures most of the architectural value with the least
  policy complexity

### 2. Spend-Policy First

A bundle where the most important first surface is not the payment protocol
itself but explicit spend authority and approval state.

Hypothesis:

- payment becomes safe and composable only after approval and budget policy are
  explicit

### 3. Receipt-First Observability

A bundle where the main value is retaining challenge, credential, and receipt
artifacts around every paid action.

Hypothesis:

- economic boundaries become trustworthy only when every paid step is
  evidence-backed and replayable

### 4. Session-Aware Later

A bundle where session-style or streaming payment flows are deferred until
one-shot charge flows are stable.

Hypothesis:

- session payments add meaningful complexity and should not be required for the
  first default payment bundle

## Evaluation Questions

Candidate bundles should be judged on:

- does the design keep [src/agent](../../src/agent) minimal?
- does it keep payment protocol mechanics separate from spend policy?
- is spend authority explicit rather than accidental?
- are challenge, credential, and receipt artifacts reviewable?
- does the design compose cleanly with three-axis, auth, verification, MCP,
  and A2A lanes?
- can the resulting surface be understood and used reliably by the default
  model?
- does the design avoid coupling Plaited to one proprietary payment backend?

## Deliverables

This lane should produce:

- candidate payment factory bundles
- integration notes for spend policy, payment artifacts, and protocol handling
- eval tasks for paid-boundary discovery, negotiation, and receipt handling
- retained payment traces and verification reports
- a recommendation for how payment should participate in the default shipped
  factory bundle

## Negative Goal

This lane should not:

- widen [src/agent/create-agent.ts](../../src/agent/create-agent.ts) with billing or wallet doctrine
- treat payment as only a UI checkout concern
- collapse auth, trust, approval, and payment proof into one concept
- assume every remote capability should be payable by default
- assume one provider-specific SDK is the architecture
