---
name: project-isolation
description: Orchestrator + subprocess architecture for multi-project agents. Use when implementing project routing with Bun.spawn IPC, wiring tool layer assembly (framework + global + project), loading constitutions at spawn, or coordinating sub-agents within project subprocesses.
license: ISC
compatibility: Requires bun
---

# Project Isolation

## Purpose

This skill teaches agents how to implement hard process boundaries between projects using Bun.spawn IPC. A single agent may work across multiple git repositories with different security contexts — project isolation ensures memory separation, crash containment, and independent tool/constitution configuration per project.

**Use this when:**
- Implementing the orchestrator → project subprocess architecture
- Wiring IPC trigger bridges between processes
- Assembling tool layers at subprocess spawn
- Loading constitutions as immutable bThreads
- Spawning sub-agents within a project subprocess
- Designing cross-project knowledge transfer

## Architecture

The orchestrator runs a `behavioral()` engine that routes tasks by project key (git root path). Each project gets its own `Bun.spawn()` subprocess with independent agent loop, tools, and constitution.

```mermaid
graph TD
    subgraph Orchestrator["Orchestrator (behavioral())"]
        ROUTE["Route by project key"]
        CONST["Constitution bThreads<br/>(immutable, loaded at spawn)"]
    end

    subgraph P1["Project A (Bun.spawn)"]
        REF1["Agent loop<br/>Model → Gate → Execute"]
        MEM1["JSON-LD decisions<br/>(git-versioned)"]
    end

    subgraph P2["Project B (Bun.spawn)"]
        REF2["Agent loop<br/>Model → Gate → Execute"]
        MEM2["JSON-LD decisions<br/>(git-versioned)"]
    end

    ROUTE -->|IPC| P1
    ROUTE -->|IPC| P2
    P1 -->|IPC events| Orchestrator
    P2 -->|IPC events| Orchestrator
```

**Project routing:** A task arrives with a path. The orchestrator resolves the git root, looks up the project in the registry, spawns (or reuses) a subprocess, and forwards the task via IPC.

## IPC Trigger Bridge

BP events `{ type, detail }` are natively compatible with `structuredClone` serialization, making Bun's IPC a natural fit.

```typescript
// Orchestrator → Project subprocess
const project = Bun.spawn(['bun', 'run', projectEntry], {
  ipc(message) {
    const event = BPEventSchema.safeParse(message)
    if (event.success) trigger(event.data)
  }
})

// Send task to project
project.send({ type: 'task', detail: { prompt, context } })

// Project subprocess side
process.on('message', (message) => {
  const event = BPEventSchema.safeParse(message)
  if (event.success) trigger(event.data)
})

// Results back to orchestrator
useFeedback({
  tool_result({ detail }) {
    process.send!({ type: 'tool_result', detail })
  }
})
```

See **[references/ipc-bridge.md](references/ipc-bridge.md)** for detailed patterns and serialization constraints.

## Tool Layer Assembly

Tools are assembled from three layers at subprocess spawn time:

```
Framework built-ins (read_file, write_file, bash, save_plan, etc.)
  + ~/.agents/skills/*          → global skills
  + ~/.agents/mcp.json servers  → global MCP tools
  + skills/*                    → project skills
  + OS PATH binaries            → discovered, approval-gated
  + project-local binaries      → node_modules/.bin/, etc.
  → model sees available tools in context
```

See **[references/tool-assembly.md](references/tool-assembly.md)** for the three-layer model and approval rules.

## Constitution Loading

The constitution is loaded at subprocess spawn time and is **immutable for the lifetime of that process.** The orchestrator passes constitution bThreads as part of the spawn configuration. The subprocess cannot modify its own constitution — this is the MAC layer in action.

Constitution rules are additive blocking threads (see **behavioral-core** skill, Pattern 3). Each rule composes independently:

```typescript
// Constitution loaded at spawn — subprocess cannot modify
for (const rule of constitution.rules) {
  bThreads.set({
    [rule.name]: bThread([
      bSync({ block: rule.predicate }),
    ], true),  // persistent: blocks forever
  })
}
```

## Two Levels of Bun.spawn

The architecture uses `Bun.spawn()` at two distinct levels. They serve different purposes but use the same IPC mechanism:

| Level | Purpose | Lifecycle | Spawned By |
|---|---|---|---|
| **Project subprocess** | Isolate codebases with different security contexts | Long-lived (reused across tasks) | Orchestrator |
| **Sub-agent process** | Isolate inference + tool execution per sub-task | Ephemeral (per-task, fresh context) | PM engine within a project subprocess |

```
Orchestrator (behavioral())
  └─ Project A (Bun.spawn)     ← long-lived, per-project
       └─ PM Engine (behavioral())
            ├─ Sub-agent 1 (Bun.spawn)  ← ephemeral, per-task
            ├─ Sub-agent 2 (Bun.spawn)  ← ephemeral, per-task
            └─ Judge (Bun.spawn)        ← ephemeral, per-verification
  └─ Project B (Bun.spawn)
       └─ PM Engine (behavioral())
            └─ ...
```

A project subprocess contains the PM's `behavioral()` engine. The PM spawns sub-agents within that subprocess's context — sub-agents inherit the project's cwd, tool assembly, and constitution. The orchestrator doesn't manage sub-agents directly; it routes tasks to the right project, and the project's PM handles decomposition.

## Cross-Project Knowledge

Project subprocesses have hard process boundaries — Project A's memory cannot leak to Project B. Knowledge transfer happens through **model weights**, not data sharing:

| What | Mechanism |
|---|---|
| Shared tool configs | `~/.agents/mcp.json` (user installs globally) |
| Shared skills | `~/.agents/skills/` (global), `skills/` (project-level) |
| Style and patterns | Model weights (training flywheel) + code-pattern skills |
| Project-specific knowledge | Per-project JSON-LD files only (never crosses boundary) |

## Related Skills

- **behavioral-core** — BP patterns (constitution as additive blocking threads)
- **constitution** — Governance factory patterns, MAC/DAC rules
- **agent-loop** — 6-step agent pipeline that runs inside each subprocess
- **hypergraph-memory** — JSON-LD event log partitioning per project
