# Plaited Agent — Architecture Overview

> **Status: ACTIVE** — Top-level architecture overview. Domain-specific details in companion docs.

## First Principles

Three axioms drive every decision:

1. **Decouple reasoning from action.** The inference server separates deliberation (`<think>...</think>` blocks) from final response at the protocol level. The framework consumes this separation — thinking feeds observability and training; the response feeds the tool-call pipeline. The agent never parses raw output to find the boundary.

2. **Symbolic persists, neural evolves.** Behavioral programs (bThreads) encode safety constraints and domain knowledge as deterministic code. They survive model upgrades, hardware changes, and architecture pivots. The neural layer — whichever model fills the Model role — is replaceable.

3. **Architecture outlives models.** Today's model is Falcon-H1R 7B. Tomorrow's may be different. The interfaces, the constraint engine, the memory taxonomy, and the safety layers are designed to remain stable across model generations.

## Overview

Plaited's agent layer is a **framework** — composable primitives shipped as a subpath export (`plaited/agent`) alongside the existing UI, testing, and workshop modules. It is not a platform. Platforms are what consumers build with it.

The framework provides:

- **Interfaces** for four model roles (Model, Indexer, Vision, Voice)
- **BP orchestration** for the agent loop, safety constraints, and context assembly
- **Memory via hypergraph** — BP decisions and tool results as git-versioned JSON-LD files (see `HYPERGRAPH-MEMORY.md`)
- **A constitution** encoding Structural-IA and Modnet concepts as bThreads + skills (see `skills/constitution/`)

The framework is **not prescriptive** about inference backend. Consumers choose how to serve models — vLLM, llama.cpp, Ollama, cloud APIs, or any OpenAI-compatible endpoint. All three backends support separating `<think>` reasoning from response content at the server level. Code ships via npm (`plaited`). Base-trained models ship via Hugging Face ([huggingface.co/plaited](https://huggingface.co/plaited)).

### Pluggable Models

Model, Indexer, Vision, and Voice are interfaces, not implementations:

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

type Indexer = {
  embed(text: string): Promise<Float32Array>
}

type Vision = {
  analyze(image: Uint8Array, prompt: string): Promise<VisionResponse>
}

type Voice = {
  speak(text: string, options?: { voice?: string }): Promise<Uint8Array>
}
```

The `AsyncIterable<ModelDelta>` interface works identically whether the backend is a local inference server (Ollama on localhost), a cloud GPU (vLLM), or an API endpoint (OpenRouter). Deltas stream via BP events (`thinking_delta`, `text_delta`) for progressive UI rendering. OpenAI-compatible wire format.

All four interfaces are backend-agnostic — implementations can target MLX (Apple Silicon), vLLM (CUDA/cloud), or any OpenAI-compatible endpoint. Swap the server, not the adapter.

### Reference Model Stack

| Role | Interface | Reference Model | Params | Function |
|---|---|---|---|---|
| **Reasoning** | `Model` | Falcon-H1R 7B (Mamba/SSM hybrid) | 7B | Reasons in `<think>` blocks. Produces structured tool calls. Fine-tuned via distillation from frontier agents. |
| **Embedding** | `Indexer` *(deferred)* | EmbeddingGemma (Gemma 3 300M base) | 300M | 768-dim embeddings (Matryoshka truncation to 512/256/128). Semantic similarity for hypergraph search. 2K token context. 100+ languages. |
| **Vision** | `Vision` *(deferred)* | Qwen 2.5 VL 7B | 7B | Image/video to structured description. Object localization, OCR, visual grounding. 29 languages. |
| **Speech output** | `Voice` *(deferred)* | Qwen3-TTS | ~2B | Text to speech. Voice cloning, voice design, streaming. Multilingual. |

**Speech input (STT) is a client-side concern.** Browsers provide the Web Speech API, iOS has `SFSpeechRecognizer`, Android has `SpeechRecognizer` — all on-device, free, multilingual. The client transcribes speech to text and sends it to the node as a normal `task` event. The node never processes raw audio input.

**Reference total: ~16.3B parameters across all roles.** In practice, only Model loads at startup (~4.6 GB quantized). Vision, Voice, and Indexer load on-demand when first called, then remain resident. On a 64+ GB machine all four run concurrently; on 18 GB they swap.

### Framework Compatibility

All reference models run on both MLX (Apple Silicon) and vLLM (CUDA/cloud):

| Model | MLX Package | vLLM Support | Quantized Size |
|---|---|---|---|
| Falcon-H1R 7B | mlx-lm | Yes | ~4.6 GB (Q4) |
| EmbeddingGemma 300M | mlx-community | Yes | ~200 MB (6-bit) |
| Qwen 2.5 VL 7B | mlx-vlm | Yes (official recipes) | ~4.6 GB (Q4) |
| Qwen3-TTS ~2B | mlx-audio | Yes (vLLM-Omni) | ~1.5 GB |

When switching hardware, swap the inference server — not the framework code. The adapter contract (OpenAI-compatible `/v1/` endpoints) is the stable boundary.

### Tools over Interfaces

Embedding, vision, and voice are exposed to the reasoning model as **tools** — `ToolDefinition` entries that Falcon H1R invokes via standard `tool_call` events. The typed interfaces (`Indexer`, `Vision`, `Voice`) sit behind the `ToolExecutor`, providing backend abstraction:

```
Agent Loop (Falcon H1R)
    │
    ├─ tool_call: "embed_search"  → ToolExecutor → Indexer.embed()
    ├─ tool_call: "analyze_image" → ToolExecutor → Vision.analyze()
    └─ tool_call: "speak"         → ToolExecutor → Voice.speak()
```

This design makes capabilities **observable** (tool calls appear in trajectories for SFT training), **gateable** (BP can block any tool call), and **trainable** (the model learns *when* to invoke each capability, not just *how*).

## Key Design Principles

- **Framework, Not Platform:** Composable primitives. Code via npm, models via Hugging Face. Platforms are built with it, not by it.
- **Single Tenancy:** 1 User : 1 Agent instance. User data lives on their agent — nowhere else.
- **Pluggable Models:** Model, Indexer, Vision, and Voice are interfaces. Implementations swap freely across MLX, vLLM, and cloud APIs.
- **BP-Orchestrated:** The PM's `behavioral()` engine is the central coordinator. Sub-agents run as `Bun.spawn()` processes for crash isolation; the PM's bThreads handle all structural coordination (task lifecycle, batch completion, constitution enforcement). See Runtime Hierarchy below.
- **Plan-Driven Context:** The model's plan provides the optimization signal for context assembly. Neural produces, symbolic consumes.
- **Defense in Depth:** Six independent safety layers across three stack levels. See `SAFETY.md`.
- **Three-Axis Risk Awareness:** Capability × Autonomy × Authority. Risk grows geometrically when all three scale. BP constraints cap each axis independently.

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
| `Bun.spawn()` | Full (separate V8 heap) | ~μs (JSC structured clone) | Inference server (persistent), sub-agents (ephemeral), sandboxed bash |
| `behavioral()` | Logical (separate event space) | ~ns (function call) | PM engine + UI controller (same process, zero-copy via `useRestrictedTrigger`) |
| `bThread` | None (shared event space) | Event selection eval | Constitution rules, task lifecycle, batch coordination |
| `bSync` | None (sequential) | Array advance | Individual synchronization points |

**Sub-agents** are `Bun.spawn()` processes, not bThreads. They have their own inference context and optionally their own `behavioral()` engine scoped to their role. The PM coordinates against a `SubAgentHandle` interface:

```typescript
type SubAgentHandle = {
  send: Trigger                     // PM → sub-agent (same Trigger type as BP)
  onMessage(handler: Trigger): void // sub-agent → PM
  terminate(): Promise<void>
}
```

**Why `Bun.spawn()` over Workers:** Sub-agents are ephemeral — spawn, do work, terminate. Bun's Worker API is experimental (particularly `worker.terminate()`). `Bun.spawn()` has OS-guaranteed process lifecycle (SIGTERM/SIGKILL/exit codes). IPC defaults to `serialization: "advanced"` (JSC structured clone — not JSON). When Workers stabilize, swapping is a one-interface change.

**Local inference:** The inference server runs as a persistent `Bun.spawn()` process (Ollama, llama.cpp, vLLM) on the same box. Sub-agents call it via `fetch("http://localhost:PORT")` — async I/O that doesn't block the event loop. GPU/Apple Silicon Metal handles acceleration.

**A2A transport:** Bun-native implementation of A2A protocol (no a2a-js dependency). One `Bun.serve()` handles all transports — HTTP+JSON/REST, WebSocket (custom binding), and unix sockets — with native mTLS. See `skills/modnet-node/` [a2a-bindings.md](../skills/modnet-node/references/a2a-bindings.md) for deployment-specific bindings. Implementation in `src/a2a/`.

## Deployment Tiers

The framework is not prescriptive about deployment:

| Tier | Example | Inference | Training | Trade-off |
|---|---|---|---|---|
| **Local** | Mac Mini, DGX Spark | Yes | DGX Spark: full-parameter. Consumer GPU: LoRA only. | Zero ongoing cost. Full data sovereignty. Requires hardware. |
| **Cloud GPU** | RunPod, Lambda, Fly.io | Yes | Full-parameter on 4–8× A100 80GB cluster | Pay monthly. No hardware to maintain. |
| **API-backed** | MiniMax, OpenRouter | Yes | No (unless provider supports fine-tuning) | Pay per use. No GPU needed. Dreamer/training not available. |

The pluggable model interfaces make tier selection a deployment decision, not an architectural one. A consumer can start API-backed, move to cloud, and eventually self-host — swapping model implementations without changing bThreads, tools, or application logic.

**Workspace backup** is deployment infrastructure, not framework concern. The framework provides the hypergraph memory for agent state recovery. Workspace-level backup varies by tier.

## Companion Docs

| Doc | Scope |
|---|---|
| `AGENT-LOOP.md` | 6-step loop overview (impl patterns in `skills/agent-loop/`) |
| `SAFETY.md` | Three-axis risk, defense in depth (6 layers) |
| `skills/constitution/` | Governance factories, neuro-symbolic split, MAC/DAC |
| `TRAINING.md` | Distillation pipeline, training tiers, flywheel |
| `HYPERGRAPH-MEMORY.md` | Git-versioned JSON-LD memory, context assembly, plans as bThreads |
| `PROJECT-ISOLATION.md` | Multi-project orchestrator, IPC bridge, tool layers |
| `skills/modnet-node/` | Modnet topology, A2A protocol, identity, access control, and node references |
| `GENOME.md` | Skills taxonomy (seeds/tools/eval), CONTRACT frontmatter, wave ordering |
| ~~`CRITIQUE-RESPONSE.md`~~ | Removed — gap resolutions folded into `PLAN.md` Part 4 (Design Decisions) |
| `UI.md` | Generative UI overview (details in `generative-ui` skill) |
| ~~`BEHAVIORAL-PROGRAMMING.md`~~ | Migrated → `skills/behavioral-core/references/algorithm-reference.md` |
