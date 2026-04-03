---
name: agent-loop
description: 6-step BP-orchestrated agent pipeline. Use when implementing createAgentLoop, wiring handlers, designing event flow, and maintaining the stable loop architecture.
license: ISC
compatibility: Requires bun
---

# Agent Loop

## Purpose

This skill teaches agents how to build and extend the stable 6-step agent
pipeline orchestrated by behavioral programming. The loop is:
**Context → Reason → Gate → Simulate → Evaluate → Execute**, with BP's
`behavioral()` engine as the central coordinator.

Treat this skill as the contract and architecture surface for the agent loop.
Exploratory policy around proactive behavior, sub-agent orchestration, or
autonomy strategy should live in research programs rather than accumulating here
as if it were already settled runtime doctrine.

**Use this when:**
- Implementing or extending `createAgentLoop()` handlers
- Wiring new events into the pipeline
- Designing gate predicates or simulation routing
- Connecting external clients via the AgentNode interface

**Use with caution when:**
- treating evolving proactive or sub-agent policy as if it were a stable loop invariant
- turning this skill into a generator surface for domain-specific artifacts

## Quick Reference

**Core files:**
- `src/agent/agent.loop.ts` — `createAgentLoop()` entry point
- `src/agent/agent.context.ts` — Priority-based context assembly
- `src/agent/agent.gate.ts` — `composedGateCheck` with risk tag routing
- `src/agent/agent.simulate.ts` — Dreamer (State Transition Prompt)
- `src/agent/agent.evaluate.ts` — Judge (5a symbolic + 5b neural)
- `src/agent/agent.governance.ts` — Constitution factories
- `src/agent/proactive.ts` — Heartbeat, sensor sweep, tickYield
- `src/agent/sensors/git.ts` — Reference `SensorFactory` implementation
- `src/agent/agent.factories.ts` — `createGoal()`, `createConstitution()`, `createWorkflow()`

**Model interface:** `Model.reason(context, signal) → AsyncIterable<ModelDelta>` (OpenAI-compatible wire format).

**Three model roles:** Model (required), Indexer (deferred), Vision (deferred).

## References

### Event Flow

**[event-flow.md](references/event-flow.md)** — Mermaid diagrams and event vocabulary tables covering:
- Full pipeline event flow (reactive and proactive paths)
- Event vocabulary: who produces, who consumes each event
- Proactive extensions (tick, sensor_delta, sleep)
- Narrow world view: each tool call is an independent scenario

### Proactive and Autonomy References

The following references are still useful, but they should be read as supporting
patterns rather than core loop invariants:

- **[proactive-mode.md](references/proactive-mode.md)** — heartbeat and proactive coordination patterns
- **[sensor-patterns.md](references/sensor-patterns.md)** — `SensorFactory` examples and diff patterns
- **[sub-agents.md](references/sub-agents.md)** — sub-agent coordination patterns

## Event Vocabulary

### Core Pipeline Events

| Event | Produced by | Consumed by |
|-------|-------------|-------------|
| `task` | External trigger (user, ACP, IPC) | `taskGate` bThread |
| `context_assembly` | `batchCompletion` request / initial task flow | Context contributor handlers |
| `invoke_inference` | Context assembly completion | Inference handler (`callInference`) |
| `model_response` | Inference handler | Response parser (creates per-tool-call events) |
| `context_ready` | Response parser (one per tool call) | Gate handler (`composedGateCheck`) |
| `gate_approved` | Gate handler | Execute handler (workspace-only) or simulate handler |
| `gate_rejected` | Gate handler | `batchCompletion` (counts as completion) |
| `simulate_request` | Gate handler (non-workspace tags) | Simulate handler (Dreamer) |
| `simulation_result` | Simulate handler | Evaluate handler (Judge) |
| `eval_approved` | Evaluate handler | Execute handler |
| `eval_rejected` | Evaluate handler | `batchCompletion` (counts as completion) |
| `execute` | Pipeline routing | Execute handler (sandboxed subprocess) |
| `tool_result` | Execute handler | `batchCompletion` (counts as completion) |
| `message` | Model response (no tool calls, text only) | `taskGate` (loops back to waiting) |

### Proactive Extensions

| Event | Produced by | Consumed by |
|-------|-------------|-------------|
| `tick` | `setInterval` timer (external) | Tick handler (sensor sweep) |
| `sensor_sweep` | Tick handler | Sensor handlers |
| `sensor_delta` | Individual sensor handlers | Goal bThreads, `sensorBatch` bThread |
| `sleep` | Tick handler (no deltas) or model (no action) | `taskGate` (loops back) |
| `set_heartbeat` | Model tool call | Execute handler (reconfigures timer) |

These proactive events are extensions on top of the stable loop, not the core
definition of the loop itself.

## Key Patterns

### Pattern 1: taskGate — Pipeline Phase Control

The `taskGate` bThread is the pipeline's main coordinator. It blocks all pipeline events until a `task` (or `tick`) arrives, then allows them until a `message` completes the cycle:

```typescript
bThreads.set({
  taskGate: bThread([
    bSync({
      waitFor: (e) => e.type === AGENT_EVENTS.task || e.type === 'tick',
      block: (e) => PIPELINE_EVENTS.has(e.type),
    }),
    bSync({ waitFor: AGENT_EVENTS.message }),
  ], true),
})
```

### Pattern 2: batchCompletion — Parallel Tool Call Coordination

Each `model_response` may contain N tool calls. Each flows through the pipeline independently. `batchCompletion` waits for all N to resolve (as `tool_result`, `gate_rejected`, or `eval_rejected`), then requests `invoke_inference`:

```typescript
useFeedback({
  model_response({ toolCalls, text }) {
    if (toolCalls.length > 0) {
      const isCompletion = (e: BPEvent) =>
        ['tool_result', 'gate_rejected', 'eval_rejected'].includes(e.type)

      bThreads.set({
        batchCompletion: bThread([
          ...Array.from({ length: toolCalls.length }, () =>
            bSync({ waitFor: isCompletion }),
          ),
          bSync({ request: { type: AGENT_EVENTS.invoke_inference } }),
        ]),
      })
      for (const tc of toolCalls) {
        trigger({ type: AGENT_EVENTS.context_ready, detail: { toolCall: tc } })
      }
    } else {
      trigger({ type: AGENT_EVENTS.message, detail: { content: text } })
    }
  },
})
```

**Critical:** `bThreads.set()` MUST come before `trigger()` — see `behavioral-core` skill, "Handler Operation Order."

**Critical:** Zero-length batchCompletion is an anti-pattern. Only create when `toolCalls.length > 0`.

### Pattern 3: sim_guard — Per-Call Simulation Blocking

Each tool call that routes to simulation gets its own guard thread. The guard blocks `execute` for that specific call until `simulation_result` arrives:

```typescript
useFeedback({
  simulate(detail) {
    const id = detail.toolCall.id

    bThreads.set({
      [`sim_guard_${id}`]: bThread([
        bSync({
          block: (e) => e.type === 'execute' && e.detail?.toolCall?.id === id,
          interrupt: [(e) => e.type === 'simulation_result' && e.detail?.toolCall?.id === id],
        }),
      ]),
    })

    // ... async simulation, then:
    trigger({ type: 'simulation_result', detail: { toolCall: detail.toolCall, prediction } })
  },
})
```

### Pattern 4: maxIterations — Safety Limit

Prevents runaway inference loops by counting `tool_result` events and forcing termination:

```typescript
useFeedback({
  task(detail) {
    bThreads.set({
      maxIterations: bThread([
        ...Array.from({ length: MAX_TOOL_CALLS }, () =>
          bSync({ waitFor: 'tool_result', interrupt: ['message'] }),
        ),
        bSync({
          block: 'execute',
          request: { type: 'message', detail: { content: 'Max iterations reached' } },
          interrupt: ['message'],
        }),
      ]),
    })
  },
})
```

## Selective Simulation Routing

BP classifies actions at the Gate and routes accordingly:

| Risk Class | Actions | Pipeline Path |
|---|---|---|
| **Read-only** | File read, search, LSP query, plan navigation | Gate → Execute (skip simulation) |
| **Side effects** | File write, bash command, file creation/deletion | Gate → Simulate → 5a symbolic gate → Execute |
| **High ambiguity** | Network calls, payment, system config, destructive ops | Gate → Simulate → 5a + 5b neural scorer → Execute |

**Risk tags:** `workspace`, `crosses_boundary`, `inbound`, `outbound`, `irreversible`, `external_audience`. Empty/unknown → simulate+judge. Workspace-only → execute directly.

**`<think>` as lightweight simulation:** The model's `<think>` block is itself a first prediction layer. If thinking already predicts a violation, the Gate blocks without invoking the Dreamer.

## Handler Granularity Guide

Each pipeline step maps to one `useFeedback` handler. Handlers are async (fire-and-forget). The handler's `trigger()` after `await` starts a NEW super-step:

| Handler | Listens for | Produces | Async work |
|---------|-------------|----------|------------|
| Context assembly | `context_assembly` | `invoke_inference` (via contributors) | Reads from hypergraph memory |
| Inference | `invoke_inference` | `model_response` | `Model.reason()` streaming |
| Response parser | `model_response` | `context_ready` × N or `message` | Parses tool calls |
| Gate | `context_ready` | `gate_approved` / `gate_rejected` | Constitution predicate evaluation |
| Simulate | `simulate_request` | `simulation_result` | `Model.reason()` with State Transition Prompt |
| Evaluate | `simulation_result` | `eval_approved` / `eval_rejected` | 5a: sync regex, 5b: async Model scoring |
| Execute | `execute` | `tool_result` | `Bun.spawn()` sandboxed subprocess |

**Pipeline pass-through:** Events always flow through the full simulate → evaluate → execute pipeline. When a seam is absent, the handler passes through via optional chaining — no conditional routing.

## ACP Interface (AgentNode)

The agent exposes an `AgentNode` — `{ trigger, subscribe, snapshot, destroy }` — as its external API.

| Mode | Transport | Use Case |
|---|---|---|
| **WebSocket** | Browser ↔ Server | Control UI (generative UI via controller protocol) |
| **IPC** | `Bun.spawn({ ipc: true })` | Orchestrator ↔ Project subprocess |
| **stdin/stdout** | JSONL stream | Trial runner, CI pipelines |

All modes use the same `AgentNode` API — the transport adapter translates between the protocol and `trigger()`/`subscribe()`.

## Stable Boundary

The stable boundary this skill owns is:

- loop phases and event flow
- handler granularity
- gate / simulate / evaluate / execute routing
- batch and per-call coordination
- external `AgentNode` interface
- loop-level anti-patterns and invariants

It does not need to be the source of truth for every proactive policy,
sub-agent tactic, or autonomy experiment.

## Anti-Patterns

1. **Shared mutable state for simulation guards** — Use per-call `sim_guard_{id}` threads instead. See Pattern 3.
2. **Zero-length batchCompletion** — Immediately requests `invoke_inference`, creating a re-entry loop. Only create when `toolCalls.length > 0`.
3. **`trigger()` before `bThreads.set()`** — New threads miss synchronously-processed events. Always set threads first.
4. **Retrying blocked actions** — Blocked actions mean a bThread prohibits them. Re-plan, don't retry.
5. **Conditional pipeline routing** — Don't `if/else` around simulate/evaluate. Use pass-through with optional chaining.
6. **Infinite `request` loop** — Never combine `repeat: true` with continuous `request` (stack overflow).

## Related Skills

- **behavioral-core** — BP algorithm, bThread/bSync patterns, event selection mechanics
- **plaited-ui** — Server-driven UI with controller protocol (render/attrs/update_behavioral)
- **node-auth** — Authentication for server nodes (WebAuthn, JWT, OIDC)
- **varlock** — `.env.schema` patterns for sensors and notification channels that need API keys
- **code-patterns** — Utility function genome (coding conventions)
