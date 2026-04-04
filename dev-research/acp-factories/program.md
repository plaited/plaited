# ACP Factories

## Goal

Determine how Plaited should use the Agent Client Protocol (ACP) as a local
control-plane interface for a running agent.

This lane is not about broad public ACP exposure. It is about exposing a
debugging and development interface on the machine running the agent so someone
with SSH access can inspect, drive, and interrupt the agent without needing a
browser UI.

The intended shape is closer to a terminal-oriented control UI, similar in role
to an OpenClaw-style control surface, but without a web frontend.

## Why This Lane Exists

Plaited now has:

- a minimal `createAgent()` core
- factory-owned orchestration and policy
- a local-first deployment story
- bootstrap tooling for bringing an agent up on a box

What is still missing is a clean operator surface for:

- driving the agent interactively
- inspecting runtime state
- debugging streaming behavior
- canceling or resuming work
- inspecting capabilities and active factory-owned surfaces

ACP is a plausible fit for that because it already gives us:

- initialization and capability advertisement
- session-oriented interaction
- prompt-turn lifecycle
- streaming
- explicit cancellation

The lane exists to determine whether ACP should become the standard local
control interface for Plaited agents running on a box.

## Architectural Source Of Truth

The current runtime contracts still come from:

- [src/agent/create-agent.ts](../../src/agent/create-agent.ts)
- [src/agent/agent.types.ts](../../src/agent/agent.types.ts)
- [src/agent/agent.schemas.ts](../../src/agent/agent.schemas.ts)
- [src/behavioral/behavioral.ts](../../src/behavioral/behavioral.ts)

This lane should treat ACP as a factory-owned operator interface layered on top
of those files, not as a replacement orchestration core.

## Protocol Grounding

ACP surfaces that look most relevant to this control-plane role:

- initialize / capability advertisement
- session lifecycle, including load/resume
- prompt-turn lifecycle
- streaming responses
- session cancellation
- transport choices
- authentication methods

Relevant ACP documentation discovered through [skills/search-acp-docs](../../skills/search-acp-docs):

- `protocol/initialization` and `protocol/schema` for capabilities
- `protocol/prompt-turn` and `protocol/schema#session/cancel` for prompt-turn
  lifecycle and cancellation
- `rfds/session-resume` for resumed sessions
- `protocol/transports` for transport choices
- `rfds/auth-methods` for authentication framing

## Product Target

The first shipped ACP factory should support:

1. exposing a running local Plaited agent as an ACP-compatible control surface
2. letting an operator or local ACP-compatible client start prompt turns
3. streaming partial output, progress, and artifacts during development
4. canceling active work safely
5. inspecting advertised capabilities derived from the installed bundle
6. remaining suitable for SSH-first debugging and development on the host box

This factory is not primarily about multi-tenant hosting or public internet
exposure. It is about box-local operator control.

## Core Hypothesis

ACP should be treated as the local operator/control interface for a running
agent, not as a second agent core.

Instead:

- ACP terminates at a factory boundary
- the ACP factory translates ACP requests into local events and signals
- local factories still own planning, memory, skills, MCP, editing,
  verification, and other policy surfaces
- ACP projects those outcomes back as a structured operator stream

That keeps protocol adaptation separate from local symbolic composition while
still giving the deployed agent a strong debug surface.

## Required Architectural Properties

### 1. ACP Is A Local Control Boundary

This lane should assume:

- ACP is primarily a box-local operator interface
- the expected user is someone with SSH or equivalent trusted host access
- the first ACP factory should optimize for development/debugging ergonomics,
  not public internet exposure

Remote exposure can exist later, but it should not define v1.

### 2. Capability Advertisement Must Be Derived, Not Hand-Written

The ACP factory should advertise what the local bundle can actually do, for
example:

- model availability
- streaming support
- cancellation support
- memory or snapshot inspection support
- skill or MCP discovery support when installed
- any additional control-plane operations the repo truly supports

The ACP surface should not claim support for speculative workflow seams.

### 3. Prompt-Turns Must Map To Local Runtime Events

ACP should not bypass the core.

A first ACP factory should translate inbound ACP turns into local events such
as:

- task submission
- inference requests
- cancellation requests
- artifact or message projection

The exact vocabulary can be ACP-factory-owned, but execution still needs to
compose through `createAgent()` and installed factories.

### 4. Streaming Must Support Debugging

ACP streaming should be useful as a development surface, not only as a chat
surface.

That means the lane should define how to expose:

- partial model output
- tool progress
- notable snapshot transitions
- retained artifact references
- canceled or interrupted state

The main question is not “can it stream text?” but “does it help debug the
agent while it is running?”

### 5. Cancellation Must Be First-Class

ACP explicitly supports cancellation and that matters even more for a local
control surface.

The lane should define:

- how `session/cancel` maps to local abort signals
- whether cancellation is per turn, per session, or both
- how incomplete tool calls or handlers clean up state
- what the operator sees after cancellation

### 6. Session State Must Compose With Memory

ACP sessions should not become a separate long-term memory system.

The ACP factory should clarify:

- what session state is transient protocol bookkeeping
- what belongs only in local signals
- what should flow into snapshots or durable memory
- what an operator can reload or resume after reconnecting

### 7. Transport Should Match The Deployment Story

Because this lane is about SSH-first box-local operation, transport choices
should be evaluated for that environment first.

The lane should compare:

- stdio
- local HTTP
- local WebSocket or SSE only if truly useful

The simplest transport that preserves good operator ergonomics should win.

## Scope

This lane should research:

- ACP as a local control-plane interface
- initialization and capability projection
- prompt-turn submission and stream projection
- cancellation and session lifecycle
- compatibility with bootstrap and infrastructure deployment
- how ACP complements, rather than replaces, terminal and CLI operator flows

This lane should not assume:

- a resurrected `createAgentLoop()`
- a browser-based control UI
- sub-agent process orchestration as the default model
- ACP as the main public internet serving interface in v1

## Near-Term Questions

1. Should ACP be exposed over stdio first, local HTTP first, or both?
2. What is the minimum ACP capability set Plaited can honestly advertise for a
   debug/control surface?
3. Which runtime signals or snapshots are most useful to project into ACP
   streams for debugging?
4. What local event or signal shape should represent cancellation?
5. How should ACP sessions interact with bootstrap and the deployed
   infrastructure layout?

## Evaluation Criteria

Candidate ACP factories should be judged on:

- architectural clarity
- faithfulness to ACP semantics
- compatibility with the minimal `create-agent` core
- usefulness for SSH-first debugging and development
- observability of streaming and cancellation behavior
- low operator friction on a running box

## Outputs

This lane should produce:

- a recommended ACP factory shape for local operator control
- protocol-to-local event mapping notes
- capability advertisement rules
- session/cancel and streaming design notes
- transport recommendations for box-local use
- a recommendation about whether ACP belongs in the default factory bundle
