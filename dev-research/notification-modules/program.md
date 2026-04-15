# Notification Modules

## Goal

Research the default notification-oriented module bundle for the Plaited
agent.

This lane should define how the agent:

- decides when a runtime event deserves attention
- converts internal state changes into concise notifications
- distinguishes local operator prompts from passive status updates
- avoids turning every runtime event into noisy output

The target is a module family for meaningful attention routing, not a generic
stream of chatter.

## Why This Lane Exists

The minimal core already produces events, snapshots, and results, but it does
not decide:

- which moments are important
- who should be notified
- when interruption is warranted
- how notifications should vary by task state or deployment mode

Those are policy questions. Without this lane, notification behavior will
either remain underspecified or leak into unrelated modules.

## Relationship To Other Lanes

This lane sits under:

- [dev-research/default-modules/program.md](../default-modules/program.md)

It should integrate with:

- [dev-research/observability-modules/program.md](../observability-modules/program.md)
- [dev-research/projection-modules/program.md](../projection-modules/program.md)
- [dev-research/three-axis-modules/program.md](../three-axis-modules/program.md)
- [dev-research/node-auth-modules/program.md](../node-auth-modules/program.md)
- [dev-research/plan-modules/program.md](../plan-modules/program.md)

The intended split is:

- `notification-modules` owns attention policy and notification shaping
- `projection-modules` owns context-facing summaries
- `observability-modules` owns richer retained traces and artifacts

## Dependency Order

1. [src/agent/create-agent.ts](../../src/agent/create-agent.ts) defines the minimal eventful core
2. [skills/behavioral-core/SKILL.md](../../skills/behavioral-core/SKILL.md) defines the BP substrate for event
   routing and additive policy
3. [dev-research/default-modules/program.md](../default-modules/program.md) defines the bundle question
4. this lane hill-climbs the notification slice and feeds winners back into
   the default-modules umbrella

## Core Hypothesis

Useful default notifications should be driven by explicit event classes and
attention policy rather than by ad hoc string emission from every module.

That means:

- only a subset of state changes should notify
- notification severity should be explicit
- the same runtime event may be silent, logged, surfaced, or interruptive
  depending on context

## Product Target

The first shipped notification module bundle should support:

1. classifying events by attention level
2. distinguishing:
   - silent trace
   - passive status
   - actionable warning
   - approval-needed interruption
   - completion or handoff notice
3. suppressing redundant or low-signal updates
4. varying notification policy by deployment profile or auth/trust context
5. retaining a concise notification history for later review

## Required Architectural Properties

### 1. Notifications Must Be Intentional

Candidate designs should make it explicit:

- what event triggered the notification
- why it was surfaced
- what action, if any, is expected

### 2. Attention Routing Must Compose With Risk Policy

Notification behavior should work with:

- approval flows
- auth-aware trust differences
- blocked or failed execution
- background tasks versus foreground tasks

### 3. Notifications Must Avoid Prompt Noise

The default bundle should not project every notification into the active model
context. It should retain what matters and suppress the rest.

## Research Questions

This lane should answer:

- which runtime moments deserve immediate notification?
- what severity model is sufficient for the default bundle?
- how should notification deduplication work?
- when should a notification become an interrupt versus a retained trace only?
- how should notification policy vary for local, hosted, or trusted callers?

## Candidate Module Hypotheses

### 1. Severity-Class First

Hypothesis:

- a small severity taxonomy yields most of the practical value for the default
  bundle

### 2. Approval-Interrupt First

Hypothesis:

- the first high-value notification behavior is making approval-needed states
  explicit and hard to miss

### 3. Completion-and-Blockage First

Hypothesis:

- users benefit most when the agent cleanly notifies on completed work,
  blocked work, and requests for missing input

## Deliverables

This lane should produce:

- candidate notification module bundles
- eval tasks for noise control, approval prompts, and blocked-state surfacing
- retained notification traces
- a recommendation for how notifications should participate in the default
  bundle
