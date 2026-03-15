# Context Triggers — When to Search

Signals in the conversation, system state, or warm layer that should trigger a hypergraph search. Each trigger includes what to look for, which query to use, and what NOT to do.

## Conversational Cues

These phrases from the user signal that context beyond the hot layer is needed:

| Cue | What it means | Recommended query |
|---|---|---|
| "continue", "pick up where we left off" | Resume prior work | `co-occurrence` on the referenced thread/tool |
| "earlier", "before", "we discussed" | References past decisions | `co-occurrence` or `causal-chain` depending on specificity |
| "like last time", "same as before" | Pattern repetition | `similar` (semantic match to prior context) |
| "what happened with", "what did we decide" | Decision recall | `co-occurrence` for the referenced entity |
| "why did it", "how did we end up" | Causal understanding | `causal-chain` between known decision points |
| "is there a cycle", "deadlock", "stuck" | Dependency issues | `check-cycles` |

### How to respond to conversational cues

1. **Identify the referenced entity** — What thread, tool, event, or concept is the user pointing to?
2. **Check the warm layer** — Does `meta.jsonld` mention this entity? Get the URI pattern.
3. **Search** — Use the appropriate query from the table above.
4. **Synthesize** — Combine search results with hot layer context to answer the user.

### Example

User: "Continue the server refactoring we started earlier."

1. Entity: server refactoring → likely involves `tool:edit_file` and files under `src/server/`
2. Warm layer: `meta.jsonld` shows `threadTypes: ["taskGate", "batchCompletion"]`, `toolsUsed: ["edit_file", "bash"]`
3. Search: `co-occurrence` for `tool:edit_file` → find all decisions involving file edits
4. Synthesize: Results show which files were edited and in what order → resume from the last edit

---

## System Signals

These signals come from the agent loop itself, not from the user:

### Gate Rejection

**Signal:** A gate rejects an action the model proposed.

**Why search:** The model's expectation didn't match the system's constraints. Prior decisions may show why the constraint exists or when a similar action succeeded.

**Query:** `causal-chain` from the last known approval of this action type to the current rejection. If no prior approval exists, `co-occurrence` for the gate thread.

### Unknown File Reference

**Signal:** A tool result references a file the model hasn't seen in the hot layer.

**Why search:** The file may have been created or modified in a prior session. The hypergraph records which decisions touched which files.

**Query:** `co-occurrence` for the file path (if it appears as a vertex) or `similar` with the file's context.

### Tool Failure

**Signal:** A tool returns an error the model didn't anticipate.

**Why search:** A similar error may have occurred before. The prior resolution is stored in the decision graph.

**Query:** `similar` with an embedding of the error message to find past decisions with similar failure context.

### Prior Rejection in Context

**Signal:** The `rejectionContributor` (priority 80) includes rejections in the system prompt.

**Why search:** Rejections in context are recent. But the model may need OLDER rejection context — past sessions where similar rejections occurred and how they were resolved.

**Query:** `match` with a pattern like `["GateRejection", "GateApproval"]` to find prior rejection → resolution sequences.

---

## Warm Layer Signals

The warm layer (`meta.jsonld` session summary) provides orientation. These patterns in the summary should trigger deeper search:

### Thread Types Worth Investigating

If the warm layer lists thread types the model wants to understand:

```json
{
  "threadTypes": ["taskGate", "batchCompletion", "sim_guard_tc-1"]
}
```

- **`taskGate`** — Task lifecycle. Search `co-occurrence` to see task boundaries.
- **`batchCompletion`** — Parallel tool execution. Search to see which tools ran in batch.
- **`sim_guard_*`** — Simulation guards. Search to see which actions were simulated before execution.

**Query:** `co-occurrence` for `bp:thread/{threadType}`.

### Outcome Events

If the warm layer shows outcome events the model wants to trace:

```json
{
  "outcomeEvents": ["message", "tool_result"]
}
```

**Query:** `co-occurrence` for `bp:event/{eventType}` to find all decisions that produced these outcomes.

### High Decision Count

If `decisionCount` is high (20+), the session had substantial history. The warm layer summary alone won't capture all relevant context.

**Action:** Use `provenance` to get the full decision graph, then focus searches on the relevant subgraph.

### Cross-Session References

If the model detects that the current task relates to work from a different session (different `@id` prefix in `meta.jsonld`):

**Query:** `similar` with the current task's context to find relevant decisions in other sessions.

---

## Plan-Dependent Triggers

When the model has an active plan (from the `planContributor`) whose steps depend on earlier work:

### Step References Prior Work

A plan step says "build on the auth middleware refactoring" — the model should search for decisions related to auth middleware before executing this step.

**Query:** `co-occurrence` for relevant tool/thread vertices.

### Step Depends on Unknown State

A plan step requires understanding the current state of a subsystem the model hasn't recently seen.

**Query:** `reachability` from the subsystem's known vertices to discover what's connected.

---

## When NOT to Search

Search has a cost — it consumes tokens and time. Do not search when:

| Situation | Why no search needed |
|---|---|
| Self-contained request ("read main.ts") | No prior context needed |
| All context in hot layer | Recent messages cover it |
| User provides full context | No missing information |
| Simple tool invocation | Read, list, write to a specified path |
| First turn of a new session with no prior sessions | No history to search |

The grader penalizes over-searching. A model that searches on every turn is as wrong as one that never searches. The skill is knowing WHEN context is missing, not just how to find it.
