# A2A Modules

## Goal

Research the smallest effective module architecture around the existing
[src/modules/a2a-module/](../../src/modules/a2a-module) protocol surfaces so the default Plaited agent can
participate in Agent-to-Agent exchanges without widening the core agent engine.

This lane should not treat A2A as a new runtime layer. It should determine how
top-level A2A behavior should be composed as module-owned policy on top of the
current minimal core.

## Why This Lane Exists

The repo already has substantial A2A protocol code under
[src/modules/a2a-module/](../../src/modules/a2a-module), including:

- schema definitions
- JSON-RPC request/response utilities
- HTTP handler composition
- SSE streaming support
- WebSocket client/server transport support
- peer helpers

What remains open is the default-module question:

- how should these protocol surfaces be composed into the shipped agent?

The missing work is not a larger core transport subsystem. The missing work is
policy and composition:

- how the default agent projects its Agent Card
- which capabilities should be exposed by default
- how inbound A2A requests map onto the local agent event system
- how outbound peer communication should be represented and controlled
- how auth, push, and streaming should be integrated without collapsing the
  engine-versus-policy boundary

## Dependency Order

1. [src/agent/create-agent.ts](../../src/agent/create-agent.ts) defines the minimal core boundary
2. [dev-research/default-modules/program.md](../default-modules/program.md) defines the umbrella bundle
   question
3. [skills/behavioral-core/SKILL.md](../../skills/behavioral-core/SKILL.md) defines the BP coordination substrate
4. [skills/node-auth/SKILL.md](../../skills/node-auth/SKILL.md) defines the current authentication seam
5. [skills/modnet-modules/SKILL.md](../../skills/modnet-modules/SKILL.md) defines the current modnet/MSS/A2A
   translation for module-era agents
6. This lane hill-climbs the A2A slice and feeds its winning candidates back
   into the default-modules umbrella

## Core Hypothesis

The protocol implementation under [src/modules/a2a-module/](../../src/modules/a2a-module) is already
close to the right engine surface.

The missing work is module-owned composition around that surface:

- inbound request handling policy
- Agent Card projection policy
- extension declaration and negotiation policy
- outbound peer/session policy
- push/stream lifecycle policy
- auth and trust boundaries

In other words:

- protocol mechanics should stay in [src/modules/a2a-module/](../../src/modules/a2a-module)
- shipped behavior should emerge from judged default-module composition
- [src/agent](../../src/agent) should not absorb A2A orchestration policy

## Local Inputs

Primary local inputs:

- [src/modules/a2a-module/a2a.schemas.ts](../../src/modules/a2a-module/a2a.schemas.ts)
- [src/modules/a2a-module/a2a.types.ts](../../src/modules/a2a-module/a2a.types.ts)
- [src/modules/a2a-module/a2a.constants.ts](../../src/modules/a2a-module/a2a.constants.ts)
- [src/modules/a2a-module/a2a.utils.ts](../../src/modules/a2a-module/a2a.utils.ts)
- [src/modules/a2a-module/create-a2a-handlers.ts](../../src/modules/a2a-module/create-a2a-handlers.ts)
- [src/modules/a2a-module/create-a2a-client.ts](../../src/modules/a2a-module/create-a2a-client.ts)
- [src/modules/a2a-module/create-a2a-ws-handler.ts](../../src/modules/a2a-module/create-a2a-ws-handler.ts)
- [src/modules/a2a-module/create-a2a-ws-client.ts](../../src/modules/a2a-module/create-a2a-ws-client.ts)
- [src/modules/a2a-module/peers.ts](../../src/modules/a2a-module/peers.ts)
- [src/agent/create-agent.ts](../../src/agent/create-agent.ts)

Important tests:

- [src/modules/a2a-module/tests/a2a.schemas.spec.ts](../../src/modules/a2a-module/tests/a2a.schemas.spec.ts)
- [src/modules/a2a-module/tests/a2a.utils.spec.ts](../../src/modules/a2a-module/tests/a2a.utils.spec.ts)
- [src/modules/a2a-module/tests/client-server.spec.ts](../../src/modules/a2a-module/tests/client-server.spec.ts)
- [src/modules/a2a-module/tests/ws.spec.ts](../../src/modules/a2a-module/tests/ws.spec.ts)
- [src/modules/a2a-module/tests/peers.spec.ts](../../src/modules/a2a-module/tests/peers.spec.ts)

Reference skills:

- [skills/behavioral-core](../../skills/behavioral-core)
- [skills/node-auth](../../skills/node-auth)
- [skills/modnet-modules](../../skills/modnet-modules)

Utility skills:

- [skills/typescript-lsp](../../skills/typescript-lsp)

## Product Target

The first shipped A2A module should support:

1. projecting a default Agent Card from current local capabilities
2. serving inbound A2A requests through HTTP and optionally WebSocket/SSE
3. mapping inbound work onto local module/core events rather than ad hoc
   imperative control flow
4. representing outbound peers and connections as explicit runtime state
5. handling auth and capability gating at the protocol edge
6. preserving a clean split between:
   - protocol engine
   - top-level node behavior
   - local agent execution policy

## Required Architectural Properties

### 1. A2A Is A Top-Level Boundary

This lane should assume:

- A2A is an external communication boundary
- internal modules should not use A2A as a casual intra-process message bus
- top-level exposure should stay explicit and reviewable

### 2. Protocol Engine And Agent Policy Stay Separate

`createA2AHandlers(...)` and the client/transport helpers should stay thin and
protocol-oriented.

The module layer should own:

- what card is presented
- what A2A extensions are declared
- how request-level extension negotiation is handled
- which operations are enabled
- how tasks/messages map onto local behavior
- what auth is required
- how push and streaming are surfaced

### 3. Inbound/Outbound Should Be Eventful And Observable

Candidate A2A modules should bias toward:

- explicit request/result events
- explicit stream lifecycle events
- explicit peer/session state
- signal-backed status where shared runtime context is needed

This lane should avoid burying all orchestration inside one giant handler map.

### 4. Auth Should Be Pluggable

This lane should assume the auth seam is module-owned and may integrate:

- local/node auth rules
- [skills/node-auth](../../skills/node-auth)
- future hosted/enterprise edges

The protocol layer should not hardcode one auth regime as the only valid model.

### 5. Agent Card Projection Is Policy

The Agent Card should be treated as a dynamic projection surface, not as a
static config blob.

Relevant policy questions include:

- which skills become card-declared skills
- which interfaces are exposed by default
- which A2A extensions should be declared in the Agent Card
- when an extension should be marked required versus optional
- when authenticated extended cards should be enabled
- how push notification support should be advertised

For modnet, this lane should treat MSS support as a likely A2A extension
contract. That means the research surface includes:

- how MSS support is declared in the Agent Card
- how clients negotiate MSS activation for a request
- what MSS-specific semantics belong in extension metadata rather than base A2A
- how MSS-aware and MSS-unaware peers interoperate safely

## Research Questions

This lane should answer questions such as:

- what is the smallest default A2A module bundle that yields a useful remote
  node surface?
- should card projection be its own module or bundled with inbound routing?
- should MSS support be modeled as an A2A extension in the default bundle?
- how should inbound A2A requests map onto local agent tasks and snapshots?
- what peer registry/state is sufficient for outbound coordination?
- what should be exposed by default versus only through authenticated or
  optional surfaces?
- how much streaming and push support belongs in the first default bundle?
- how should Agent Card extension declarations and `A2A-Extensions`
  negotiation be represented locally?

## Candidate Module Hypotheses

### 1. Card Projection First

A bundle where the main default value is a clean dynamic Agent Card projection,
with richer inbound/outbound behavior added later.

Hypothesis:

- getting the advertised surface right first reduces later integration errors

### 2. Inbound Gateway First

A bundle where A2A primarily acts as an inbound task/message gateway over the
local agent.

Hypothesis:

- the first practical default need is safe inbound execution rather than rich
  peer orchestration

### 3. Peer Registry First

A bundle where outbound coordination and known-peer state become the main
module-owned abstraction.

Hypothesis:

- durable peer state is the missing policy layer for useful node-to-node
  interaction

### 4. Auth-Gated Extended Card First

A bundle where the main value is exposing a narrow public card and a richer
authenticated card.

Hypothesis:

- default safety and capability discoverability improve when public and trusted
  surfaces are kept separate

## Evaluation Questions

Candidate bundles should be judged on:

- does the design keep [src/agent](../../src/agent) minimal?
- does it keep protocol code and behavior policy clearly separated?
- is the resulting remote surface understandable enough to ship by default?
- are inbound requests observable and reviewable?
- is the auth/trust model explicit rather than accidental?
- does card projection stay consistent with real capabilities?
- does extension negotiation stay explicit and interoperable?
- can the model or operator reason about peer state without hidden machinery?

## Deliverables

This lane should produce:

- candidate module bundles around [src/modules/a2a-module/](../../src/modules/a2a-module)
- integration notes for Agent Card projection, extensions, auth, streaming, and
  peer state
- tests or eval tasks for default A2A behavior
- a recommendation for whether and how A2A should be included in the default
  shipped bundle

## Negative Goal

This lane should not:

- turn A2A into a replacement for the local behavioral runtime
- widen [src/agent/create-agent.ts](../../src/agent/create-agent.ts) with transport-specific policy
- assume every agent must expose every A2A capability by default
- collapse top-level node behavior and protocol mechanics into one opaque layer
