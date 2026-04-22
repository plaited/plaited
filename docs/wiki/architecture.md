# Architecture

> Status: canonical wiki overview. Domain-specific details live in adjacent
> wiki pages. Source code and tests remain higher authority than this page.

## First Principles

Three axioms drive every decision:

1. **Decouple reasoning from action.** When an inference adapter exposes
   separate reasoning, response, tool-call, or diagnostic channels, Plaited
   should preserve those channels as structured events. Runtime policy should
   not depend on scraping raw text to infer authority boundaries.

2. **Symbolic persists, neural evolves.** Behavioral programs (bThreads) encode safety constraints and domain knowledge as deterministic code. They survive model upgrades, hardware changes, and architecture pivots. The neural layer — whichever model fills the Model role — is replaceable.

3. **Architecture outlives models.** Model families, serving backends, and
   hardware lanes can change. The stable pieces are the actor contracts,
   behavioral runtime, provenance, policy boundaries, and context handoff
   shapes.

## Overview

Plaited's agent layer is a **framework** — composable primitives shipped as a subpath export (`plaited/agent`) alongside the existing UI, testing, and workshop modules. It is not a platform. Platforms are what consumers build with it.

The framework provides:

- **Interfaces** for the primary reasoning model plus optional adjunct model
  roles
- **A minimal behavioral core** plus module-composed orchestration
- **Memory via snapshots, git, and retained artifacts** — observable BP execution plus git-backed files and commit history
- **Governance and verification as module-level directions** rather than a
  shipped dedicated constitution runtime

The framework is **not prescriptive** about inference backend. Consumers choose
how to serve models, such as local runtimes, OpenAI-compatible servers, cloud
APIs, or future neural runtimes. Code ships as framework code; model packaging
is a deployment and release decision outside the core runtime contract.

### Pluggable Models

The primary model and any adjunct model roles are interfaces, not
implementations:

```typescript
type ModelDelta =
  | { type: 'thinking_delta'; content: string }
  | { type: 'text_delta'; content: string }
  | { type: 'toolcall_delta'; toolCall: Partial<ToolCall> }
  | { type: 'done'; usage: { inputTokens: number; outputTokens: number } }
  | { type: 'error'; error: Error }

type Model = {
  reason(context: ModelContext, signal?: AbortSignal): AsyncIterable<ModelDelta>
}

type Voice = {
  speak(text: string, options?: { voice?: string }): Promise<Uint8Array>
}
```

An `AsyncIterable<ModelDelta>`-style adapter can work across local runtimes,
OpenAI-compatible servers, or API endpoints. Deltas can stream through
behavioral events for progressive UI rendering and diagnostics.

The model interfaces are backend-agnostic. Implementations can target local
Apple Silicon runtimes, CUDA/cloud servers, or API endpoints. Swap the server,
not the actor/runtime contract.

Multimodal input does not need a dedicated core vision event. When the primary
model is natively multimodal, image and video handling can ride through the
primary inference lane or through module-owned extensions rather than a fixed
built-in vision primitive.

### Model Roles

The table below is a role model, not an implementation claim.

| Role | Interface | Function |
|---|---|---|
| **Primary reasoning + tool use** | `Model` | Function calling, structured output, long-context reasoning, and local-first or server-hosted deployment depending on hardware. |
| **Speech output** | `Voice` *(deferred)* | Text to speech when a client or module needs a voice surface. |

**Speech input (STT) is a client-side concern.** Browsers provide the Web Speech API, iOS has `SFSpeechRecognizer`, Android has `SpeechRecognizer` — all on-device, free, multilingual. The client transcribes speech to text and sends it to the node as a normal `task` event. The node never processes raw audio input.

The reference point should not be a fixed small starter model. Model strength
should scale with the deployment lane:

- local-by-default quantized variants for privacy, offline work, and tighter
  hardware footprints
- larger variants when attached workstation or server-class hardware makes a
  stronger lane practical

The design goal is consistency across tiers, not different agent behavior per
host class. Local and server lanes should stay within the same model family,
tool-calling contract, and response shape. The server lane is the stronger
variant of the same cognitive surface, not a separate product.

### Reference Deployment Direction

The stable boundary is the actor-envelope and model-adapter contract, not a
specific local runtime.

A plausible deployment lane is:

- Bun process as the local orchestrator/runtime
- a local/server split where the node home and control plane stay local while
  larger model serving can sit on attached workstation or server-class hardware
- optional local or remote providers for adjunct roles such as speech

Under that split:

- the local lane should prefer a quantized variant when the goal is privacy,
  portability, or offline operation
- the server lane can step up to a larger variant for harder reasoning,
  longer-context work, or heavier multimodal workloads
- escalation between lanes should preserve prompt format, tool semantics, and
  output structure

That preserves the ability to swap serving backends without changing the agent
engine, actor runtime, or module contracts.

## Core Shape

`src/agent/create-agent.ts` defines a minimal execution substrate, not a full
top-level loop policy.

The core owns:

- `behavioral()` engine setup
- host `trigger` ingress surface
- module `emit` ingress surface (provided via module params)
- event-derived context memory policy (`eventType` -> last selected `detail`, queried via `last(listener)`)
- module-scoped dynamic thread installation via `addThreads(...)` (declared name scope, fallback `moduleId`)
- heartbeat ingress from the host `trigger`
- host/runtime snapshot diagnostics via `reportSnapshot`
- guarded process execution through `tool_bash_request` / approval / result events
- actor directory scanning through `actors_scan` and supervisor onboarding of `defineActor(...)` defaults

Behavioral provenance is explicit and source-aware across runtime and replay:
`trigger | request | emit`.

Scheduler pumping remains narrow:

- host `trigger` pumps
- module `emit` pumps
- `bThreads.set` and `bThreads.spawn` are non-pumping registration APIs

Host/runtime diagnostics now flow through the same snapshot stream consumed by
agent observability. The first diagnostic kind is `module_warning`
(`{ kind, moduleId, lane?, warning, code? }`), emitted through
`behavioral().reportSnapshot(...)`.

Planning, context assembly, skill selection, MCP capability projection, A2A
routing, verification, and higher-level editing behavior should be composed
through modules.

## Experience Standard

Plaited treats UI as a local projection, not the shared interoperability unit.
Each user and agent may see a different generated interface over the same
approved actor exposure.

The cross-node substrate is:

- actor-owned facts and resources
- actor-owned services and actions
- runtime policy and grants
- provenance
- approved projections

The local substrate is generated UI, device adaptation, accessibility,
workflow memory, and task-specific layout. Agents may propose facts, services,
policies, and projections, but actors own state and handlers, and runtime
policy decides what crosses node boundaries.

The target descriptive MSS vocabulary is four tags: `content`, `structure`,
`mechanics`, and `boundary`. Historical `scale` is treated as transitional
compatibility, not target ontology. See `docs/wiki/` for the longer lineage and
translation notes.

## Key Design Principles

- **Framework, Not Platform:** Composable primitives. Platforms are built with
  Plaited, not by Plaited.
- **Single Tenancy:** 1 User : 1 Agent instance. User data lives on their agent — nowhere else.
- **Pluggable Models:** The primary model and optional adjunct roles are
  interfaces. Implementations swap across local runtimes, server runtimes, and
  cloud APIs.
- **Minimal Core, Rich Modules:** `createAgent()` stays narrow; planning,
  memory, MCP, A2A, verification, and editing policy belong in modules.
- **Plan-Driven Context:** Plan state should shape context assembly through
  module-owned policy rather than a fixed built-in loop stage.
- **Defense in Depth:** Capability, autonomy, and authority should be narrowed
  through composed module policy plus deployment/runtime boundaries.
- **Three-Axis Risk Awareness:** Capability × Autonomy × Authority. The
  current core mainly enforces basic authority boundaries; richer risk shaping
  should come from governance, verification, and execution modules.

## Runtime Hierarchy

Four native levels of coordination, each with distinct isolation, cost, and guarantees:

```
Bun.spawn()      — OS process isolation (~ms create, structured clone IPC)
  behavioral()   — logical isolation, separate event space (~μs, function call)
    bThread      — shared event space, formal blocking (~μs, O(n) selection)
      bSync      — atomic synchronization point (~ns, array index)
```

Each level down is orders of magnitude cheaper but trades isolation for speed. The design principle: **push coordination DOWN the stack as far as isolation allows.**

| Level | Isolation | Message Cost | Use For |
|---|---|---|---|
| `Bun.spawn()` | Full (separate V8 heap) | ~μs (JSC structured clone) | Inference server (persistent), isolated workers, sandboxed bash |
| `behavioral()` | Logical (separate event space) | ~ns (function call) | PM engine + UI controller (same process, zero-copy via `trigger`) |
| `bThread` | None (shared event space) | Event selection eval | Constitution rules, task lifecycle, batch coordination |
| `bSync` | None (sequential) | Array advance | Individual synchronization points |

**Why `Bun.spawn()` over Workers:** Isolated worker processes are ephemeral
— spawn, do work, terminate. Bun's Worker API is experimental (particularly
`worker.terminate()`). `Bun.spawn()` has OS-guaranteed process lifecycle
(SIGTERM/SIGKILL/exit codes). IPC defaults to `serialization: "advanced"` (JSC
structured clone — not JSON). When Workers stabilize, swapping is a
one-interface change.

**Local inference:** The target same-machine inference bridge is a private
Unix domain socket carrying a framed `ActorEnvelope` stream. Plaited owns
policy, tools, permissions, sandboxing, actor routing, and side-effect
authority. The neural runtime owns model execution and model-internal cache,
KV, batching, and prefill optimizations. See
[Local Inference Bridge](local-inference-bridge.md).

**A2A and MCP surfaces:** The repo now has protocol/utilities under
`src/modules/a2a-module/` and `src/modules/mcp-module/`. They should be
treated as module-owned capability surfaces rather than fixed core runtime
layers. A2A covers remote agent exchange and MCP covers remote capability
discovery/execution.

## Deployment Tiers

The framework is not prescriptive about deployment:

| Tier | Example | Inference | Training | Trade-off |
|---|---|---|---|---|
| **Local** | Workstation, Mac Mini, attached GPU box | Yes | Hardware-dependent; smaller quantized local variants or larger attached-lane variants. | Zero ongoing cost. Full data sovereignty. Requires hardware. |
| **Cloud GPU** | Managed or rented GPU host | Yes | Provider- and hardware-dependent. | Pay monthly. No hardware to maintain. |
| **API-backed** | External model API | Yes | Usually no, unless provider supports fine-tuning. | Pay per use. No GPU needed. Training depends on provider support. |

The pluggable model interfaces make tier selection a deployment decision, not an architectural one. A consumer can start API-backed, move to cloud, and eventually self-host — swapping model implementations without changing bThreads, tools, or application logic.

**Workspace backup** is deployment infrastructure, not framework concern. The
framework provides snapshots, git history, and retained artifacts for agent
state recovery. Workspace-level backup varies by tier. One proposed local-first
deployment shape is documented in [Infrastructure](infrastructure.md).

## Companion Docs

| Doc | Scope |
|---|---|
| [Agent Loop](agent-loop.md) | Minimal core plus module-composed orchestration model |
| [Actor Runtime](actor-runtime.md) | Current actor runtime implementation notes and gaps |
| [Local Inference Bridge](local-inference-bridge.md) | Same-machine neural runtime IPC decision |
| [Infrastructure](infrastructure.md) | Local-first persistence, sandbox execution, sync boundaries |
| [Training And Improvement](training-and-improvement.md) | Discovery-first symbolic architecture and later model adaptation |
| [Plaited Experience Standard](plaited-experience-standard.md) | Local projections over actor-owned facts, services, policy, provenance |
| `skills/plaited-runtime/` | Runtime doctrine for behavioral coordination, MSS/module boundaries, and projection rules |
