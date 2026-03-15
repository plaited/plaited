# Hypergraph Memory Architecture

> **Status: ACTIVE** — Authoritative memory architecture. Implementation details in `skills/hypergraph-memory/`. Cross-references: `AGENT-LOOP.md` (context assembly), `CONSTITUTION.md` (dual representation), `TRAINING.md` (training data source).

## Summary

Replace the SQLite event log + FTS5 index with a **git-versioned hypergraph** persisted as JSON-LD files. The agent's memory becomes files in a git repository — queryable via bash/grep (text), an in-memory TS runtime (structural), and graph algorithms compiled to WebAssembly via AssemblyScript (BFS, DFS, cosine similarity, pattern matching). Embeddings are stored inline as properties on JSON-LD documents, not in a separate vector store.

The core insight: BP snapshots are already a hypergraph — each `SelectionBid[]` is a hyperedge connecting multiple threads, events, and decisions. JSON-LD preserves this structure on disk. Git provides versioning, branching (concurrent agents), and archival.

## Why JSON-LD over SQLite

| Concern | SQLite | JSON-LD in Git |
|---|---|---|
| **Structure preservation** | Flat rows lose multi-party decision structure | Hyperedges naturally connect threads, events, decisions |
| **Queryability** | SQL (requires database process) | Grep (text), TS runtime (structural), WASM (graph algorithms) |
| **Versioning** | Append-only log, separate backup | Git history, branching, `git diff` on decisions |
| **Tooling** | Database client required | `cat`, `grep`, `jq` — standard unix tools |
| **Training data** | SQL extraction queries | File reads + structural traversal |
| **Concurrent agents** | Lock contention | Git worktrees — isolated branches, standard merge |
| **Archival** | Export + compress | `git archive` — object packing handles compression |
| **Linked data** | Foreign keys, JOINs | `@id` URIs — same identity across documents |

**What we lose:** Indexed queries, transactions, ACID guarantees. Acceptable because the agent's memory is single-writer (one agent per worktree) and the query patterns are traversal-oriented (follow `@id` links), not aggregation-oriented.

## Why Git-Versioned

1. **Code + reasoning together** — commits bundle code changes with the decision `.jsonld` files that produced them. Each commit is a labeled `(reasoning, code_change)` training pair.
2. **Concurrent agents** — orchestrator creates git worktrees for sub-agents. Each writes to an isolated branch. Results merge through standard git operations.
3. **Rebuild guarantee** — JSON-LD files ARE the source of truth. If the in-memory index is lost, reload from files. If files are corrupted, recover from git history.
4. **Archival is native** — `git archive` moves old sessions out of the working tree. Full history preserved in git's object store.
5. **Diffable reasoning** — when the agent retries after a failed test, `git diff` shows both the code delta and the reasoning delta between attempts.

## Architecture Overview

Two-layer hypergraph:

- **Design-time vertices** — from source code: branded objects (`🪢`, `🏛️`, `🎛️`, `🎨`) discovered by `collect_metadata`, enriched by LSP. Represent what the agent *can* do.
- **Runtime hyperedges** — from `useSnapshot`: each BP decision connects participating threads, candidate events, blocking relationships, and session context. Represent what the agent *has done*.

The `@id` URIs link the two layers — `bp:thread/taskGate` in a runtime decision references the same identity as the design-time definition.

### Three Query Layers

| Layer | Tool | Coverage |
|---|---|---|
| Text (80% case) | `grep -rl`, `git log`, `cat` | Quick lookups, version history |
| Structural | `hypergraph` CLI (compiled Bun) | Causal chains, co-occurrence, cycles, similarity |
| Graph algorithms | WASM via AssemblyScript | BFS, DFS, cosine similarity, pattern matching, filtered reachability |

### Two Memory Levels

| Level | Location | Contains |
|---|---|---|
| Module | `modules/{name}/.memory/` | Decisions about this module's code. Travels with the module. |
| Node | `node/.memory/` | Session coordination, cross-module decisions, constitution, goals. |

### What Does NOT Change

- **`.meta.db` sidecar** — per-module SQLite, committed to git, populated by `collect_metadata`. Remains the design-time branded-object index.
- **`.workspace.db`** — ephemeral cross-module view via ATTACH. Rebuilt from sidecars.
- **`collect_metadata` tool** — scans `$` brand identifiers, upserts sidecar.
- **Module architecture** — module-per-repo, Bun workspace, MSS tags.
- **Constitution** — governance factories, MAC/DAC, `protectGovernance` bThread.
- **Training flywheel** — JSON-LD files replace SQLite as source; mechanics unchanged.

## Implementation Details

See **`skills/hypergraph-memory/`** for:
- JSON-LD vertex taxonomy (`@context`, `@id`, `@type` patterns)
- Complete vertex schemas (Decision, Session, Commit, Skill, RuleSet, Thread)
- Session lifecycle (commit_snapshot → consolidate → defrag with bThread coordination)
- Commit vertex one-behind pattern
- Context assembly as BP event with contributor handlers
- EVENT_CAUSATION relationships and provenance derivation
- Training data extraction patterns
- File structure (module-level and node-level `.memory/`)

## Migration Plan

### Phase 1: JSON-LD Schema + Write Path
Define base `@context.jsonld`. Modify `useSnapshot` to emit `decisions/{superstep}.jsonld`. Write `meta.jsonld` on session completion.

### Phase 2: Ingestion Tools
Build markdown → JSON-LD pipelines (`ingest_skill`, `ingest_rules`). Verify round-trip.

### Phase 3: Hypergraph CLI (TS)
Build in-memory loader and query engine. Compile with `bun build --compile --bytecode`.

### Phase 4: Consolidation + Defrag
Build handlers. Wire `sessionClose` and `defragSchedule` bThread coordination.

### Phase 5: Embedding Integration
Add `embedding` to `meta.jsonld`. Implement `similar` command. Brute-force cosine over loaded embeddings.

### Phase 6: WebAssembly Graph Algorithms (Done)
AssemblyScript → WASM. Implements BFS, DFS, cosine similarity, pattern matching, filtered reachability. 83 tests validate all 7 query types.
