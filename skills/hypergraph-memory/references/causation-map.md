# EVENT_CAUSATION Relationships

How causal provenance is derived from the hypergraph decision sequence.

## Provenance Query

The `provenance` query (`hypergraph provenance --session <path>`) derives causal edges from decision sequences entirely in TypeScript (no WASM). It uses three signals to infer causation between events.

## Three Causation Signals

### 1. Thread Continuity

Same thread active across consecutive decisions implies causal flow. If thread `taskGate` is in decision 5 and decision 6, decision 5's selected event causally leads to decision 6.

```
decision/5: thread taskGate → selected event "task"
decision/6: thread taskGate → waitFor "message"
  ⟹ CAUSED_BY edge: decision/6 → decision/5 (via taskGate continuity)
```

### 2. Block→Unblock Transitions

When a thread was blocking an event and the block is later lifted (thread advances past the blocking sync point), the unblocking decision is causally connected to the previously blocked decisions.

```
decision/3: event "execute" blockedBy "sim_guard_tc-1"
decision/7: thread "sim_guard_tc-1" interrupted by "simulation_result"
decision/8: event "execute" selected (no longer blocked)
  ⟹ UNBLOCKED_BY edge: decision/8 → decision/7 (sim_guard lifted)
  ⟹ BLOCKED edge: decision/3 → decision/3.sim_guard_tc-1 (was blocked)
```

### 3. Event Chain Causation

The agent loop's `EVENT_CAUSATION` map defines structural causation between event types. These are inherent to the agent loop architecture:

| Cause Event | Effect Event | Relationship |
|---|---|---|
| `task` | `context_assembly` | Task starts context assembly |
| `context_assembly` | `context_segment` | Assembly triggers contributor queries |
| `context_segment` (all) | `invoke_inference` | All segments → inference gate opens |
| `invoke_inference` | `model_response` | Inference produces response |
| `model_response` | `context_ready` | Response parsed into tool calls |
| `context_ready` | `simulate` / `execute` | Tool calls dispatched based on risk |
| `simulate` | `simulation_result` | Simulation produces prediction |
| `simulation_result` | `evaluate` | Result evaluated against threshold |
| `evaluate` | `execute` / `gate_rejected` | Evaluation passes or rejects |
| `execute` | `tool_result` | Tool execution produces result |
| `tool_result` | `commit_snapshot` | Side-effect tool triggers commit |
| `tool_result` (all) | `context_assembly` | Batch complete → re-assemble context |
| `message` | `consolidate` | Session end triggers consolidation |

### Derived Edge Types

The provenance query produces these edge types:

| Edge Type | Source Signal | Meaning |
|---|---|---|
| `CAUSED_BY` | Thread continuity | Sequential causation within a thread |
| `BLOCKED` | Block presence | Event was prevented by a thread |
| `UNBLOCKED_BY` | Block→unblock transition | Blocking was lifted by this decision |
| `EVENT_CHAIN` | EVENT_CAUSATION map | Structural causation from agent loop architecture |

## Usage

```bash
# Derive causal provenance edges from a session
./tools/hypergraph provenance \
  --session .memory/sessions/sess_abc

# Output: JSON-LD edges with source/target decision @ids
# [
#   { "source": "decision/5", "target": "decision/6", "type": "CAUSED_BY", "via": "taskGate" },
#   { "source": "decision/3", "target": "decision/7", "type": "UNBLOCKED_BY", "via": "sim_guard_tc-1" },
#   ...
# ]
```

## TS Utilities

The provenance derivation is implemented in `hypergraph.utils.ts`:

- `deriveProvenanceEdges(decisions)` — produces the causal edge array from a sequence of decision documents
- `buildSessionSummary(decisions)` — aggregates decision metadata into `meta.jsonld` format (thread types, outcome events, decision count, tools used)

Both are pure functions over JSON-LD decision arrays — no file I/O, no WASM dependency.
