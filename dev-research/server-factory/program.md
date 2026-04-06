# Server Factory

## Goal

Determine how the Plaited server surface should evolve from a standalone
transport helper into a factory-owned runtime lane without widening the minimal
agent core.

This lane covers:

- route contribution and composition
- UI transport ownership
- connection authentication seams
- server lifecycle control through behavioral policy
- bootstrap-provided transport configuration

## Why This Lane Exists

The repo now has a real server-factory lane under
[src/factories/server-factory](../../src/factories/server-factory), including a
behavioral `createServerFactory()` plus a lower-level `createServer()` helper
used as the transport materializer.

What remains open is not whether the server belongs in the factory era. It is
how far that direction should go and what composition rules should govern it.

Open questions now include:

- should server configuration be represented as signals, capabilities, or both?
- which server concerns belong to bootstrap-time factory input?
- which changes should be hot-reloadable versus restart-required?
- how should route contributions from multiple factories merge deterministically?
- how should transport auth compose with node-auth and identity-trust lanes?

## Dependency Order

1. [src/agent/create-agent.ts](../../src/agent/create-agent.ts) defines the minimal executable core
2. [src/agent/agent.types.ts](../../src/agent/agent.types.ts) defines the current factory contract
3. [src/factories/server-factory/server-factory.ts](../../src/factories/server-factory/server-factory.ts) defines the
   current server-factory lane and transport materializer
4. [dev-research/node-auth-factories/program.md](../node-auth-factories/program.md) defines auth-sensitive policy
5. [dev-research/agent-bootstrap/program.md](../agent-bootstrap/program.md) defines bootstrap-time deployment input
6. This lane hill-climbs the transport/runtime slice and feeds winners back
   into the default-factories umbrella

## Core Hypothesis

The live server should become a factory-owned behavioral subsystem rather than
remaining a separately composed runtime handle.

That means:

- bootstrap can provide initial transport config
- factories can contribute routes, auth policy, and UI exposure
- one server-owning factory can materialize and operate the live transport
- the minimal core remains unchanged

The repo is now partially in this state:

- `createServerFactory()` owns live transport state inside factory closure
- server config and status are represented through signals
- server lifecycle is controllable through behavioral events

The remaining work is about composition policy, not the existence of the lane.

## Local Inputs

Primary local inputs:

- [src/factories/server-factory/server-factory.ts](../../src/factories/server-factory/server-factory.ts)
- [src/factories/server-factory/server-factory.types.ts](../../src/factories/server-factory/server-factory.types.ts)
- [src/factories/server-factory/server-factory.schemas.ts](../../src/factories/server-factory/server-factory.schemas.ts)
- [src/factories/server-factory/server-factory.constants.ts](../../src/factories/server-factory/server-factory.constants.ts)
- [src/agent/create-agent.ts](../../src/agent/create-agent.ts)
- [src/agent/agent.types.ts](../../src/agent/agent.types.ts)
- [src/ui](../../src/ui)

Important research companions:

- [dev-research/default-factories/program.md](../default-factories/program.md)
- [dev-research/node-auth-factories/program.md](../node-auth-factories/program.md)
- [dev-research/agent-bootstrap/program.md](../agent-bootstrap/program.md)
- [dev-research/identity-trust-factories/program.md](../identity-trust-factories/program.md)

## Product Target

The first shipped server-factory direction should support:

1. bootstrap-provided baseline server configuration
2. route and UI contribution from multiple factories
3. transport authentication through a bounded seam
4. behavioral control operations such as reload and stop
5. explicit observability for server status, errors, active config, and
   snapshot-derived transport traces
6. deterministic ownership of the live server instance

The current implementation already covers a subset of this:

- `server.config` and `server.status` signals
- `server_start`, `server_stop`, `server_reload`, and `server_send`
- one factory-owned live `Bun.serve()` instance

## Evaluation Shape

This lane should be evaluated as a behavioral subsystem, not only as an
imperative helper.

The primary evaluation unit should be:

- scenario
- snapshot-derived trace
- invariant results
- transport outcome summary

That means candidate designs should be judged by running explicit scenarios
such as:

- valid client connect and disconnect
- rejected origin or missing protocol
- config change followed by reload
- send during reconnect gap followed by replay or discard
- malformed message producing error signaling

Each scenario should retain:

- the external stimuli sequence
- the `useSnapshot` trace emitted while the scenario runs
- relevant signal transitions such as `server.config` and `server.status`
- transport outcomes such as HTTP status, websocket messages, and close events
- invariant results explaining what passed or failed

This lane should prefer snapshot-derived traces over ad hoc log text because
behavioral composition is the thing under test. The important question is not
only whether a route responded or a socket connected, but how added threads,
signals, and lifecycle events interleaved to produce that outcome.

## Required Architectural Properties

### 1. The Minimal Core Stays Minimal

This lane should not widen `createAgent()` with server-specific lifecycle or
deployment concerns.

### 2. One Owner Must Materialize The Live Server

Many factories may contribute config, but one server-owning lane should be
responsible for:

- starting the server
- reloading when allowed
- stopping the server
- publishing server state

### 3. Bootstrap-Time And Runtime Changes Must Be Distinguished

Candidate designs should decide which changes are:

- startup-only
- hot-reloadable
- restart-required

### 4. Route Composition Must Be Deterministic

This lane should define how route fragments from multiple factories merge,
conflict, and report failures.

### 5. Auth Must Compose With Transport Cleanly

This lane should use the bounded auth seam, but defer auth policy doctrine to
neighboring auth and trust lanes.

### 6. Snapshot Traces Must Be First-Class Evaluation Artifacts

This lane should treat `useSnapshot` as the canonical trace substrate for
behavioral evaluation.

The goal is not to retain every low-level runtime detail forever. The goal is
to retain enough structured trace evidence to answer:

- which events were selected
- which lifecycle transitions occurred
- what signal state was visible at the important boundaries
- whether replay, auth, and error policy behaved as intended

The trace format should remain stable enough that later lanes can compare
behavioral outcomes across candidate implementations without depending on raw
stdout.

## Research Questions

This lane should answer questions such as:

- should server config be held in read-only signals, mutable signals, or event-sourced state?
- what should `server_reload` mean precisely?
- when should route or auth changes require a full restart?
- should the server-owning factory start on first complete config or on an explicit start event?
- what server state must be visible in snapshots for debugging and evaluation?
- what subset of snapshot output is stable enough to use as evaluation evidence
  across candidate implementations?
- which invariants should be checked directly against snapshot traces versus
  transport-level outcomes?

## Deliverables

This lane should produce:

- candidate server-factory designs
- recommendations for transport state representation
- integration notes for bootstrap, auth, and UI factories
- scenario-based tests or eval tasks for runtime server behavior
- snapshot-trace expectations and invariant definitions for core scenarios

## Evaluation Artifacts

The first practical evaluation bundle for this lane should retain artifacts
such as:

- `scenario.json`
- `trace.jsonl`
- `signals.json`
- `transport.json`
- `invariants.json`

This is important for later autoresearch because deterministic scenario checks
need a fast, reviewable fitness surface before any slower stochastic neural
evaluation is introduced.

## Negative Goal

This lane should not:

- collapse transport concerns back into the minimal agent core
- treat auth policy and transport wiring as the same problem
- assume raw `Bun.Server` handles should remain the long-term public operator surface
