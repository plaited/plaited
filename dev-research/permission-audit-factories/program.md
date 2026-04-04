# Permission Audit Factories

## Goal

Research the default factory bundle for durable approval, denial, revocation,
and authority-transition audit in a persistent proactive Plaited agent.

This lane should define how the system:

- retains reviewable records of authority decisions over time
- ties those records to current runtime gating and policy
- represents approval and denial history as part of MSS boundary semantics
- supports operator review and revocation for a long-lived autonomous node

The target is not a chat-style permission prompt log. The target is a durable
authority ledger and audit surface for a sovereign persistent runtime.

## Why This Lane Exists

The repo already has adjacent control and trust directions:

- `dev-research/three-axis-factories/program.md` owns cross-cutting
  capability, autonomy, and authority policy
- `dev-research/node-auth-factories/program.md` owns auth and trust boundary
  shaping
- `dev-research/observability-factories/program.md` owns richer retained trace
  policy

What remains open is the durable audit layer:

- how approvals and denials are retained over time
- how revocation or expiry is represented
- how durable operator policy affects background proactive behavior
- how MSS boundary semantics shape what may cross a boundary and under what
  retained authorization history
- how audit history feeds current gating without becoming generic logging

Without this lane, long-lived authority state risks being scattered across
three-axis control, node auth, and ad hoc retained traces without one explicit
owner.

## Relationship To Other Lanes

This lane sits under:

- `dev-research/default-factories/program.md`

It should integrate with:

- `dev-research/three-axis-factories/program.md`
- `dev-research/node-auth-factories/program.md`
- `dev-research/observability-factories/program.md`
- `dev-research/notification-factories/program.md`
- `dev-research/a2a-factories/program.md`
- `dev-research/mcp-factories/program.md`

The intended split is:

- `permission-audit-factories` owns durable authority-decision retention,
  review, and revocation semantics
- `three-axis-factories` owns the cross-cutting policy rules
- `node-auth-factories` owns auth identity and trust inputs
- adjacent capability lanes own the capability surfaces being gated

## Dependency Order

1. `skills/modnet-factories/SKILL.md` defines current MSS and boundary framing
2. `dev-research/three-axis-factories/program.md` defines autonomy and
   authority policy context
3. `dev-research/node-auth-factories/program.md` defines trust and auth
   constraints
4. this lane hill-climbs the durable audit slice and feeds winners back into
   the default-factories umbrella

## Core Hypothesis

In a persistent autonomous agent, approval history is not just UI residue.

It is part of the node's ongoing authority state:

- what boundary crossings were authorized
- under what conditions
- by whom or by what standing policy
- when those authorizations expire or are revoked

MSS boundary should therefore be treated as a first-class framing input for
permission audit.

## Product Target

The first shipped permission-audit factory bundle should support:

1. durable retention of approvals, denials, and revocations
2. explicit links between retained decisions and current authority state
3. MSS-boundary-aware audit records for boundary crossings
4. reviewable standing-policy versus one-off approval distinctions
5. expiry and revocation semantics for long-lived proactive behavior
6. concise audit summaries for operator review without relying on raw logs

## Required Architectural Properties

### 1. Audit Must Be Boundary-Aware

Candidate designs should make it explicit:

- what boundary was crossed or proposed
- what content or capability class was involved
- what authority was granted, denied, or narrowed

### 2. Audit Must Be Durable

This lane should prefer retained artifacts that survive process restart and
support later review.

### 3. Audit Must Feed Current Gating

The retained authority ledger should not be passive history only.

It should support:

- current gating decisions
- standing approvals
- revocation
- expiry or re-approval requirements

### 4. Audit Must Fit Persistent Proactive Behavior

This lane should assume:

- background tasks exist
- proactive behavior may continue across long periods
- operator review may happen after the original action window

## Research Questions

This lane should answer:

- what is the minimal canonical audit record for an authority transition?
- how should MSS boundary be encoded in those records?
- how should one-off approvals differ from standing delegated policy?
- what expiry and revocation semantics are credible for proactive agents?
- how should audit summaries be projected without flooding live context?

## Deliverables

This lane should produce:

- candidate permission-audit factory bundles
- durable authority-ledger schemas
- eval tasks for approval, denial, revocation, and boundary-crossing review
- a recommendation for how permission audit should participate in the default
  bundle
