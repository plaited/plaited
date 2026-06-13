# Agent Architecture Design Decisions

> Consensus document for agent workers, topic storage, snapshot indexing, and behavioral lifecycle.

## Overview

The agent is a multi-topic behavioral daemon (`src/agent/agent.ts`). Every topic lives as a Git bare repository under `.topics/`. Workflows live in a `.workflows/` bare repo monorepo. Snapshots are append-only JSONL in `~/.onbraid/snapshots/`. Relational data is not stored in a database — relationships are expressed through `devDependencies` in topic `package.json` files and validated through behavioral threads, not schema constraints.

Topic context is assembled from three tiers:
- **Bounded memory**: `MEMORY.md` and `USER.md` in each topic's worktree, enforced by behavioral handlers.
- **Queryable event log**: `~/.onbraid/snapshots/<topic>.jsonl` records every selected event (frontier, selection, deadlock, feedback_error).
- **Archives**: Cold storage for evicted snapshot lines, kept as Bun archives for portability.

## 1. Topic Storage: Git Bare Repos

### Directory Layout

```
.onbraid/
└── snapshots/
    ├── <topic-a>.jsonl
    ├── <topic-a>.kind.idx
    ├── <topic-a>.time.idx
    ├── <topic-b>.jsonl
    └── ...

.workflows/
├── .git/                    ← bare repo (monorepo of workflow packages)
├── main/                    ← default worktree: package.json, src/, etc.
├── feature-X/               ← ephemeral worktree for isolated work
└── ...

.topics/
├── <topic-a>/
│   ├── .git/                ← bare repo
│   ├── main/                ← default worktree: MEMORY.md, USER.md, package.json
│   ├── experiment-1/        ← ephemeral worktree
│   └── learn-y/             ← another parallel worktree
└── <topic-b>/
    ├── .git/
    ├── main/
    └── ...
```

The root of each bare repo contains only the `.git/` directory and worktree directories. No editable files in the root.

### Topic Identity

Each topic is a private Bun package with:

```json
{
  "name": "@topics/<topic-name>",
  "description": "...",
  "devDependencies": {
    "@onbraid/shell-worker": "link:@onbraid/shell-worker",
    "@onbraid/frontier-analysis": "link:@onbraid/frontier-analysis"
  }
}
```

- `MEMORY.md` — agent context, bounded by behavioral threads
- `USER.md` — user preferences, bounded by behavioral threads
- `devDependencies` — express topic → workflow relationships without a JOIN table

### Why No SQLite?

All relational queries SQLite served are expressible through:
- **Topic context**: `Bun.file('.topics/<topic>/main/MEMORY.md').text()`
- **Package discovery**: In-memory `Map<name, PackageMeta>` built from `packages_changed` events
- **Topic-package linkage**: `Bun.file('.topics/<topic>/main/package.json').json().devDependencies`
- **Snapshot querying**: JSONL + `.kind.idx`/`.time.idx` files in `~/.onbraid/snapshots/`

`db.ts` and `bun:sqlite` are removed. The dependency on a single-writer database vanishes, and the agent can be a multi-topic daemon without contention.

## 2. Workers: Four Dedicated, Domain-Specific

```
┌─────────────────┐     postMessage(metadata)     ┌─────────────────┐
│ package-indexer │ ─────────────────────────────→│                 │
│    worker       │     (no DB access)            │    agent.ts     │
│                 │                               │  (behavioral    │
│ watches bun.lock│                               │   + in-memory   │
│ validates exports│                              │   topic state)  │
└─────────────────┘                               └─────────────────┘
                                                          │
                              ┌─────────────────────────┼─────────────────────────┐
                              ↓                         ↓                         ↓
                        ┌─────────┐              ┌─────────────┐            ┌──────────┐
                        │  shell  │              │  frontier-  │            │inference │
                        │ worker  │              │   analysis  │            │  worker  │
                        │         │              │   worker    │            │          │
                        └─────────┘              └─────────────┘            └──────────┘
```

| Worker | Domain | Lifecycle | Why separate |
|--------|--------|-----------|--------------|
| **shell** | File I/O + shell exec | On-demand per command | Blocks on I/O, needs cwd isolation per topic worktree |
| **package-indexer** | File watch + package discovery | Long-running continuous | Different rhythm (reacts to `bun.lock`), runs forever |
| **frontier-analysis** | Behavioral exploration | On-demand per analysis | CPU-bound, combinatorially expensive, can hang |
| **inference** | LLM inference + MCP search | On-demand per request | Network I/O, model endpoint latency, connection pooling |

**Do not merge workers.** A `maxDepth: 10` frontier explore could hang for seconds. If that shared a worker with shell commands, the agent couldn't read files or run commands during analysis. If it shared with the indexer, the indexer would stop watching `bun.lock`.

### Shell Worker (`src/agent/workers/shell.ts`)

Handles `exec`, `read`, `write` commands. Receives command envelopes with an optional `worktree` path, executes in that cwd, returns results.
No database access. No behavioral awareness. Was previously `src/agent/worker.ts`.

### Package Indexer Worker (`src/agent/workers/package-indexer.ts`)

- **Scope**: File watching, package discovery, export validation. No database access.
- **Behavior**: Watches `.workflows/bun.lock`. On change, re-scans monorepo packages, validates exports, posts structured metadata to `agent.ts`.
- **Posts**: `{ type: 'packages_changed', detail: { packages: [...] } }` or `{ type: 'indexer_error', error }`
- **Does not**: Import or execute package code, touch the filesystem of active topics, or trigger behavioral events directly.

### Frontier Analysis Worker (`src/agent/workers/frontier-analysis.ts`)

- **Scope**: Replay, explore, verify behavioral specs.
- **Behavior**: Receives `{ behaviorPaths, mode, snapshotMessages, triggers, strategy, selectionPolicy, maxDepth }`. Imports defineBehavior modules via mock API, captures threads, runs pure engine, returns results.
- **Posts**: `{ type: 'frontier_result', detail: { mode, report, traces, findings } }`
- **Does not**: Access topic repositories, run side-effects, or touch the network.

### Inference Worker (`src/agent/workers/inference.ts`)

- **Scope**: LLM inference requests + MCP search provider calls.
- **Behavior**: Receives inference envelopes containing `{ model, messages, iclContract?, searchProvider? }`. Sends requests to model endpoints (e.g. a local vLLM instance at `openresponses.org`). If a `searchProvider` is configured (installed via `onbraid mcp-client` as an MCP search server like You.com's MCP), the worker can perform grounding searches before inference.
- **Posts**: `{ type: 'inference_result', detail: { model, output, correlationId } }` or `{ type: 'inference_error', detail: { model, error, correlationId } }`
- **Does not**: Access topic repositories, run shell commands, or trigger behavioral events directly.

## 3. Topic and Snapshot Modules

### `src/agent/topic.ts` (replaces `db.ts`)

File-system wrapper for bare repo operations. All I/O is async, topic-scoped.

| Function | Called by | Purpose |
|----------|-----------|---------|
| `getTopicContext(topicId)` | Inference preflight | Read `MEMORY.md` + `USER.md` from `.topics/<topic>/main/` |
| `setTopicMemory(topicId, text)` | Behavioral handler | Write `MEMORY.md`, then commit |
| `setTopicUser(topicId, text)` | Behavioral handler | Write `USER.md`, then commit |
| `createTopic(id, opts)` | Topic creation handler | Run `git init --bare`, scaffold `main/` worktree, package.json, MEMORY.md, USER.md |
| `addTopicWorktree(topicId, branch)` | Experiment handler | `git worktree add .topics/<topic>/<branch>` |
| `listTopicWorktrees(topicId)` | UI handler | List directories in `.topics/<topic>/` excluding `.git/` |
| `getTopicDependencies(topicId)` | Package loading handler | Read `package.json` `devDependencies` |
| `setTopicDependency(topicId, pkg, ref)` | Behavioral handler | Edit `package.json`, run `bun install`, commit |

### Validation by Behavioral Threads

Memory and user bounds are not schema constraints — they are enforced by behavioral handlers. When an `update_topic_memory` event fires, the handler reads the file, measures size, and if the result exceeds the bound, dispatches a `memory_overflow` event. The agent's behavioral program includes a condensation strategy thread. This is a feature, not a bug: bounded-memory is a behavioral invariant, not a storage-layer concern.

### `src/agent/snapshot.ts`

Append-only JSONL event log, one file per topic, stored in `~/.onbraid/snapshots/`.

| Function | Called by | Purpose |
|----------|-----------|---------|
| `appendSnapshot(topicId, message)` | Snapshot listener | Append one line to `<topic>.jsonl` |
| `readSnapshots(topicId, opts)` | Context assembly | Scan with optional `kinds`/`limit` |
| `readSnapshotsIndexed(topicId, opts)` | Context assembly | Use `.kind.idx` / `.time.idx` for fast offset seeks |
| `buildIndexes(topicId)` | Maintenance | Rebuild index files from full scan |
| `pruneSnapshots(topicId, threshold)` | Maintenance | Delete old lines, rebuild indexes |

No database. The indexes are ephemeral JSON files alongside the JSONL.

## 4. Package Sourcing Policy

| Source | Package Name Pattern | Resolution |
|--------|---------------------|------------|
| **npm** | `@onbraid/*` only | npm registry |
| **workflow** | Everything else | `.workflows/` bare repo monorepo via `bun link` |

The indexer worker resolves every discovered package against this rule. Only official `@onbraid/` scoped packages are trusted to come from the npm registry. All other packages — including agent-generated plugins and workflow packages — live in the local `.workflows/` monorepo.

This constraint prevents the agent from accidentally loading untrusted npm packages as behavioral plugins.

### `bun link` Workflow

1. Package-indexer detects new/updated workflow package in `.workflows/`
2. Agent handler runs `bun link` for that package
3. Topics reference linked packages by name in `devDependencies`
4. On `bun install` in a topic worktree, linked packages resolve from the global link store

## 5. Package Export Contract

Workflow packages declare exports via `package.json`:

```json
{
  "exports": {
    "./behaviors": "./src/behaviors.ts",
    "./templates": "./src/templates.ts",
    "./skills": "./skills/**"
  }
}
```

| Export | Discovery | Validation |
|--------|-----------|------------|
| `behaviors` | Single file | `.$ === '🎛️'` (B_PROGRAM_IDENTIFIER) |
| `templates` | Single file | `.$ === '🧩'` (PLAITED_TEMPLATE_IDENTIFIER), `scale`, `inputSchema` |
| `skills` | Directory | Each subdir must contain exactly one `SKILL.md`; validate frontmatter against AgentSkills spec |

There is no separate metadata cache. The agent loads templates, behaviors, and skills by `import()` on demand. The in-memory `Map<name, PackageMeta>` (populated from `packages_changed` events) tracks name, version, and path only. Export validation happens at `bun link` + install time, not in a pre-built manifest.

## 6. Multi-Topic Daemon

`agent.ts` runs as a single process serving multiple topics. The WebSocket server uses `Sec-WebSocket-Protocol` as the topic routing key. Each connected controller subscribes to its topic channel.

```
GET /ws
Sec-WebSocket-Protocol: <topic-id>
                    │
                    └── agent routes messages to topic's behavioral thread
```

### Per-Topic Routing

The agent maintains an in-memory `Map<string, TopicState>`:

```typescript
type TopicState = {
  id: string
  worktree: string              // default worktree path, e.g. '.topics/foobar/main'
  activeWorktrees: Set<string>  // ephemeral worktrees in use
  packages: Set<string>         // linked packages currently depended on
  // behavioral program state is per-topic
}
```

Each topic has its own behavioral thread context. Events with a matching `topic` field route to that topic's handlers. Agent-level handlers (worker lifecycle, indexer) are topic-agnostic.

### Shell Worker and `cwd`

Every shell command includes an optional `worktree` path:

```typescript
{ type: 'exec', detail: { command: 'bun test', worktree: '.topics/foobar/experiment-1' } }
```

If `worktree` is omitted, the default worktree is used. The shell worker never changes its own working directory permanently — each command is executed with `Bun.spawn({ cwd })`.

## 7. File Watch Strategy

Watch target is `.workflows/bun.lock` only. The package-indexer worker watches the workflows monorepo, not individual topics.

## 8. Schema Storage

- **Template `inputSchema`**: Converted to JSON Schema via `z.toJSONSchema()`, held in the template module's export. Reconstructed via `z.fromJSONSchema()` on `import()`.
- **Behavior `detailSchema`**: Same pattern — lives in the behavior module.
- **Skill frontmatter**: Read from `SKILL.md` frontmatter at validation time; not cached.
- **Topic memory and user fields**: Live as Markdown files in the topic worktree. Bounds enforced by behavioral handlers. Updated via behavioral events (`update_topic_memory`, `update_topic_user`).

## 9. Bounded Topic Memory

Memory bounds are enforced by behavioral threads, not database constraints.

```
update_topic_memory event fires
    │
    ├── handler reads MEMORY.md (or current buffered state)
    ├── measures character count
    ├── if within bound (2200 chars) → write file, commit
    └── if exceeds bound → trigger memory_overflow event
                              │
                              └── condensation strategy thread:
                                    summarize, archive to subdir,
                                    or prompt user for guidance
```

The same pattern applies to `USER.md` (1375 char bound). These are configured constants, not schema limits. Changing a bound means changing a behavioral handler, not a DDL migration.

## 10. Removed: SQLite Schema

The SQLite database and its `db.ts` module are deleted. All former tables are replaced:

| Former Table | Replacement |
|--------------|-------------|
| `topics` | `.topics/<id>/main/` worktree with `MEMORY.md`, `USER.md`, `package.json` |
| `packages` | In-memory `Map<name, PackageMeta>` from `packages_changed` events |
| `package_exports` | Runtime `import()` of workflow package exports; validated at link time |
| `topic_packages` | `devDependencies` in each topic's `package.json` |
| `templates` / `behaviors` / `skills` | Exported from workflow packages; no metadata cache |
| `bp_snapshots` | `~/.onbraid/snapshots/<topic>.jsonl` + `.kind.idx` + `.time.idx` |
| `ui_events` | **Not needed** — UI state derived from behavioral engine on controller connect |

The removal of `ui_events` is intentional. Every behavioral event already flows through the snapshot JSONL. When a controller reconnects, the agent's behavioral thread re-derivs the current UI state (re-renders from topic state) rather than replaying a message log.

## 11. Worker Communication: Pure Push, Agent Controls Sequencing

- **Worker → Agent**: Workers emit minimal events via `postMessage`. Agent handlers convert these to behavioral events (`trigger`).
- **Agent → Worker**: Agent handlers post structured commands to workers. Workers never read topic repositories or behavioral state directly.

This keeps workers stateless and decoupled from the behavioral event schema.

## 12. Inference: ICL Wire and Model Access

The agent invokes LLM inference through the **inference worker** — no separate container, no manual vLLM startup. Behavioral handlers trigger inference by posting work to the worker and receiving results as behavioral events.

### ICLContract Schema

ICL (in-context learning) instructions are structured as a typed Zod schema, riding in the `metadata` field of the behavioral event detail that carries the inference request:

```typescript
// src/agent/training/training.schemas.ts
export const ICLContractSchema = z.object({
  objective: z.string(),
  patterns_to_apply: z.array(z.string()),
  constraints: z.array(z.string()),
  expected_shapes: z.record(z.string(), z.unknown()),
  verification_checklist: z.array(z.string()),
})

export type ICLContract = z.output<typeof ICLContractSchema>
```

The ICL is not stored in a dedicated snapshot type. It enters through `detail.metadata.iclContract` on whichever behavioral event the handler receives, flows to the inference worker, and surfaces in the snapshot JSONL as part of the selected-event detail.

### Inference Flow

```
Handler receives event with iclContract in detail.metadata
    │
    ├── Handler posts work to inference worker:
    │     { model, messages, iclContract, correlationId }
    │
    ├── Inference worker calls model endpoint (openresponses.org vLLM)
    │     Optionally performs MCP search grounding first
    │
    ├── Worker posts back:
    │     { type: 'inference_result', detail: { model, output, correlationId } }
    │
    └── Agent handler receives result as behavioral event
          → triggers verifier chain or next step
```

The inference worker connects to an existing vLLM endpoint. Both analyst and executor models share the same worker — they differ only by the `model` field. The `openresponses.org` endpoint serves both.

### MCP Search Grounding

When the handler needs fresh external context (Always-Search Policy), the inference worker calls an MCP search provider before inference. Search providers are installed via `onbraid mcp-client` following the `add-remote-mcp` skill. The recommendation is You.com's MCP server:

```bash
onbraid mcp-client '{"mode":"call-tool","url":"https://mcp.you.com","tool":"you-search","args":{"query":"..."},"auth":{"type":"bearer-env","token":{"envVar":"YDC_API_KEY"}}}'
```

Search results are appended to the inference prompt as `<info>...</info>` blocks. The worker handles context-window bounding.

## 13. Training Data: Eval-Based Extraction

Training pairs are extracted from existing snapshot JSONL — no SQLite, no `training_episodes` table. The extraction reads `detail.metadata.iclContract` from selected-event snapshots and pairs each ICL with the executor output and verifier result.

### TrainingPair Schema

```typescript
export const TrainingPairSchema = z.object({
  task: z.string(),
  iclContract: ICLContractSchema,
  executorOutput: z.string(),
  verdict: z.object({
    pass: z.boolean(),
    score: z.number().min(0).max(1),
    l1: z.boolean(),
    l2: z.boolean(),
    l3: z.boolean(),
  }),
  source: z.object({
    topicId: z.string(),
    trialId: z.string(),
    runId: z.string(),
  }),
})
export type TrainingPair = z.output<typeof TrainingPairSchema>
```

### Extraction: Snapshot Query, Not DB Join

The extraction script (`src/agent/training/extract-pairs.ts`) reads from `~/.onbraid/snapshots/<topic>.jsonl` via `readSnapshotsIndexed()`, filtering for selection snapshots whose detail carries `metadata.iclContract`. No correlation IDs, no custom snapshot types.

### Eval Integration

Training pairs convert mechanically to and from `EvalTrial`:

```
TrainingPair → EvalTrial:
  task.prompt           = TrainingPair.task
  task.metadata         = { iclContract: TrainingPair.iclContract }
  result.message        = TrainingPair.executorOutput
  result.metadata       = { verifierResults: TrainingPair.verdict }
  snapshots             = (read from source pointers)
  metadata              = { runId, model, stage }
```

Inline `json` graders carry the ICL through grading via `result.metadata.iclContract`. Calibrate mode reviewers see the exact ICL instructions alongside pass/fail verdicts.

### Layout

```
~/.onbraid/training/<run>/
├── pairs.jsonl          ← TrainingPair lines
├── config.json          ← model, stage, hyperparams
└── results.jsonl        ← EvalTrialResult lines (post-grade)
```

For the full training pipeline (curriculum stages, SFT with Unsloth, verifier chain, deployment), see the `train-neuro-symbolic-agent` skill.

## 14. Behavioral Lifecycle

```
Agent creates topic
    ↓
Behavioral thread: git init --bare, scaffold main/ worktree
    ↓
Agent generates workflow package
    ↓
Behavioral thread: write files in .workflows/worktree, bun link
    ↓
.workflows/bun.lock changes
    ↓
Indexer worker detects change → re-scans → posts `packages_changed`
    ↓
Agent handler receives → updates in-memory Map
    ↓
Behavioral thread triggers `load_packages` → imports behaviors/templates
    │
    ├── Topic handler: add package to devDependencies, bun install in topic worktree
    └── Topic now has access to new skills, templates, and behaviors
```

## 15. Snapshot Lifecycle and Archiving

`~/.onbraid/snapshots/<topic>.jsonl` records every event selection per topic.

- **Live retention**: Recent snapshots stay in JSONL. `.kind.idx` and `.time.idx` enable fast seek-based reads without parsing every line.
- **Archive threshold**: When a file exceeds a configurable size or age threshold, old lines are moved to Bun archives and indexes are rebuilt.
- **Topic context assembly** queries the live JSONL via `readSnapshotsIndexed()`. Archived data is not used for runtime context assembly — bounded `memory` and `user` fields (plus the in-flight behavioral state) serve that role.

```
~/.onbraid/snapshots/
├── foobar.jsonl          ← append-only for foobar topic
├── foobar.kind.idx       ← { frontier: [0, 47, ...], selection: [...] }
├── foobar.time.idx       ← [ { ts, offset }, ... ]
├── baz.jsonl
└── archives/
    ├── foobar-2026-06-01.tar.gz
    └── ...
```

## 16. Frontier Analysis

- **CLI**: `onbraid frontier-analysis` stays available for offline analysis.
- **Worker**: `frontier-analysis` worker accepts behavior paths + options, returns results. Agent can dispatch analysis reactively (e.g., on deadlock) and handle results as behavioral events.
- **History replay**: Agent reads snapshots via `readSnapshotsIndexed()` for a topic's actual history, passes `snapshotMessages` to the worker for replay.

## 17. Open Questions (Deferred)

- **Package `schemas` export**: Revisit if packages need custom DDL.
- **DuckDB migration**: Revisit if analytical querying needs emerge.
- **Indexer commands**: Currently autonomous; explicit commands may be added.
- **Topic lifecycle hooks**: When to auto-create vs. require explicit `create_topic` event.
- **Garbage collection**: When to prune orphan topic worktrees and stale linked packages.
