# Recall Patterns — Query Selection Guide

Detailed reference for each of the 7 hypergraph query types. Every query takes `path` (directory containing `.jsonld` files, typically `.memory`) and a `query` discriminator.

## URI Patterns

Vertices and hyperedges use `@id` URIs:

| Entity | URI Pattern | Example |
|---|---|---|
| Session | `session/{sessionId}` | `session/s-abc123` |
| Decision | `session/{sessionId}/decision/{N}` | `session/s-abc123/decision/5` |
| BP Thread | `bp:thread/{threadName}` | `bp:thread/taskGate` |
| BP Event | `bp:event/{eventType}` | `bp:event/model_response` |
| Tool | `tool:{toolName}` | `tool:edit_file` |
| Skill | `skill:{skillName}` | `skill:behavioral-core` |
| Rule | `rule:{ruleName}` | `rule:noEtcWrites` |

These URIs appear in query inputs (`from`, `to`, `vertex`, `startVertices`) and outputs (`chain`, `hyperedges[].id`, `vertices[].id`, `edges[].from/to`).

---

## 1. Causal Chain

**Purpose:** Find the path of decisions connecting two vertices.

**When to use:** You know a starting point and an ending point, and want to understand HOW the system got from A to B.

### Input

```json
{
  "path": ".memory",
  "query": "causal-chain",
  "from": "session/s1/decision/5",
  "to": "session/s1/decision/20"
}
```

### Output

```json
{
  "chain": [
    "session/s1/decision/5",
    "session/s1/decision/8",
    "session/s1/decision/12",
    "session/s1/decision/20"
  ]
}
```

The `chain` is an ordered list of hyperedge `@id` URIs forming the shortest path. Each entry is a decision document. Read the chain to understand the sequence of actions that connected the two points.

### Interpretation

- **Short chain (2-3 hops):** Direct causal relationship — one decision led quickly to the other
- **Long chain (5+ hops):** Indirect relationship — many intermediate steps, possibly through different threads
- **Empty chain:** No path exists — the two vertices are in disconnected subgraphs

### Example Scenario

> Gate rejected `bash: deploy` at decision/20. Earlier, `bash: deploy` succeeded at decision/5.

Search causal-chain from decision/5 to decision/20 to see what changed. The intermediate decisions might show a safety rule being added (decision/12) that now blocks the deploy.

---

## 2. Co-Occurrence

**Purpose:** Find all hyperedges (decisions) that contain a specific vertex.

**When to use:** You want to understand everything related to a particular thread, event, or tool.

### Input

```json
{
  "path": ".memory",
  "query": "co-occurrence",
  "vertex": "bp:thread/taskGate"
}
```

### Output

```json
{
  "hyperedges": [
    {
      "id": "session/s1/decision/1",
      "type": "SelectionDecision",
      "vertices": ["bp:thread/taskGate", "bp:event/task", "tool:bash"]
    },
    {
      "id": "session/s1/decision/15",
      "type": "SelectionDecision",
      "vertices": ["bp:thread/taskGate", "bp:event/message", "bp:thread/batchCompletion"]
    }
  ]
}
```

### Interpretation

- **Many hyperedges:** This vertex is central — it participates in many decisions
- **Shared vertices across hyperedges:** Other threads/events that consistently appear alongside the queried vertex
- **Type patterns:** If most hyperedges are `SelectionDecision`, this vertex is active in BP selections

### Example Scenario

> User says "continue the refactoring we started earlier."

The warm layer summary mentions `taskGate` and `edit_file`. Search co-occurrence for `bp:thread/taskGate` to find all decisions in the task lifecycle, then for `tool:edit_file` to see which files were modified.

---

## 3. Similar

**Purpose:** Semantic search over decision embeddings.

**When to use:** Vague references ("same error as before", "like that time we...") where you don't have an exact vertex URI.

**Requires:** Indexer model to generate the query embedding.

### Input

```json
{
  "path": ".memory",
  "query": "similar",
  "embedding": [0.12, -0.34, 0.56, ...],
  "topK": 5
}
```

The embedding is a Float32 vector matching the dimension of stored embeddings.

### Output

```json
{
  "results": [
    { "id": "session/s1/decision/8", "score": 0.92 },
    { "id": "session/s2/decision/3", "score": 0.85 },
    { "id": "session/s1/decision/14", "score": 0.71 }
  ]
}
```

### Interpretation

- **score > 0.9:** Very similar context — likely the same problem or pattern
- **score 0.7-0.9:** Related context — similar domain or approach
- **score < 0.7:** Loosely related — shared vocabulary but different problems
- **Cross-session matches:** The problem recurred in a different session

### Example Scenario

> User says "I'm getting the same TypeScript error as before."

Generate an embedding for "TypeScript compilation error" + the error message. Search `similar` to find past decisions where a similar error was encountered. The highest-scoring result likely contains the fix that worked.

---

## 4. Reachability

**Purpose:** BFS traversal from start vertices, optionally filtered by vertex/hyperedge types.

**When to use:** You want to know what's "downstream" or "connected" from a set of decisions, within a bounded depth.

### Input

```json
{
  "path": ".memory",
  "query": "reachability",
  "startVertices": ["session/s1/decision/1"],
  "vertexTypeFilter": ["bp:thread"],
  "hyperedgeTypeFilter": ["SelectionDecision"],
  "maxDepth": 5
}
```

All filter fields are optional. Omitting filters traverses all types.

### Output

```json
{
  "vertices": [
    { "id": "bp:thread/taskGate", "type": "bp:thread", "depth": 1 },
    { "id": "bp:thread/batchCompletion", "type": "bp:thread", "depth": 2 },
    { "id": "bp:thread/maxIterations", "type": "bp:thread", "depth": 3 }
  ]
}
```

### Interpretation

- **depth 1:** Directly connected to the start vertex (same hyperedge)
- **depth 2+:** Connected through intermediate hyperedges
- **Type filters narrow the view:** `vertexTypeFilter: ["bp:thread"]` shows only BP threads reachable from the start
- **maxDepth controls scope:** Small depth (2-3) for local neighborhood, large (10+) for full reachability

### Example Scenario

> The model wants to know which BP threads were affected by a particular decision.

Start from the decision vertex, filter to `bp:thread` vertex types, depth 3. This shows all threads that participated in decisions connected to the starting decision.

---

## 5. Match

**Purpose:** Find sequences of consecutive hyperedges whose `@type` values match a pattern.

**When to use:** Looking for recurring workflow patterns — "gate approved, then executed, then got a result."

### Input

```json
{
  "path": ".memory",
  "query": "match",
  "pattern": {
    "sequence": ["GateApproval", "ToolExecution", "ToolResult"]
  }
}
```

### Output

```json
{
  "matches": [
    [
      { "id": "session/s1/decision/5", "type": "GateApproval", "vertices": [...] },
      { "id": "session/s1/decision/6", "type": "ToolExecution", "vertices": [...] },
      { "id": "session/s1/decision/7", "type": "ToolResult", "vertices": [...] }
    ],
    [
      { "id": "session/s1/decision/12", "type": "GateApproval", "vertices": [...] },
      { "id": "session/s1/decision/13", "type": "ToolExecution", "vertices": [...] },
      { "id": "session/s1/decision/14", "type": "ToolResult", "vertices": [...] }
    ]
  ]
}
```

### Interpretation

- **Multiple matches:** The pattern recurs — indicates a stable workflow
- **No matches:** This sequence hasn't occurred — either the pattern is wrong or the workflow is novel
- **Partial matches (via shorter sequences):** Try a subsequence if the full pattern doesn't match

### Example Scenario

> The model wants to know how many times a tool was approved and executed successfully.

Match the pattern `["GateApproval", "ToolExecution", "ToolResult"]` to find all complete approve-execute-result cycles. Each match is a successful tool invocation.

---

## 6. Check Cycles

**Purpose:** Detect circular dependencies in the directed graph (blockedBy/requires edges).

**When to use:** Debugging deadlocks or circular skill/thread dependencies.

### Input

```json
{
  "path": ".memory",
  "query": "check-cycles"
}
```

### Output

```json
{
  "cycles": [
    ["bp:thread/A", "bp:thread/B", "bp:thread/C", "bp:thread/A"]
  ]
}
```

### Interpretation

- **Empty cycles array:** No circular dependencies — directed graph is a DAG
- **Non-empty:** Each cycle lists vertex URIs forming a loop. The last element equals the first (cycle closed)
- **Thread cycles:** Mutual blocking — thread A blocks thread B which blocks thread A
- **Skill cycles:** Circular `requires` dependencies

### Example Scenario

> Two BP threads are deadlocked — neither can advance.

Run `check-cycles` to detect if threads have mutual `blockedBy` relationships forming a cycle.

---

## 7. Provenance

**Purpose:** Derive the full causal lineage of all decisions.

**When to use:** Building a complete picture of how decisions relate to each other. More comprehensive than `causal-chain` (which connects two specific vertices).

### Input

```json
{
  "path": ".memory",
  "query": "provenance"
}
```

### Output

```json
{
  "edges": [
    {
      "from": "session/s1/decision/1",
      "to": "session/s1/decision/2",
      "kind": "thread_continuity",
      "via": "bp:thread/taskGate"
    },
    {
      "from": "session/s1/decision/2",
      "to": "session/s1/decision/3",
      "kind": "event_chain",
      "via": "bp:event/model_response"
    },
    {
      "from": "session/s1/decision/4",
      "to": "session/s1/decision/5",
      "kind": "block_unblock",
      "via": "bp:thread/sim_guard_tc-1"
    }
  ]
}
```

### Edge Kinds

| Kind | Meaning |
|---|---|
| `thread_continuity` | Same thread advanced between decisions |
| `block_unblock` | A blocking thread released — enabling the blocked event |
| `event_chain` | An event in one decision triggered a follow-up in another |

### Interpretation

- **thread_continuity edges** show a thread's progression through its bSync rules
- **block_unblock edges** reveal safety constraints — where the gate held and then released
- **event_chain edges** show async handler → trigger sequences

### Example Scenario

> The model wants a full picture of the session's decision graph before starting a new task.

Run `provenance` to get all edges, then identify clusters (subgraphs) of related decisions. Each cluster is likely a distinct task or workflow phase.

---

## Query Composition

Chain queries for deeper understanding:

### Co-occurrence → Causal Chain

1. `co-occurrence` for a vertex → find related decisions
2. Pick two interesting decisions from the results
3. `causal-chain` between them → understand HOW they're related

### Reachability → Match

1. `reachability` from a start point → discover the neighborhood
2. Note the `@type` values of reachable vertices
3. `match` with a type sequence → find recurring patterns in that neighborhood

### Provenance → Similar

1. `provenance` → get the full decision graph
2. Identify a cluster of related decisions
3. `similar` with an embedding of the cluster's context → find analogous clusters in other sessions

### Match → Co-occurrence

1. `match` for a workflow pattern → find all instances
2. For each match, `co-occurrence` on shared vertices → discover what else was involved
