---
name: hypergraph-memory
description: >
  JSON-LD hypergraph memory architecture for agent decision persistence, context assembly,
  and training data extraction. Use when working with .memory/ directories, JSON-LD vertex
  schemas (Decision, Session, Commit, Skill, RuleSet), session lifecycle (commit_snapshot →
  consolidate → defrag), context assembly as BP event, or extracting training data from
  decision histories.
---

# Hypergraph Memory

## Purpose

This skill teaches agents how Plaited's memory architecture works — a git-versioned hypergraph persisted as JSON-LD files. The agent's memory is files in a git repo, queryable via grep (text), a TS runtime (structural), and WASM graph algorithms (BFS, DFS, cosine similarity).

**Use this when:**
- Reading or writing to `.memory/` directories
- Working with JSON-LD vertex schemas (decisions, sessions, commits, skills, rules)
- Implementing session lifecycle handlers (commit, consolidate, defrag)
- Wiring context assembly contributors
- Extracting training data from decision histories
- Understanding the commit vertex one-behind pattern

## JSON-LD Vertex Taxonomy

Every entity in the hypergraph uses three JSON-LD properties for identity and typing:

- **`@id`** — URI identity. `bp:thread/taskGate` in decision 7 and the same `@id` in decision 12 are the same vertex. No foreign keys, no JOINs.
- **`@type`** — typed entities. The processor knows a `SelectionDecision` has `bids`, a `Skill` has `provides`.
- **`@context`** — defines the vocabulary. Skills contribute context; loading a skill extends what types the hypergraph can express.

### `@context` Scoping — Area of Effect

When multiple sources define overlapping vocabulary, the narrowest scope wins:

| Scope | Source | Priority |
|---|---|---|
| Framework | Base `@context.jsonld` | Lowest |
| Workspace | Workspace `AGENTS.md`, workspace skills | ↑ |
| Module | Module `AGENTS.md`, module skills | ↑ |
| Session | Runtime decisions, per-session extensions | Highest |

Resolution: walk session → module → workspace → framework, take first match. Broader scopes provide defaults; narrower scopes override.

### Vertex Types

| Type | `@type` | Purpose |
|---|---|---|
| Decision | `SelectionDecision` | Runtime hyperedge — one per BP superstep |
| Session | `Session` | Session summary with embedding, outcome, tools used |
| Commit | `Commit` | Links decisions to code changes via `attestsTo` |
| Skill | `Skill` | Design-time subgraph — source pointer to markdown |
| RuleSet | `RuleSet` | Ingested AGENTS.md rules with scope |
| Thread | `Thread` | Design-time thread vertex from LSP + brand scan |
| Goal | `Goal` | Agent-generated goal factory vertex |

See **[vertex-schemas.md](references/vertex-schemas.md)** for complete JSON-LD shapes.

## Session Lifecycle

### Decision Write Path

Every BP superstep writes a `decisions/{superstep}.jsonld` file via the `useSnapshot` callback. Files are written continuously — no data lost in flight. One file per superstep: self-contained, greppable, git-diffable.

### Commit Snapshot (Per-Side-Effect)

Git commits happen when a side-effect-producing tool result arrives (`write_file`, `edit_file`, `bash`). Each commit bundles:
1. The code change
2. All pending decision `.jsonld` files since last commit
3. Any pending commit vertices from previous commits

**One-behind pattern:** The commit vertex for commit N is written *after* N completes (SHA only known post-commit). It becomes pending for commit N+1. The `attestsTo` links are correct; the vertex just lives in the next commit's tree.

```typescript
// After git commit completes:
const sha = (await Bun.$`git rev-parse HEAD`.text()).trim()
const commitVertex = {
  '@context': '../../../@context.jsonld',
  '@id': `git:${sha}`,
  '@type': 'Commit',
  session: `session/${sessionId}`,
  attestsTo: pendingDecisions.map(fileToDecisionId),
  artifacts: await getChangedFiles(sha),
  timestamp: new Date().toISOString(),
}
// Written to disk — pending for NEXT commit
await Bun.write(
  `${modulePath}/.memory/sessions/${sessionId}/commits/${sha}.jsonld`,
  JSON.stringify(commitVertex, null, 2),
)
```

### Consolidation (Session End)

At session end, the `sessionClose` bThread requests `consolidate`:
1. Decision files concatenated into `decisions.jsonl` (one JSON-LD doc per line)
2. `meta.jsonld` written with summary, embedding, outcome
3. Individual decision files removed from working tree (preserved in git history + JSONL)
4. Final session directory: `meta.jsonld` + `trajectory.jsonld` + `decisions.jsonl`

### Defrag (Periodic)

After N session completions, `defragSchedule` bThread requests `defrag`:
- Archive old sessions out of working tree via `git archive`
- Reorganize files
- Full history preserved in git's object store

See **[session-lifecycle.md](references/session-lifecycle.md)** for the complete flow with bThread coordination.

## Context Assembly as BP Event

Before each inference call, context is assembled through BP coordination — not an imperative function.

### Flow

1. `batchCompletion` requests `context_assembly` (not `invoke_inference` directly)
2. `contextGate` bThread blocks `invoke_inference` until all contributors respond
3. Each contributor handler queries the hypergraph and triggers `context_segment`
4. After all segments arrive, `contextGate` requests `invoke_inference`

### Contributors

| Contributor | Hypergraph Query | Provides |
|---|---|---|
| Snapshot | Recent decision hyperedges | BP decision history |
| Memory | `meta.jsonld` embeddings + similarity | Similar past sessions |
| Skills | Area-of-effect scoped subgraphs | Schema knowledge for current scope |
| Plan | Active plan step bThread positions | Step status and blocking |
| Constitution | Governance rule subgraphs in scope | Rule explanations |
| Rules | AGENTS.md subgraphs by proximity | Coding conventions, workflow rules |

Context assembly is **observable** (useSnapshot captures which contributors provided what), **trainable** (assembly decisions become training signal), and **composable** (new contributors are additive — just another handler responding to `context_assembly`).

## Training Data Extraction

JSON-LD files are the training data source. The hypergraph CLI extracts signal:

### Extraction Commands

```bash
# SFT: successful session trajectories
./tools/hypergraph extract-training \
  --sessions .memory/sessions/ \
  --filter "outcome=approved" \
  --format sft > sft-data.jsonl

# GRPO: failed + corrected trajectories
./tools/hypergraph extract-training \
  --sessions .memory/sessions/ \
  --filter "outcome=rejected" \
  --format grpo > grpo-pairs.jsonl

# Dreamer: state transition pairs
./tools/hypergraph extract-transitions \
  --sessions .memory/sessions/ \
  --output dreamer-data.jsonl
```

### Signal Tiers via Hypergraph

| Signal | Hypergraph Query |
|---|---|
| Gate rejection | `grep -rl '"gate_rejected"'` or `hypergraph causal-chain --to "bp:event/gate_rejected"` |
| Test failure | grep over trajectory + `hypergraph co-occurrence` for active threads |
| Test pass + user rejects | `meta.jsonld` with `outcome: "rejected"` — full decisions for GRPO |
| Test pass + user approves | `meta.jsonld` with `outcome: "approved"` — gold SFT data |

### Commit Vertex as Training Anchor

The training pipeline traverses `@id` links: `decision/42 ← attestsTo ← git:a1b2c3d → artifacts → src/agent/agent.ts`. This assembles `(reasoning, code_change)` pairs structurally, not by parsing `git log`.

### bThread Crystallization

Recurring patterns in the hypergraph become candidate bThreads:

```bash
./tools/hypergraph recurring-patterns \
  --sessions .memory/sessions/ \
  --min-occurrences 5 \
  --output patterns.jsonl
```

Structural representation (threads, events, conditions) is precise enough to generate `bSync` declarations. Owner reviews before adding to constitution.

## EVENT_CAUSATION Relationships

The `provenance` query derives causal edges from decision sequences using three signals:

1. **Thread continuity** — same thread active across consecutive decisions
2. **Block→unblock transitions** — a thread was blocking, then the block lifted
3. **Event chain causation** — the agent loop's `EVENT_CAUSATION` map

See **[causation-map.md](references/causation-map.md)** for the complete relationship map.

## File Structure

### Module-Level `.memory/`

```
modules/{module_name}/
├── .memory/
│   ├── @context.jsonld              # module-scoped vocabulary
│   ├── sessions/
│   │   └── {session_id}/
│   │       ├── @context.jsonld      # session-specific vocabulary
│   │       ├── meta.jsonld          # summary, outcome, embedding
│   │       ├── decisions/           # one file per BP superstep
│   │       ├── commits/             # commit vertices (one-behind)
│   │       └── trajectory.jsonld    # tool calls + outputs
│   ├── skills/                      # ingested skill subgraphs
│   ├── rules/                       # ingested AGENTS.md subgraphs
│   └── threads/                     # design-time thread vertices
```

### Node-Level `.memory/`

```
node/
├── .memory/
│   ├── @context.jsonld              # framework-level vocabulary
│   ├── sessions/                    # cross-module coordination
│   ├── rules/
│   │   └── workspace.jsonld         # workspace AGENTS.md
│   ├── constitution/
│   │   ├── mac/                     # mandatory governance factories
│   │   └── dac/                     # discretionary governance factories
│   └── goals/                       # agent-generated goal factories
```

## Query Stack

Three layers over the same JSON-LD files:

| Layer | Tool | Use Case |
|---|---|---|
| Text (80%) | `grep -rl`, `git log`, `cat` | Quick lookups, version history |
| Structural | `hypergraph` CLI (compiled Bun) | Causal chains, co-occurrence, cycles, similarity |
| Graph algorithms | WASM via AssemblyScript | BFS, DFS, cosine similarity, pattern matching, filtered reachability |

## References

- **[vertex-schemas.md](references/vertex-schemas.md)** — Complete JSON-LD shapes for Decision, Session, Commit, Skill, RuleSet, Thread vertices
- **[causation-map.md](references/causation-map.md)** — EVENT_CAUSATION relationships and provenance derivation
- **[session-lifecycle.md](references/session-lifecycle.md)** — commit_snapshot → consolidate → defrag flow with bThread coordination

## Related Skills

- **behavioral-core** — BP engine patterns (bThread, bSync, useFeedback, useSnapshot)
- **code-patterns** — Utility function conventions
- **trial-runner** — Trial execution and trajectory capture
- **compare-trials** — Teacher vs student trajectory comparison
