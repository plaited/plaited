# Three-Axis Modules

## Goal

Research a module family that explicitly governs the three-axis risk model for
the default Plaited agent:

- capability
- autonomy
- authority

This lane should supplement the other default-module programs by covering the
cross-cutting control logic they do not fully own on their own.

## Why This Lane Exists

The current minimal core already enforces some narrow authority boundaries:

- file operations are path-scoped
- workspace execution is path-scoped
- signal boundaries are validated

But the broader three-axis model is larger than those guardrails.

The missing work is not one more isolated tool wrapper. The missing work is a
policy layer that asks:

- what capabilities are available by default
- when they may be used autonomously
- what authority envelope each capability receives
- what confirmation, verification, or routing rules should apply
- how these controls compose across memory, skills, MCP, A2A, and execution

This lane exists to prevent those concerns from being partially owned by many
modules without one program integrating them.

## Relationship To Other Lanes

This lane sits under:

- [dev-research/default-modules/program.md](../default-modules/program.md)

It should integrate with:

- [dev-research/bash-modules/program.md](../bash-modules/program.md)
- [dev-research/skill-modules/program.md](../skill-modules/program.md)
- [dev-research/mcp-modules/program.md](../mcp-modules/program.md)
- [dev-research/a2a-modules/program.md](../a2a-modules/program.md)
- [dev-research/memory-modules/program.md](../memory-modules/program.md)
- [dev-research/verification-modules/program.md](../verification-modules/program.md)

Those lanes define concrete capability surfaces.

This lane defines the cross-cutting rules that decide:

- which of those surfaces are enabled
- how risky actions are classified
- when human confirmation is required
- when verification or simulation should run
- how authority is narrowed per surface

## Dependency Order

1. [src/agent/create-agent.ts](../../src/agent/create-agent.ts) defines the minimal executable core
2. [src/agent/agent.types.ts](../../src/agent/agent.types.ts) defines the module contract
3. [docs/INFRASTRUCTURE.md](../../docs/INFRASTRUCTURE.md) defines deployment and sandbox boundaries
4. [dev-research/default-modules/program.md](../default-modules/program.md) defines the default bundle
   question
5. this lane hill-climbs the cross-cutting control slice and feeds its winning
   candidates back into the default-modules umbrella

## Core Hypothesis

The three-axis model should be implemented as a composed module layer, not
buried inside each individual capability module.

That means:

- capability modules expose possible actions
- three-axis modules decide the conditions under which those actions are
  enabled, confirmed, or blocked

This keeps the architecture clear:

- engine
- capability modules
- cross-cutting risk/control modules

## Product Target

The first shipped three-axis module bundle should support:

1. classifying built-in and module-provided capabilities by risk profile
2. expressing authority envelopes for each capability surface
3. expressing autonomy rules such as:
   - autonomous
   - confirm-first
   - owner-only
   - background-only
4. routing risky actions through verification or confirmation paths
5. exposing explicit runtime state for approvals, denials, and pending actions
6. remaining compatible with the minimal core and installed module bundle

## Axis Definitions

### 1. Capability

Capability is what the agent can do.

Examples:

- read files
- write files
- delete files
- run workspace scripts
- call MCP tools
- communicate through A2A
- update memory
- propose new symbolic rules

This lane should define how capabilities are:

- declared
- tagged
- grouped
- enabled or disabled by bundle/profile

### 2. Autonomy

Autonomy is how far the agent may proceed without human approval.

Examples:

- every action requires confirmation
- only destructive or external actions require confirmation
- background maintenance is autonomous but external communication is not
- long-running proactive loops are bounded by explicit approval rules

This lane should define autonomy policy as an explicit programmable surface, not
an implicit side effect of whichever modules happen to be installed.

### 3. Authority

Authority is what resources a capability may affect.

Examples:

- cwd-only file authority
- workspace-only execution authority
- no-network authority
- specific MCP server allowlists
- specific peer allowlists for A2A
- branch/worktree-scoped memory authority

This lane should bias toward narrow authority envelopes by default.

## Required Architectural Properties

### 1. Cross-Cutting Policy Stays Explicit

This lane should avoid a design where:

- MCP embeds its own full trust model
- A2A embeds a different approval model
- bash embeds another
- memory embeds yet another

The default agent needs one coherent control layer that coordinates these
surfaces.

### 2. Capability Registration Should Be Machine-Readable

Candidate designs should define a compact capability record that can describe:

- surface name
- action type
- authority scope
- autonomy mode
- verification requirement
- confirmation requirement

This should support both runtime routing and operator review.

### 3. Verification Should Be Pluggable

This lane should not assume a single verification mechanism.

It should be compatible with:

- symbolic predicates
- model-assisted judging
- future SMT or solver-backed verification
- hybrid verification pipelines

### 4. Human Approval Should Be First-Class

Approval is not just an afterthought for dangerous commands.

This lane should define how the default agent represents:

- pending approval
- denied approval
- approved action
- approval expiration or revocation

### 5. Deployment Profiles Should Be Supported

The same agent architecture should support multiple profiles, for example:

- local single-user coding profile
- hosted node profile
- offline private profile
- higher-autonomy research profile

The three-axis layer should provide a way to express those profiles without
changing the core engine.

## Defense Model

The three-axis lane should treat safety as a composed control stack rather than
one giant built-in subsystem.

Useful control families include:

- context shaping before risky actions are proposed
- capability tagging and classification
- confirmation routing
- symbolic or model-assisted verification
- sandbox and authority envelopes
- snapshot and git-backed audit trails

The important distinction is:

- prevention layers narrow what can happen
- recovery layers explain what happened and help repair it

Git and snapshots are valuable, but they are primarily recovery and audit
infrastructure. They do not replace capability, autonomy, or authority limits.

## Deployment-Neutral Sandbox Contract

This lane should define the control contract for execution regardless of which
sandbox backend is chosen.

At minimum, candidate bundles should be compatible with a sandbox that can
enforce:

- file authority boundaries
- network authority boundaries
- process isolation boundaries
- no privilege escalation beyond the granted capability set

The backend may vary by deployment target, but the control contract should stay
stable.

## Human Approval Model

Human approval should be represented as part of the runtime state model.

At minimum, candidate bundles should be able to represent:

- pending approval
- denied approval
- approved execution
- expired or revoked approval

This should work across:

- bash and local execution
- MCP tools
- A2A actions
- symbolic-layer changes

## Audit Versus Prevention

This lane should keep these roles separate:

- prevention: capability limits, confirmation rules, authority envelopes,
  verification
- audit: snapshots, retained artifacts, git history

The default bundle should use both, but it should not treat an audit trail as a
substitute for control policy.

## Research Questions

This lane should answer questions such as:

- what is the smallest three-axis control bundle that materially improves
  safety without making the agent unusable?
- should capability registration be centralized or emitted by each module into
  a shared control surface?
- what confirmation rules should apply by default to bash, MCP, and A2A?
- how should long-running autonomy be bounded when heartbeat-driven modules
  are installed?
- where should symbolic verification end and human approval begin?
- how should git/snapshots/memory be used for audit versus prevention?

## Candidate Module Hypotheses

### 1. Policy Registry First

A bundle where the main value is a shared registry of capability records and
approval requirements.

Hypothesis:

- explicit registry design reduces hidden risk-policy divergence between
  modules

### 2. Confirmation Router First

A bundle where the main value is routing risky actions to approval or denial
states.

Hypothesis:

- a strong approval surface is the fastest practical improvement to autonomy
  control

### 3. Verification Router First

A bundle where the main value is routing selected actions through symbolic or
model-assisted verification before execution.

Hypothesis:

- verification provides stronger scaling than confirmation alone for default
  coding tasks

### 4. Profile Pack First

A bundle where the main value is predefined deployment profiles over the same
capability surfaces.

Hypothesis:

- profile-level defaults make the architecture usable across local and hosted
  deployments

## Evaluation Questions

Candidate bundles should be judged on:

- does the design keep [src/agent](../../src/agent) minimal?
- does it materially narrow capability, autonomy, or authority in practice?
- is the operator surface reviewable and understandable?
- does it compose cleanly with bash, skills, MCP, A2A, and memory modules?
- does it avoid duplicating control logic across capability modules?
- does it preserve enough autonomy to remain useful for long-running work?

## Deliverables

This lane should produce:

- a proposed three-axis module bundle shape
- capability record schemas and state models
- approval and verification routing patterns
- profile recommendations for local-first and hosted deployments
- a recommendation on whether the three-axis bundle should ship by default
