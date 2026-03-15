---
name: hypergraph-recall
description: Proactive context recall from hypergraph memory. Teaches agents when to search, which query type to use, and how to interpret results. Enables transition from passive warm-layer summaries to model-driven recall via search.
license: ISC
---

# Hypergraph Recall

## Purpose

This skill teaches agents to proactively search their hypergraph memory (`.memory/`) instead of relying on passively received context summaries. The model has a `search` tool with 7 query types. This skill trains the behavior: **recognize when context is missing, choose the right query, act on results.**

**Use this when:**
- The agent needs context beyond the hot layer (recent messages)
- The warm layer summary mentions threads/events worth investigating
- A gate rejects an action and the agent needs to understand prior outcomes
- The user references earlier work, decisions, or patterns

**Two audiences:**
1. **Claude Code (distillation source)** — frontier model learns recall patterns we want distilled models to replicate
2. **Trial runner** — `assets/recall-prompts.jsonl` provides eval cases for grading recall behavior

## Quick Reference

**Core principle: search before acting.** When context beyond the hot layer is needed, search the hypergraph first. The warm layer (session summary in `meta.jsonld`) provides orientation for knowing WHAT to search for.

### Query Selection Matrix

| Situation | Query | Key Input |
|---|---|---|
| "What led to this state?" | `causal-chain` | `from` and `to` vertex URIs |
| "What else touched this?" | `co-occurrence` | `vertex` URI |
| "Have I seen this before?" | `similar` | `embedding` vector + `topK` |
| "What's reachable from here?" | `reachability` | `startVertices` + optional filters |
| "What followed this pattern?" | `match` | `pattern.sequence` of `@type` values |
| "Any circular dependencies?" | `check-cycles` | (no params beyond `path`) |
| "Full decision lineage" | `provenance` | (no params beyond `path`) |

### Decision Flow

```
User message or tool result arrives
  │
  ├─ Context sufficient in hot layer? → Proceed without search
  │
  └─ Context gap detected?
       │
       ├─ Warm layer mentions relevant threads/events
       │    → co-occurrence or causal-chain query
       │
       ├─ Need semantic similarity (vague reference)
       │    → similar query (requires Indexer for embedding)
       │
       ├─ Need to understand decision sequences
       │    → match query with @type pattern
       │
       └─ Need full picture of what depends on what
            → reachability or provenance query
```

## References

### Recall Patterns

**[recall-patterns.md](references/recall-patterns.md)** — Detailed guide for each query type with:
- Exact input format using real `@id` URI patterns
- Output interpretation — what results mean and how to use them
- Query composition — chaining queries for deeper understanding

### Context Triggers

**[context-triggers.md](references/context-triggers.md)** — Signals that should trigger a search:
- Conversational cues ("earlier", "continue", "like last time")
- System signals (gate rejections, unknown file references)
- Warm layer signals (summary mentions unexplored threads)

## Key Patterns

### Pattern 1: Search on Continuation

When the user says "continue the X we started earlier", the model should:

1. Read the warm layer summary for session context
2. Search `co-occurrence` for the referenced thread/tool to find related decisions
3. Use results to reconstruct what was done and what remains

```json
{
  "path": ".memory",
  "query": "co-occurrence",
  "vertex": "bp:thread/taskGate"
}
```

The result shows all decisions where `taskGate` participated — providing the task lifecycle history.

### Pattern 2: Search on Gate Rejection

When a gate rejects an action the model expected to succeed:

1. Search `causal-chain` from the original approval to the current rejection
2. Understand what changed between the two decisions
3. Adjust approach based on what the chain reveals

```json
{
  "path": ".memory",
  "query": "causal-chain",
  "from": "session/s1/decision/5",
  "to": "session/s1/decision/20"
}
```

The chain shows the sequence of decisions connecting approval to rejection.

### Pattern 3: Search for Similar Problems

When the user says "same error as before" or describes a familiar-sounding issue:

1. Generate an embedding of the problem description (requires Indexer model)
2. Search `similar` to find past decisions with similar context
3. Review what was tried before and what worked

```json
{
  "path": ".memory",
  "query": "similar",
  "embedding": [0.12, -0.34, ...],
  "topK": 5
}
```

Results rank past decisions by semantic similarity — highest score = most relevant prior context.

### Pattern 4: Understand Decision Sequences

When the model needs to know what type of workflow preceded the current state:

1. Search `match` with the expected `@type` sequence
2. Find all past instances of that workflow pattern
3. Use them to predict what comes next or what went wrong

```json
{
  "path": ".memory",
  "query": "match",
  "pattern": {
    "sequence": ["GateApproval", "ToolExecution", "ToolResult"]
  }
}
```

Matches return consecutive hyperedges (decisions) whose `@type` values follow the specified sequence.

### Pattern 5: Avoid Over-Searching

**Not every turn needs a search.** Skip recall when:
- The user's request is self-contained ("read main.ts", "list files")
- All needed context is in the hot layer (recent messages)
- The task doesn't reference prior work or decisions

The grader penalizes false-positive searches as much as false-negative misses.

## Grading Criteria

Trial prompts in `assets/recall-prompts.jsonl` evaluate three dimensions:

| Dimension | What it measures | Grading |
|---|---|---|
| **Recall precision** | Searched when needed / total searches | Penalizes unnecessary searches |
| **Recall coverage** | Searched when needed / times needed | Penalizes missed search opportunities |
| **Query selection** | Correct query type for the situation | Penalizes wrong query choice |

## Related Skills

- **[trial-runner](../trial-runner/SKILL.md)** — Run recall prompts as trials
- **[compare-trials](../compare-trials/SKILL.md)** — Statistical analysis of recall behavior across runs
- **[behavioral-core](../behavioral-core/SKILL.md)** — BP patterns that produce the decisions stored in the hypergraph
