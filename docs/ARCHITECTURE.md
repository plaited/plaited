# Plaited Agent — Architecture Overview

> **Status: ACTIVE** — Top-level architecture overview. Domain-specific details in companion docs.

## First Principles

Three axioms drive every decision:

1. **Decouple reasoning from action.** The inference server separates deliberation (`<think>...</think>` blocks) from final response at the protocol level. The framework consumes this separation — thinking feeds observability and training; the response feeds the tool-call pipeline. The agent never parses raw output to find the boundary.

2. **Symbolic persists, neural evolves.** Behavioral programs (bThreads) encode safety constraints and domain knowledge as deterministic code. They survive model upgrades, hardware changes, and architecture pivots. The neural layer — whichever model fills the Model role — is replaceable.

3. **Architecture outlives models.** The current reference lane is a
   Gemma 4 family served through an OpenAI-compatible backend such as vLLM, but
   the interfaces, the constraint engine, the memory taxonomy, and the safety
   layers are designed to remain stable across model generations.

## Overview

Plaited's agent layer is a **framework** — composable primitives shipped as a subpath export (`plaited/agent`) alongside the existing UI, testing, and workshop modules. It is not a platform. Platforms are what consumers build with it.

The framework provides:

- **Interfaces** for the primary reasoning model plus optional adjunct model
  roles such as speech
- **A minimal behavioral core** plus module-composed orchestration
- **Memory via snapshots, git, and retained artifacts** — observable BP execution plus git-backed files and commit history
- **Governance and verification as module-level directions** rather than a
  shipped dedicated constitution runtime

The framework is **not prescriptive** about inference backend. Consumers choose how to serve models — vLLM, llama.cpp, Ollama, cloud APIs, or any OpenAI-compatible endpoint. All three backends support separating `<think>` reasoning from response content at the server level. Code ships via npm (`plaited`). Base-trained models ship via Hugging Face ([huggingface.co/plaited](https://huggingface.co/plaited)).

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

The `AsyncIterable<ModelDelta>` interface works identically whether the backend is a local inference server (Ollama on localhost), a cloud GPU (vLLM), or an API endpoint (OpenRouter). Deltas stream via BP events (`thinking_delta`, `text_delta`) for progressive UI rendering. OpenAI-compatible wire format.

The model interfaces are backend-agnostic. Implementations can target MLX
(Apple Silicon), vLLM (CUDA/cloud), or any OpenAI-compatible endpoint. Swap
the server, not the adapter.

Multimodal input does not need a dedicated core vision event. When the primary
model is natively multimodal, image and video handling can ride through the
primary inference lane or through module-owned extensions rather than a fixed
built-in vision primitive.

### Reference Model Stack

| Role | Interface | Reference Model | Params | Function |
|---|---|---|---|---|
| **Primary reasoning + tool use** | `Model` | Gemma 4 family via vLLM | E4B / 26B-A4B / 31B | Function calling, structured JSON, long-context reasoning, and local-first or server-hosted deployment depending on hardware. |
| **Speech output** | `Voice` *(deferred)* | Qwen3-TTS | ~2B | Text to speech. Voice cloning, voice design, streaming. Multilingual. |

**Speech input (STT) is a client-side concern.** Browsers provide the Web Speech API, iOS has `SFSpeechRecognizer`, Android has `SpeechRecognizer` — all on-device, free, multilingual. The client transcribes speech to text and sends it to the node as a normal `task` event. The node never processes raw audio input.

The reference point is no longer a fixed 7B starter model. The model family
should scale with the deployment lane:

- local-by-default quantized Gemma 4 variants for privacy, offline work, and
  tighter hardware footprints
- larger Gemma 4 variants when attached GB10 / DGX Spark / workstation-class
  hardware makes a stronger server-backed lane practical

The design goal is consistency across tiers, not different agent behavior per
host class. Local and server lanes should stay within the same model family,
tool-calling contract, and response shape. The server lane is the stronger
variant of the same cognitive surface, not a separate product.

### Reference Deployment

The stable boundary is the OpenAI-compatible inference adapter contract, not a
specific local runtime.

The primary reference lane is:

- Gemma 4 served through vLLM
- Bun process as the local orchestrator/runtime
- a local/server split where the node home and control plane stay local while
  larger model serving can sit on attached MSI / GB10-class hardware
- optional local or remote OpenAI-compatible providers for adjunct roles such
  as speech

Under that split:

- the local lane should prefer a quantized Gemma 4 variant when the goal is
  privacy, portability, or offline operation
- the server lane can step up to a larger Gemma 4 variant for harder
  reasoning, longer-context work, or heavier multimodal workloads
- escalation between lanes should preserve prompt format, tool semantics, and
  output structure

That keeps training and native-model execution anchored to the MSI + vLLM lane
while preserving the ability to swap serving backends without changing the
agent engine or module contracts.

## Core Shape

`src/agent/create-agent.ts` defines a minimal execution substrate, not a full
top-level loop policy.

The core owns:

- `behavioral()` engine setup
- host `trigger` ingress surface
- module `emit` ingress surface (provided via module params)
- event-derived context memory policy (`moduleId:eventType` -> last `detail`)
- heartbeat emission
- host/runtime snapshot diagnostics via `reportSnapshot`
- built-in handlers for:
  - primary inference
  - speech output inference
  - `read_file`
  - `write_file`
  - `delete_file`
  - `glob_files`
  - `grep`
  - `bash`
- dynamic module installation

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

## Key Design Principles

- **Framework, Not Platform:** Composable primitives. Code via npm, models via Hugging Face. Platforms are built with it, not by it.
- **Single Tenancy:** 1 User : 1 Agent instance. User data lives on their agent — nowhere else.
- **Pluggable Models:** The primary model and optional adjunct roles are
  interfaces. Implementations swap freely across MLX, vLLM, and cloud APIs.
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

**Local inference:** The inference server runs as a persistent `Bun.spawn()`
process (Ollama, llama.cpp, vLLM) on the same box. Local runtimes call it via
`fetch("http://localhost:PORT")` — async I/O that doesn't block the event
loop. GPU/Apple Silicon Metal handles acceleration.

**A2A and MCP surfaces:** The repo now has protocol/utilities under
`src/modules/a2a-module/` and `src/modules/mcp-module/`. They should be
treated as module-owned capability surfaces rather than fixed core runtime
layers. A2A covers remote agent exchange and MCP covers remote capability
discovery/execution.

## Deployment Tiers

The framework is not prescriptive about deployment:

| Tier | Example | Inference | Training | Trade-off |
|---|---|---|---|---|
| **Local** | MSI, Mac Mini, DGX Spark | Yes | MSI / DGX Spark: larger Gemma 4-class serving lanes. Consumer GPU: quantized local Gemma 4 variants or LoRA only. | Zero ongoing cost. Full data sovereignty. Requires hardware. |
| **Cloud GPU** | RunPod, Lambda, Fly.io | Yes | Full-parameter on 4–8× A100 80GB cluster | Pay monthly. No hardware to maintain. |
| **API-backed** | MiniMax, OpenRouter | Yes | No (unless provider supports fine-tuning) | Pay per use. No GPU needed. Dreamer/training not available. |

The pluggable model interfaces make tier selection a deployment decision, not an architectural one. A consumer can start API-backed, move to cloud, and eventually self-host — swapping model implementations without changing bThreads, tools, or application logic.

**Workspace backup** is deployment infrastructure, not framework concern. The
framework provides snapshots, git history, and retained artifacts for agent
state recovery. Workspace-level backup varies by tier. One proposed local-first
deployment shape is documented in `INFRASTRUCTURE.md`.

## Companion Docs

| Doc | Scope |
|---|---|
| `AGENT-LOOP.md` | Minimal core plus module-composed orchestration model |
| `INFRASTRUCTURE.md` | Local-first persistence, sandbox execution, sync boundaries |
| `skills/modnet-modules/` | Modnet/MSS/A2A translation for current module-era agents |
| `dev-research/default-modules/program.md` | Active default module bundle direction |
| `dev-research/three-axis-modules/program.md` | Cross-cutting capability, autonomy, and authority control |
| `dev-research/agent-bootstrap/program.md` | Bootstrap CLI and deployment tooling direction |
| `skills/plaited-ui/` | Plaited UI runtime, protocol, and testing guidance |
