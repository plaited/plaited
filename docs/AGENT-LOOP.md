# The Agent Loop

> **Status: ACTIVE** — Extracted from SYSTEM-DESIGN-V3.md. Replaces the `agent-build` skill as the authoritative loop reference. Cross-references: `SAFETY.md` (defense layers), `HYPERGRAPH-MEMORY.md` (context assembly, plans as bThreads), `CONSTITUTION.md` (governance enforcement).

## The 6-Step Loop

One central `behavioral()` program orchestrates the entire loop. No actors, no workers, no separate signal stores. BP manages state through bThread closures and coordinates compute via `Bun.spawn()` subprocesses for inference and sandboxed execution.

```mermaid
graph LR
    subgraph BP["behavioral() — Central Orchestrator"]
        CTX["1. Context<br/>context_assembly event<br/>+ contributor handlers"]
        REASON["2. Reason<br/>Bun.spawn() → Model<br/>(thinking + tool call)"]
        GATE["3. Gate<br/>bThread block predicates"]
        SIM["4. Simulate (Dreamer)<br/>Bun.spawn() → Model<br/>(State Transition Prompt)"]
        EVAL["5. Evaluate (Judge)<br/>5a: BP symbolic gate<br/>5b: Model neural scorer"]
        EXEC["6. Execute<br/>Bun.spawn() → sandboxed subprocess"]
    end

    CTX --> REASON
    REASON --> GATE

    GATE -- "blocked + reason → trigger()" --> CTX
    GATE -- "approved (read-only)" --> EXEC
    GATE -- "approved (has side effects)" --> SIM
    SIM --> EVAL

    EVAL -- "rejected + reason → trigger()" --> CTX
    EVAL -- "approved" --> EXEC
    EXEC -- "tool result → trigger()" --> CTX
```

### Step Details

1. **Context** — BP assembles the model's prompt via the `context_assembly` event (see `HYPERGRAPH-MEMORY.md`). Contributor handlers provide: plan state, active constraints, conversation history, relevant tool descriptions, prior gate rejections, constitution knowledge.

2. **Reason** — The model produces two outputs separated by the inference server: `<think>` blocks containing reasoning, and a structured tool call. On the first cycle, the tool call may be `save_plan`. On subsequent cycles, the model adjusts based on tool results.

3. **Gate** — BP evaluates the tool call via `block` predicates. Deterministic: if any bThread blocks, the action is denied. The rejection reason feeds back to step 1 as context. For read-only actions, approved calls skip to step 6 — no simulation needed.

4. **Simulate (Dreamer)** — For side-effect actions, the model is called again with a **State Transition Prompt** (adapted from [WebDreamer](https://arxiv.org/abs/2411.06559)). The prompt instructs the model to predict only state changes — predicted stdout, error messages, or file diffs.

5. **Evaluate (Judge)** — Two layers assess the simulated output:
   - **5a — Symbolic Gate (fast, deterministic):** BP `block` predicates evaluate the Dreamer's text output via regex/keyword matching.
   - **5b — Neural Scorer (slow, optional):** Only for high-ambiguity actions. The model scores the simulated state on progress toward the goal.

6. **Execute** — Only if Gate (3), symbolic gate (5a), and neural scorer (5b, if active) all approve. The tool call runs in a sandboxed subprocess. Output returns via `trigger()` as new context.

### Selective Simulation

BP classifies actions at the Gate and routes accordingly:

| Risk Class | Actions | Path |
|---|---|---|
| **Read-only** | File read, search, LSP query, plan navigation | Gate → Execute (skip simulation) |
| **Side effects** | File write, bash command, file creation/deletion | Gate → Simulate → 5a symbolic gate → Execute |
| **High ambiguity** | Network calls, payment, system config, destructive ops | Gate → Simulate → 5a + 5b neural scorer → Execute |

### `<think>` as Lightweight Simulation

The model's `<think>` block is itself a first layer of prediction. If the thinking already predicts a violation, the Gate blocks without invoking the Dreamer. The Dreamer handles cases where `<think>` didn't surface the risk.

## Event Flow

```mermaid
graph TD
    TASK[task] --> CA[context_assembly]
    CA --> INV[invoke_inference]
    INV --> INF[async: callInference]
    INF --> MR[model_response]
    MR -->|per tool call| CR[context_ready]
    CR --> GATE{composedGateCheck}
    GATE -->|gate_read_only| EXEC[execute]
    GATE -->|gate_side_effects| SIM[simulate_request]
    GATE -->|gate_high_ambiguity| SIM
    GATE -->|gate_rejected| GR[gate_rejected]
    SIM --> SR[simulation_result]
    SR --> EA[eval_approved]
    EA -->|safe| EXEC
    EA -->|dangerous| ER[eval_rejected]
    EXEC --> TR[tool_result]
    GR --> BC{batchCompletion}
    ER --> BC
    TR --> BC
    BC -->|count = 0| CA
    MR -->|no tools, has message| MSG[message]
    MSG -->|taskGate loops| TASK
```

**Narrow World View:** Each tool call is an independent scenario. `model_response` triggers one `context_ready` event per tool call, each flowing through its own pipeline. `batchCompletion` waits for all N to resolve, then triggers `context_assembly` for the next inference call.

**Pipeline pass-through:** Events always flow through the full simulate → evaluate → execute pipeline. When a seam is absent, the handler passes through via optional chaining — no conditional routing.

## ACP Interface (Agent Communication Protocol)

The agent exposes an `AgentNode` — `{ trigger, subscribe, snapshot, destroy }` — as its external API. External clients (control UIs, headless adapters, eval harness) communicate through this interface.

### Control UI via ACP

The control UI is a **generative UI** rendered via the controller protocol (see `UI.md`). It communicates with the agent over WebSocket, which bridges to `AgentNode.trigger()` and `AgentNode.subscribe()`.

```mermaid
graph LR
    UI[Control UI / Browser] -->|WebSocket| SRV[Server]
    SRV -->|trigger| AN[AgentNode]
    AN -->|subscribe events| SRV
    SRV -->|WebSocket| UI
```

The UI is not a TUI — it's server-driven HTML generated by the agent. The agent decides what to render based on the task context. The controller protocol (render/attrs/update_behavioral) handles bidirectional updates.

### Headless Mode via ACP

For programmatic access (eval harness, CI, orchestrator), the agent supports headless operation via stdin/stdout or subprocess IPC:

| Mode | Transport | Use Case |
|---|---|---|
| **WebSocket** | Browser ↔ Server | Control UI (generative UI) |
| **IPC** | `Bun.spawn({ ipc: true })` | Orchestrator ↔ Project subprocess |
| **stdin/stdout** | JSONL stream | Headless eval harness, CI pipelines |

All modes use the same `AgentNode` API — the transport adapter translates between the protocol and `trigger()`/`subscribe()`.

### SSH Access

System engineers can access the node directly via SSH for:
- Constitution modification (adding/removing MAC factories outside normal agent process)
- Debugging (inspecting JSON-LD decision files, git history)
- Recovery (replaying from hypergraph memory)

SSH access bypasses the agent process entirely — it's OS-level access to the node's filesystem.

## Why Distillation, Not a Pre-trained Tool-Calling Model

Pre-trained tool-calling models (GPT-4, Claude) are trained on generic tool schemas. Our model needs:

1. **Specific tool schemas** — our tools have specific argument shapes and output formats
2. **BP-aware reasoning** — the model needs to understand that blocked actions should be re-planned, not retried
3. **Dreamer capability** — predicting state transitions requires training on `(Context + Tool Call) → (Real Output)` pairs from our specific tools
4. **Constitution awareness** — the model learns governance constraints through context assembly + experience, not generic instruction-following

Distillation from frontier agents (Claude Code, Gemini CLI) via the eval harness provides the reasoning patterns. Fine-tuning on our specific tools and BP feedback loop produces a model that's both capable and constraint-aware. See `TRAINING.md`.

## Default Tools

The framework ships with built-in tools for file system and shell access:

| Tool | Category | Description |
|---|---|---|
| `read_file` | Read-only | Read file contents |
| `write_file` | Side effects | Write/create files |
| `edit_file` | Side effects | Targeted string replacement in files |
| `bash` | Side effects / High ambiguity | Execute shell commands |
| `list_directory` | Read-only | List directory contents |
| `save_plan` | Internal | Save plan (flows through normal pipeline) |

Additional tools come from skills (see `GENOME.md` for the seeds/tools/eval taxonomy) and MCP servers (see `PROJECT-ISOLATION.md` for tool layers).

**Open question: what additional tools should ship as defaults?** This needs evaluation against pi-mono's tool set and our specific needs (hypergraph queries, constitution management, model lifecycle).
