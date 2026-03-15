# Sub-Agent Coordination (4-Step Harness)

The PM decomposes complex tasks into sub-tasks, each handled by a `Bun.spawn()` sub-agent. The harness maps to BP:

1. **Decompose** — PM reads task context, breaks into sub-tasks via bThread coordination
2. **Parallelize** — Spawn sub-agent processes (each calls local inference server via `fetch`)
3. **Verify** — Judge sub-agent evaluates results against acceptance criteria
4. **Iterate** — On failure, spawn FRESH sub-agent with error context (new process, clean context window)

```mermaid
graph TD
    subgraph PM["PM Engine (persistent behavioral())"]
        TASK["task event"]
        DECOMP["Decompose<br/>bThread breaks into sub-tasks"]
        BATCH["batchCompletion<br/>waits for N results"]
        CONST["Constitution<br/>MAC/DAC bThreads"]
    end

    subgraph Workers["Sub-Agents (Bun.spawn, ephemeral)"]
        W1["Worker 1<br/>fetch → inference server"]
        W2["Worker 2<br/>fetch → inference server"]
        JUDGE["Judge<br/>evaluates against criteria"]
    end

    subgraph Infra["Infrastructure (Bun.spawn, persistent)"]
        INF["Inference Server<br/>Ollama / llama.cpp / vLLM"]
    end

    TASK --> DECOMP
    DECOMP -->|"spawn"| W1
    DECOMP -->|"spawn"| W2
    W1 -->|"IPC result"| BATCH
    W2 -->|"IPC result"| BATCH
    BATCH -->|"spawn"| JUDGE
    JUDGE -->|"IPC verdict"| PM
    W1 -.->|"fetch localhost"| INF
    W2 -.->|"fetch localhost"| INF
    JUDGE -.->|"fetch localhost"| INF
    CONST -.->|"blocks"| DECOMP

    style W1 fill:#e8d5f5,stroke:#333
    style W2 fill:#e8d5f5,stroke:#333
    style JUDGE fill:#e8d5f5,stroke:#333
    style INF fill:#d5e8f5,stroke:#333
```

## SubAgentHandle Interface

Sub-agents communicate with the PM via the `SubAgentHandle` interface (see `ARCHITECTURE.md` § Runtime Hierarchy). IPC uses `serialization: "advanced"` (JSC structured clone). The inference server is a persistent process on the same box — sub-agents call it via `fetch("http://localhost:PORT")`, making inference async I/O from the sub-agent's perspective.

## Key Design Decisions

- **Crash isolation:** Each sub-agent is a `Bun.spawn()` process. If it crashes, the PM's `behavioral()` engine continues — the IPC channel reports the failure.
- **Fresh context on retry:** On failure, spawn a FRESH sub-agent (new process, clean context window) with error context from the previous attempt. Don't retry in the same process.
- **PM bThreads only:** Sub-agents run as minimal inference runners. All structural coordination (task lifecycle, batch completion, constitution enforcement) lives in the PM's bThreads.
- **Inference server locality:** The inference server (`Ollama`, `llama.cpp`, `vLLM`) runs as a persistent `Bun.spawn()` on the same box. Sub-agents call it via `fetch("http://localhost:PORT")` — no network hops, no auth overhead.
