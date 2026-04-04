# Memory Factories

## Goal

Research the default memory factory bundle for the Plaited agent.

This lane should define a `MemoryManager`-style factory stack built on the
current `behavioral()` snapshot stream, signal surfaces, and git-backed
workspace state.

The target is a multi-tier memory system with three time scales:

- working memory
- episodic memory
- durable memory

The point is to prevent context rot and compaction failure during long-running
coding tasks without widening the core agent engine.

## Why This Lane Exists

The current minimal core already provides the key low-level ingredients:

- `useSnapshot` for deterministic runtime observation
- signals and computed state for shared intra-agent state
- built-in file and execution primitives
- a git-backed workspace as the durable source of truth

What is still missing is the memory policy layer that decides:

- what raw runtime state should remain in the active prompt
- what should be summarized into working observations
- what should be consolidated into episodic summaries
- what should be persisted durably to disk and tied to git history
- how old context should be recalled without stuffing it back into the live
  prompt wholesale

This is research work for a focused default factory family, not a reason to
widen [src/agent/create-agent.ts](../../src/agent/create-agent.ts).

## Dependency Order

1. [src/agent/create-agent.ts](../../src/agent/create-agent.ts) defines the minimal core boundary
2. [src/agent/agent.types.ts](../../src/agent/agent.types.ts) defines the factory, signal, and snapshot seams
3. [src/behavioral/behavioral.schemas.ts](../../src/behavioral/behavioral.schemas.ts) defines the current `SnapshotMessage`
   surface
4. [dev-research/default-factories/program.md](../default-factories/program.md) defines the umbrella bundle
   question
5. [skills/behavioral-core/SKILL.md](../../skills/behavioral-core/SKILL.md) defines the BP coordination substrate
6. [skills/code-patterns/SKILL.md](../../skills/code-patterns/SKILL.md) defines preferred utility and state-shaping
   patterns
7. [skills/typescript-lsp/SKILL.md](../../skills/typescript-lsp/SKILL.md) should be used for type-aware seam analysis
8. [dev-research/node-home-factories/program.md](../node-home-factories/program.md) should define the durable
   node-home contract that durable memory writes participate in
9. this lane hill-climbs the memory slice and feeds its winning candidates back
   into the default-factories umbrella

## Core Hypothesis

The best default memory system for Plaited will not come from one giant
"compress the whole conversation" step.

Instead, memory should flow one way through bounded layers:

- snapshots
- observations
- reflections
- durable memory

Each step should reduce entropy and increase reuse:

- snapshots are raw and high-frequency
- observations are compact, recent, and prompt-friendly
- reflections are structured episodic summaries
- durable memory is git-linked and queryable through a lightweight index

This lane should preserve a fixed-size active reasoning window while moving
older state into increasingly durable and searchable forms.

## Product Target

The first shipped memory factory should support this end-to-end flow:

1. subscribe to `useSnapshot`
2. collect raw runtime snapshots as the source observation stream
3. trigger an observation cycle when the active snapshot buffer exceeds a
   threshold
4. summarize that raw buffer into compact working-memory "signal blocks"
5. keep only a small recent raw window plus a bounded observation stack in the
   active prompt
6. periodically consolidate multiple observations into episodic reflection
   records
7. persist those reflection records as append-only `jsonl` under a hidden
   repo-local memory directory
8. maintain a lightweight SQLite index over those durable artifacts for fast
   recall
8. tie durable memory to git history so code version and memory version move
   together
9. support recall of older reflected memory by query instead of prompt bloat

## Memory Layers

### 1. Observer / Working Memory

The Observer should be implemented as a snapshot subscriber, not a separate
chat listener.

Input:

- `useSnapshot`

Responsibilities:

- monitor the live `SnapshotMessage` stream
- maintain a bounded recent raw snapshot log
- estimate when the active raw buffer has become too large
- trigger observation cycles
- convert many low-level runtime moments into a smaller set of prompt-ready
  observations

The output of this layer should be a stack of compact "signal blocks", for
example:

- failed execution attempts
- repeated blocked states
- important state transitions
- validated progress against a task
- unresolved failures that still constrain the next step

These observations should be prepended or otherwise projected into context in a
stable order that maximizes prompt-cache reuse.

### 2. Reflector / Episodic Memory

The Reflector should periodically consolidate the observation stack into
higher-level episode summaries.

Responsibilities:

- group related observations into bounded episodes
- extract durable technical conclusions
- preserve enough structure to support later recall
- reduce repeated working-memory noise

The output of this layer should be structured episodic records, written as
append-only `jsonl`.

Example episodic content:

- task attempted
- files involved
- tools used
- failures encountered
- decisions made
- outstanding unresolved constraints

This layer should act as the bridge between prompt-friendly working memory and
durable searchable memory.

### 3. Durable Memory / Git-Linked Repository

Durable memory should act like the project's long-term memory store.

Responsibilities:

- persist reflected episode records to disk
- maintain a lightweight SQLite recall index over those records
- keep those records under git
- associate durable memory with code version and workspace state
- make prior reflected memory queryable for future context assembly

The initial storage target should be a hidden repo-local directory such as:

- `.plaited/memory/`

The initial storage model should be:

- `jsonl` as the canonical durable artifact format
- SQLite as a lightweight rebuildable index for recall

That means the system should prefer:

- append-only durable files that are easy to inspect and diff
- a cheap indexed query layer for relevance-based recall

If the SQLite index is lost or stale, it should be rebuildable from the stored
`jsonl` artifacts.

This lane should assume:

- git is the versioning and provenance layer
- checking out older commits/branches should also change which durable memory
  records are present
- durable memory should stay file-based and reviewable by default

## Context Assembly Target

This lane should modify the context-assembly story for long-running work so the
active window stays bounded.

The intended context mix is:

1. a very small recent raw snapshot window for immediate continuity
2. an observation stack representing the last several turns of processed signal
3. relevant episodic reflections recalled from durable storage
4. durable project state such as:
   - current commit
   - branch/worktree identity
   - workspace capabilities
   - current factory bundle assumptions

The key principle is:

- recall old context by query and projection
- do not keep re-summarizing the entire history in-place

## Required Architectural Properties

### 1. Snapshot-First, Not Transcript-First

This lane should treat `SnapshotMessage` as the canonical runtime memory input.

That means:

- memory is derived from behavioral/runtime state
- not only from user-visible chat text

This is important because snapshots preserve deterministic tool and state
transitions that ordinary transcript compaction often destroys.

### 2. Signals Hold Shared Memory State

The factory should use signals for active memory state such as:

- current raw snapshot buffer
- current observation stack
- reflection queue
- durable-memory write queue
- recall results used for the next context assembly

This keeps memory state explicit and observable inside the current factory
contract.

### 3. One-Way Offloading

Information should move one way:

- snapshots -> observations -> reflections -> durable records

This lane should avoid designs that repeatedly re-compact the full active
history, because that is where context rot accumulates.

### 4. File-Based Durable Memory First

Durable memory should be:

- file-based
- reviewable
- git-versioned
- queryable through a lightweight index

Do not start with a hidden opaque service dependency when repo-local files plus
a small local SQLite index are enough for the first shipped system.

### 5. Recall By Relevance, Not By Dump

The memory factory should support relevance-based retrieval of reflected
episodes rather than re-injecting all prior memory into the prompt.

This lane should determine:

- what metadata is needed for recall
- how to query the lightweight index
- how recalled rows map back to canonical durable artifacts
- how to project recalled records back into the live context

## Candidate Data Surfaces

This lane should define concrete data shapes for at least:

- raw snapshot buffer state
- observation block
- episode reflection
- durable memory record
- recall query
- recall result
- context projection fragment

These are plain runtime data surfaces and should likely be schema-first.

The live factory and signal objects should remain type-first.

## Candidate Factory Hypotheses

### 1. Observer First

A bundle where the first practical value comes from turning noisy snapshot logs
into bounded observation blocks.

Hypothesis:

- most context-rot problems are improved before durable storage even exists

### 2. Reflection First

A bundle where the critical missing piece is periodic episodic consolidation.

Hypothesis:

- observations alone are still too local for marathon tasks

### 3. Git-Linked Durable Memory First

A bundle where the main value is explicit durable `jsonl` memory tied to git
plus a lightweight SQLite recall index.

Hypothesis:

- the most important missing feature is version-aligned long-term recall

### 4. Recall-Gated Context First

A bundle where the main win is not more memory writing but better memory
selection during context assembly.

Hypothesis:

- context quality depends more on selective recall than on retention volume

## Research Questions

This lane should answer questions such as:

- what token threshold should trigger observation cycles?
- what should count as an observation unit?
- how many observations should be consolidated into an episode?
- what `jsonl` record shape is sufficient for episodic and durable memory?
- what should be indexed in SQLite versus left only in the durable artifacts?
- what should be written immediately versus batched?
- when should durable records be committed to git?
- what recall query model is sufficient for useful long-range memory?
- how should recalled memory be mixed with live context without reintroducing
  prompt bloat?

## Evaluation Questions

Candidate memory bundles should be judged on:

- does the design keep [src/agent](../../src/agent) minimal?
- does it reduce prompt growth during long-running tasks?
- does it preserve critical technical detail better than naive compaction?
- does it keep the active reasoning window stable?
- are durable records reviewable and tied credibly to git history?
- can the agent recover old decisions without scanning the whole prior prompt?
- is the resulting memory behavior understandable enough to ship by default?

## Deliverables

This lane should produce:

- one or more candidate memory factory bundles
- schemas and storage shapes for observation/reflection/durable layers
- context-assembly experiments using recalled durable memory
- tests or evals for long-running-task resilience
- a recommendation for whether and how memory should be included in the default
  shipped bundle

## Negative Goal

This lane should not:

- widen [src/agent/create-agent.ts](../../src/agent/create-agent.ts) into a memory runtime
- depend on one-shot whole-history compaction as the main mechanism
- treat durable memory as an opaque database first
- confuse working-memory state with durable project memory
- rely on user-visible transcript text alone when snapshot data is richer
