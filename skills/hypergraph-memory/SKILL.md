---
name: hypergraph-memory
description: >
  JSON-LD hypergraph memory architecture for agent decision persistence, contributor-based context assembly,
  and structural graph queries. Use when working with .memory/ directories, JSON-LD vertex
  schemas (Decision, Session, Commit, Skill, RuleSet), session lifecycle (commit_snapshot →
  consolidate → defrag), context contributors, or reasoning about
  decision histories.
---

# Hypergraph Memory

## Purpose

This skill teaches agents how Plaited's memory architecture works — a
git-versioned hypergraph persisted as JSON-LD files. The agent's memory is
files in a git repo, queryable via grep (text), a domain-agnostic TypeScript
runtime, and WASM graph algorithms.

This skill mixes two layers:
- **current Plaited tooling** — what `src/hypergraph/hypergraph.ts` and the ingest
  tools actually support today
- **memory architecture** — the broader `.memory/` conventions and runtime
  lifecycle built around those tools

**Use this when:**
- Reading or writing to `.memory/` directories
- Working with JSON-LD vertex schemas (decisions, sessions, commits, skills, rules)
- Implementing session lifecycle handlers (commit, consolidate, defrag)
- Wiring context contributors or session-summary context
- Analyzing decision histories structurally
- Understanding the commit vertex one-behind pattern
- Using deterministic encoding/validation tools such as `skill-links` and `validate-encoding`

## JSON-LD Vertex Taxonomy

Every entity in the hypergraph uses three JSON-LD properties for identity and typing:

- **`@id`** — URI identity. `bp:thread/taskGate` in decision 7 and the same `@id` in decision 12 are the same vertex. No foreign keys, no JOINs.
- **`@type`** — typed entities. The processor knows a `SelectionDecision` has `bids`, a `Skill` has `provides`.
- **`@context`** — defines vocabulary and naming conventions for the documents.
  This is important architecturally, but the current generic hypergraph tool
  does not implement full scoped `@context` resolution.

### `@context` Scoping — Area of Effect

This is **target architecture**, not a capability of the current generic
hypergraph tool.

When multiple sources define overlapping vocabulary, the intended rule is that
the narrowest scope wins:

| Scope | Source | Priority |
|---|---|---|
| Framework | Base `@context.jsonld` | Lowest |
| Workspace | Workspace `AGENTS.md`, workspace skills | ↑ |
| Module | Module `AGENTS.md`, module skills | ↑ |
| Session | Runtime decisions, per-session extensions | Highest |

Resolution target: walk session → module → workspace → framework, take first
match. Broader scopes provide defaults; narrower scopes override.

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
  '@context': { bp: 'urn:bp:' },
  '@id': `bp:commit/${sha}`,
  '@type': 'Commit',
  sha,
  modulePath,
  attestsTo: pendingDecisions,
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

## Context Contributors Around Hypergraph Memory

Before each inference call, the agent assembles context from pure
contributors. This is current code reality in `src/agent/context.ts` and
`src/agent/create-agent-loop.ts`.

This section describes the **memory architecture around the hypergraph**, not a
behavior built into the generic `hypergraph` tool itself.

### Current Flow

1. The loop triggers `invoke_inference`
2. `createContextAssembler()` composes context from registered contributors
3. The session-summary contributor loads prior `meta.jsonld` once at startup and
   contributes a warm-layer summary when present
4. Other contributors add system prompt, prior rejections, tools, plan, history,
   and optional proactive sensor state
5. The assembled prompt is sent to the model directly

Hypergraph-backed memory is part of this flow through persisted session
metadata, decision files, and later structural queries. It is not currently
coordinated by a dedicated `contextGate` or `context_segment` event protocol.

### Contributors

| Contributor | Hypergraph / Memory Input | Provides |
|---|---|---|
| Session summary | `meta.jsonld` from prior session state | Warm-layer orientation |
| Memory | `meta.jsonld` embeddings + similarity | Similar past sessions |
| Skills | Ingested skill graphs + `skill-links` encoding surface | Schema knowledge for current scope |
| Plan | Active plan step bThread positions | Step status and blocking |
| Constitution | Governance rule subgraphs in scope | Rule explanations |
| Rules | AGENTS.md subgraphs by proximity | Coding conventions, workflow rules |

Context assembly is **observable**, **trainable**, and **composable**. The
contributor model is deterministic and additive even though the current
implementation does not expose contributor contribution as separate BP events.

## Structural Signal Extraction

JSON-LD files are the durable structural source for later training and
distillation pipelines.

Current Plaited tooling supports structural queries such as:

- `causal-chain`
- `co-occurrence`
- `check-cycles`
- `match`
- `similar`
- `reachability`
- `provenance`

These are enough to inspect memory structure, derive causal links, and assemble
higher-level extraction pipelines.

Higher-level training/distillation extraction is still a research-layer task
built on top of these queries, not a built-in generic hypergraph CLI command.

### Signal Tiers via Hypergraph

| Signal | Hypergraph Query |
|---|---|
| Gate rejection | `grep -rl '"gate_rejected"'` or structural queries over decisions/provenance |
| Test failure | grep over trajectory + `hypergraph co-occurrence` for active threads |
| Test pass + user rejects | `meta.jsonld` with `outcome: "rejected"` — full decisions for GRPO |
| Test pass + user approves | `meta.jsonld` with `outcome: "approved"` — gold SFT data |

### Commit Vertex as Training Anchor

The training pipeline traverses `@id` links such as
`session/sess_abc/decision/42 ← attestsTo ← bp:commit/a1b2c3d`.
The current commit vertex records `modulePath` plus the decision links; richer
code-change expansion is still a higher-level training/distillation concern
rather than part of the vertex itself.

### bThread Crystallization

Recurring patterns in the hypergraph may become candidate bThreads, but that is
currently a research/program concern rather than a built-in hypergraph CLI
command. Structural representation (threads, events, conditions) is precise
enough to support later factory generation or review workflows.

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
│   │   └── project.jsonld           # root AGENTS.md
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
| Structural | `hypergraph` CLI (compiled Bun) | Causal chains, co-occurrence, cycles, similarity, reachability, provenance |
| Encoding / validation | `skill-links`, `validate-encoding`, `ingest-skill`, `ingest-rules` | Deterministic skill/doc distillation and provenance checks |
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

## Alignment With Default Hypergraph

For `dev-research/default-hypergraph`, this skill should be treated as source
material for encoding:

- stable memory object types
- provenance and continuity concepts
- recall triggers and similarity concepts
- query-mode semantics

It should not be copied into ontology verbatim. Session lifecycle details,
operator workflows, and aspirational extraction commands should remain prose or
research material unless they are explicitly encoded and validated.
