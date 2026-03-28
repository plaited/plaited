# EVENT_CAUSATION Relationships

How causal provenance is derived from the hypergraph decision sequence.

## Provenance Query

The `provenance` query derives causal edges from decision sequences entirely in
TypeScript (no WASM). It uses three signals to infer causation between events.

Current CLI shape is JSON-input based, for example:

```bash
plaited search '{"path":".memory/sessions/sess_abc","query":"provenance"}'
```

## Three Causation Signals

### 1. Thread Continuity

Same thread active across consecutive decisions implies causal flow. If thread `taskGate` is in decision 5 and decision 6, decision 5's selected event causally leads to decision 6.

```
decision/5: thread taskGate → selected event "task"
decision/6: thread taskGate → waitFor "message"
  ⟹ thread_continuity edge: decision/5 → decision/6 (via taskGate)
```

### 2. Block→Unblock Transitions

When a thread was blocking an event and the block is later lifted (thread advances past the blocking sync point), the unblocking decision is causally connected to the previously blocked decisions.

```
decision/3: event "execute" blockedBy "sim_guard_tc-1"
decision/7: thread "sim_guard_tc-1" interrupted by "simulation_result"
decision/8: event "execute" selected (no longer blocked)
  ⟹ block_unblock edge: decision/7 → decision/8 (via sim_guard_tc-1)
```

### 3. Event Chain Causation

The agent loop's `EVENT_CAUSATION` map defines structural causation between event types. These are inherent to the agent loop architecture:

| Cause Event | Effect Event | Relationship |
|---|---|---|
| `task` | `context_assembly` | Task starts context assembly |
| `invoke_inference` | `model_response` | Inference produces response |
| `model_response` | `context_ready` | Response parsed into tool calls |
| `context_ready` | `gate_approved` / `gate_rejected` | Gating decides whether work continues |
| `gate_approved` | `simulate_request` / `execute` | Approved work may simulate or execute |
| `simulate_request` | `simulation_result` | Simulation produces prediction |
| `simulation_result` | `eval_approved` / `eval_rejected` | Result evaluated against threshold |
| `eval_approved` | `execute` | Approved evaluation continues to execution |
| `execute` | `tool_result` | Tool execution produces result |
| `tool_result` | `commit_snapshot` | Side-effect tool triggers commit |
| `tool_result` | `invoke_inference` | Tool results can resume the loop directly |
| `gate_rejected` | `invoke_inference` | Rejection returns to the loop |
| `eval_rejected` | `invoke_inference` | Failed simulation returns to the loop |
| `sensor_delta` | `context_assembly` | Proactive sensing re-enters the reactive path |

### Derived Edge Types

The provenance query produces these edge types:

| Edge Type | Source Signal | Meaning |
|---|---|---|
| `thread_continuity` | Thread continuity | Sequential causation within a thread |
| `block_unblock` | Block→unblock transition | Blocking was lifted by this decision |
| `event_chain` | EVENT_CAUSATION map | Structural causation from agent loop architecture |

## Usage

```bash
plaited search '{"path":".memory/sessions/sess_abc","query":"provenance"}'
```

## TS Utilities

The provenance derivation is implemented in `hypergraph.utils.ts`:

- `deriveProvenanceEdges(decisions)` — produces the causal edge array from a sequence of decision documents
- `buildSessionSummary(decisions)` — aggregates decision metadata into `meta.jsonld` format (thread types, outcome events, decision count, tools used)

Both are pure functions over JSON-LD decision arrays — no file I/O, no WASM dependency.
