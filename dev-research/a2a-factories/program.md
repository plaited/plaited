# A2A Factories

## Goal

Research the smallest effective factory architecture around the existing
`src/factories/a2a-factory/` protocol surfaces so the default Plaited agent can
participate in Agent-to-Agent exchanges without widening the core agent engine.

This lane should not treat A2A as a new runtime layer. It should determine how
top-level A2A behavior should be composed as factory-owned policy on top of the
current minimal core.

## Why This Lane Exists

The repo already has substantial A2A protocol code under
`src/factories/a2a-factory/`, including:

- schema definitions
- JSON-RPC request/response utilities
- HTTP handler composition
- SSE streaming support
- WebSocket client/server transport support
- peer helpers

What remains open is the default-factory question:

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

1. `src/agent/create-agent.ts` defines the minimal core boundary
2. `dev-research/default-factories/program.md` defines the umbrella bundle
   question
3. `skills/behavioral-core/SKILL.md` defines the BP coordination substrate
4. `skills/node-auth/SKILL.md` defines the current authentication seam
5. `skills/modnet-node/SKILL.md` defines node-level topology and A2A framing
6. This lane hill-climbs the A2A slice and feeds its winning candidates back
   into the default-factories umbrella

## Core Hypothesis

The protocol implementation under `src/factories/a2a-factory/` is already
close to the right engine surface.

The missing work is factory-owned composition around that surface:

- inbound request handling policy
- Agent Card projection policy
- outbound peer/session policy
- push/stream lifecycle policy
- auth and trust boundaries

In other words:

- protocol mechanics should stay in `src/factories/a2a-factory/`
- shipped behavior should emerge from judged default-factory composition
- `src/agent` should not absorb A2A orchestration policy

## Local Inputs

Primary local inputs:

- `src/factories/a2a-factory/a2a.schemas.ts`
- `src/factories/a2a-factory/a2a.types.ts`
- `src/factories/a2a-factory/a2a.constants.ts`
- `src/factories/a2a-factory/a2a.utils.ts`
- `src/factories/a2a-factory/create-a2a-handlers.ts`
- `src/factories/a2a-factory/create-a2a-client.ts`
- `src/factories/a2a-factory/create-a2a-ws-handler.ts`
- `src/factories/a2a-factory/create-a2a-ws-client.ts`
- `src/factories/a2a-factory/peers.ts`
- `src/agent/create-agent.ts`

Important tests:

- `src/factories/a2a-factory/tests/a2a.schemas.spec.ts`
- `src/factories/a2a-factory/tests/a2a.utils.spec.ts`
- `src/factories/a2a-factory/tests/client-server.spec.ts`
- `src/factories/a2a-factory/tests/ws.spec.ts`
- `src/factories/a2a-factory/tests/peers.spec.ts`

Reference skills:

- `skills/behavioral-core`
- `skills/node-auth`
- `skills/modnet-node`
- `skills/constitution`

Utility skills:

- `skills/typescript-lsp`

## Product Target

The first shipped A2A factory should support:

1. projecting a default Agent Card from current local capabilities
2. serving inbound A2A requests through HTTP and optionally WebSocket/SSE
3. mapping inbound work onto local factory/core events rather than ad hoc
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
- internal factories should not use A2A as a casual intra-process message bus
- top-level exposure should stay explicit and reviewable

### 2. Protocol Engine And Agent Policy Stay Separate

`createA2AHandlers(...)` and the client/transport helpers should stay thin and
protocol-oriented.

The factory layer should own:

- what card is presented
- which operations are enabled
- how tasks/messages map onto local behavior
- what auth is required
- how push and streaming are surfaced

### 3. Inbound/Outbound Should Be Eventful And Observable

Candidate A2A factories should bias toward:

- explicit request/result events
- explicit stream lifecycle events
- explicit peer/session state
- signal-backed status where shared runtime context is needed

This lane should avoid burying all orchestration inside one giant handler map.

### 4. Auth Should Be Pluggable

This lane should assume the auth seam is factory-owned and may integrate:

- local/node auth rules
- `skills/node-auth`
- future hosted/enterprise edges

The protocol layer should not hardcode one auth regime as the only valid model.

### 5. Agent Card Projection Is Policy

The Agent Card should be treated as a dynamic projection surface, not as a
static config blob.

Relevant policy questions include:

- which skills become card-declared skills
- which interfaces are exposed by default
- when authenticated extended cards should be enabled
- how push notification support should be advertised

## Research Questions

This lane should answer questions such as:

- what is the smallest default A2A factory bundle that yields a useful remote
  node surface?
- should card projection be its own factory or bundled with inbound routing?
- how should inbound A2A requests map onto local agent tasks and snapshots?
- what peer registry/state is sufficient for outbound coordination?
- what should be exposed by default versus only through authenticated or
  optional surfaces?
- how much streaming and push support belongs in the first default bundle?

## Candidate Factory Hypotheses

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
factory-owned abstraction.

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

- does the design keep `src/agent` minimal?
- does it keep protocol code and behavior policy clearly separated?
- is the resulting remote surface understandable enough to ship by default?
- are inbound requests observable and reviewable?
- is the auth/trust model explicit rather than accidental?
- does card projection stay consistent with real capabilities?
- can the model or operator reason about peer state without hidden machinery?

## Deliverables

This lane should produce:

- candidate factory bundles around `src/factories/a2a-factory/`
- integration notes for Agent Card projection, auth, streaming, and peer state
- tests or eval tasks for default A2A behavior
- a recommendation for whether and how A2A should be included in the default
  shipped bundle

## Negative Goal

This lane should not:

- turn A2A into a replacement for the local behavioral runtime
- widen `src/agent/create-agent.ts` with transport-specific policy
- assume every agent must expose every A2A capability by default
- collapse top-level node behavior and protocol mechanics into one opaque layer
