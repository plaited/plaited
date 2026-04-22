# Local Inference Bridge

> Status: architecture decision. Current implementation still includes
> `src/modules/inference-websocket-runtime-actor.ts`; this page documents the
> target local bridge.

## Problem

Plaited needs a same-machine bridge between the framework runtime and a neural
runtime without turning model execution into a network-exposed authority
surface. The bridge must support long-running turns, streaming output, tool
intent handoff, cancellation, diagnostics, and provenance while preserving
Plaited's actor and policy boundaries.

## Decision

Use a private Unix domain socket for same-machine Plaited runtime to neural
runtime communication.

The protocol over that socket is a framed `ActorEnvelope` stream, not plain
unary request/response RPC. The stream is bidirectional and long lived.

WebSocket-over-TCP is not the default inference bridge because the bridge is
framework-owned local IPC. Bun server binding can expose a TCP listener when
not constrained, and model execution should not implicitly become a LAN
surface.

WebSocket remains appropriate for browser, UI, client, remote compatibility,
and debug adapter surfaces. If a TCP fallback exists for inference, it must
bind to loopback only, for example `127.0.0.1`, and should be treated as
compatibility mode.

## Protocol Requirements

The socket stream must support:

- long-lived sessions
- bidirectional `ActorEnvelope` frames
- correlation IDs for request, result, tool-call, and side-effect matching
- session IDs and turn IDs
- streaming deltas for model output and context assembly
- cancellation
- backpressure or a documented flow-control strategy
- replayable diagnostics
- explicit provenance on every envelope
- tool calls as intents sent back to Plaited actors
- side-effect intents as proposals gated by Plaited policy

The neural runtime does not execute tools directly. It emits tool and
side-effect intents as envelopes. Plaited actors decide whether those intents
are authorized, routed, executed, denied, or revised.

## Runtime Boundaries

Plaited owns:

- policy
- tools
- permissions
- sandboxing
- actor routing
- side-effect authority
- promotion gates

The neural runtime owns:

- model execution
- model A to model B coordination
- model-internal prefix, KV, and cache optimizations
- decoding, batching, prefill, and scheduler details

Shared KV cache or prefix reuse is an internal neural-runtime optimization, not
part of the public Plaited transport contract. If model A and model B have
incompatible architectures or tokenizers, true KV sharing should not be claimed.
The conservative baseline is structured context handoff plus prefill.

## Alternatives Considered

### Same-Process Function Calls

Lowest overhead, but it collapses the framework runtime and neural runtime into
one failure and authority domain. It also makes language/runtime boundaries and
model server replacement harder.

### `Bun.spawn()` Stdio IPC

Good for simple child-process control, but awkward for bidirectional,
long-lived, multiplexed sessions with backpressure, replayable diagnostics, and
typed envelope routing.

### Unix Domain Socket Framed Stream

Best default for local framework-owned IPC. It is private to the machine,
works across processes, supports long-lived bidirectional streams, and keeps
transport separate from Plaited's actor semantics.

### Loopback TCP / WebSocket

Useful as a compatibility or debugging mode when constrained to loopback. It is
not the default because accidental non-loopback binding changes the exposure
boundary.

### Remote TCP / WebSocket With mTLS, VPN, Or VPC

Useful for remote inference deployments, but this is a separate deployment
profile from same-machine local IPC. It needs explicit network trust, identity,
and policy assumptions.

## Consequences

- The local inference bridge is an actor-envelope transport, not a model tool
  API.
- Browser and UI WebSockets remain valid without making inference WebSocket the
  framework default.
- Neural runtime cache optimizations can evolve without changing Plaited's
  public bridge contract.
- Policy and side effects remain in Plaited even when model execution is
  attached as a stronger local or server lane.

## Current Implementation Gap

Current source includes `src/modules/inference-websocket-runtime-actor.ts`,
which is WebSocket-based and validates `ActorEnvelope` messages at the
`/ws/inference` path.

Future local inference bridge work should move same-machine inference toward a
Unix socket framed-envelope stream. If the WebSocket actor remains, it should
default to loopback when used for inference and be described as a compatibility
or client/debug adapter rather than the default framework-owned IPC path.
