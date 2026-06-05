# Agent Architecture Design Decisions

> Consensus document for agent workers, SQLite ownership, and behavioral lifecycle.

## Overview

The agent is a behavioral program (`src/agent/agent.ts`) that owns a single SQLite database.
All database writes happen in the main thread. Dedicated workers handle isolated,
potentially blocking tasks and communicate back to the agent via `postMessage`.

Topic context is assembled from three tiers:
- **Bounded memory**: Two fixed-size text columns on the `topics` table (`memory` at 2200 chars, `user` at 1375 chars) injected into every inference system prompt.
- **Queryable event log**: `bp_snapshots` table records every selected event (frontier, selection, deadlock, feedback_error) keyed by topic.
- **Archives**: Cold storage for evicted snapshot rows, kept as Bun archives for portability.

## 1. SQLite: Owned by Agent, Single Writer

- **Choice**: SQLite via Bun's built-in `bun:sqlite` module.
- **Owner**: `src/agent/agent.ts` (main thread) through `src/agent/db.ts`.
- **Rationale**: Snapshots are hot-path writes (every behavioral step). Topic memory updates need synchronous read-modify-write. Single connection avoids WAL contention and "which worker owns what table" confusion.
- **Rejected approaches**:
  - Worker-owned DB → indexer and agent both need access; either indexer writes directly (two writers) or agent proxies every write via IPC (overhead).
  - Dedicated DB worker → every snapshot/event write becomes a `postMessage` round-trip, measurable overhead per behavioral step.

## 2. Workers: Three Dedicated, Domain-Specific

```
┌─────────────────┐     postMessage(metadata)     ┌─────────────────┐
│ package-indexer │ ─────────────────────────────→│                 │
│    worker       │     (no DB access)            │    agent.ts     │
│                 │                               │  (behavioral    │
│ watches bun.lock│                               │   + SQLite)     │
│ validates exports│                              │                 │
└─────────────────┘                               └─────────────────┘
                                                          │
                              ┌─────────────────────────┼─────────────────────────┐
                              ↓                         ↓                         ↓
                        ┌─────────┐              ┌─────────────┐            ┌─────────────┐
                        │  shell  │              │  frontier-  │            │   (future   │
                        │ worker  │              │   analysis  │            │  inference  │
                        │         │              │   worker    │            │   worker)   │
                        └─────────┘              └─────────────┘            └─────────────┘
```

| Worker | Domain | Lifecycle | Why separate |
|--------|--------|-----------|--------------|
| **shell** | File I/O + shell exec | On-demand per command | Blocks on I/O, needs cwd isolation |
| **package-indexer** | File watch + package discovery | Long-running continuous | Different rhythm (reacts to `bun.lock`), runs forever |
| **frontier-analysis** | Behavioral exploration | On-demand per analysis | CPU-bound, combinatorially expensive, can hang |

**Do not merge workers.** A `maxDepth: 10` frontier explore could hang for seconds. If that shared a worker with shell commands, the agent couldn't read files or run commands during analysis. If it shared with the indexer, the indexer would stop watching `bun.lock`.

### Shell Worker (`src/agent/workers/shell.ts`)

Handles `exec`, `read`, `write` commands. Receives command envelopes, executes, returns results.
No SQLite. No behavioral awareness. Was previously `src/agent/worker.ts`.

### Package Indexer Worker (`src/agent/workers/package-indexer.ts`)

- **Scope**: File watching, package discovery, export validation. No SQLite access.
- **Behavior**: Watches `bun.lock`. On change, re-scans workspace packages, validates exports, posts structured metadata to `agent.ts`.
- **Posts**: `{ type: 'packages_changed', detail: { packages: [...] } }` or `{ type: 'indexer_error', error }`
- **Does not**: Import or execute package code, touch SQLite, or trigger behavioral events directly.

### Frontier Analysis Worker (`src/agent/workers/frontier-analysis.ts`)

- **Scope**: Replay, explore, verify behavioral specs.
- **Behavior**: Receives `{ behaviorPaths, mode, snapshotMessages, triggers, strategy, selectionPolicy, maxDepth }`. Imports defineBehavior modules via mock API, captures threads, runs pure engine, returns results.
- **Posts**: `{ type: 'frontier_result', detail: { mode, report, traces, findings } }`
- **Does not**: Access SQLite, run side-effects, or touch the network.

## 3. DB Module (`src/agent/db.ts`)

Thin synchronous wrapper around `bun:sqlite` mounted at `.plaited/context.sqlite`.

All writes are main-thread only. Exposed operations:

| Function | Called by | Purpose |
|----------|-----------|---------|
| `recordSnapshot(topicId, message)` | Snapshot listener | Insert every behavioral snapshot |
| `recordUiEvent(topicId, event)` | WebSocket handlers | Insert render/attrs/import/disconnect |
| `upsertTopic({ id, name?, description?, memory?, user? })` | Topic handlers | Create topic, update bounds |
| `upsertPackages(metadata[])` | `packages_changed` handler | Bulk-insert discovered packages/exports |
| `linkTopicPackage(topicId, packageId)` | `load_packages` handler | Associate topic with package |
| `querySnapshots(topicId, options?)` | Context assembly, frontier-analysis prep | Recent snapshots for a topic |
| `getTopicContext(id)` | Inference preflight | `{ memory, user }` for system prompt |
| `pruneSnapshots(threshold)` | Scheduled maintenance | Move old rows to Bun archives |

### Initialization

```ts
db.ts` lazily opens `.plaited/context.sqlite`, runs `CREATE TABLE IF NOT EXISTS` for all tables, and returns a singleton `Database`.
```

## 4. Package Sourcing Policy

| Source | Package Name Pattern | `packages.type` |
|--------|---------------------|-----------------|
| **npm** | `@plaited/*` only | `'npm'` |
| **workspace** | Everything else | `'workspace'` |

The indexer worker resolves every discovered package against this rule. Only official `@plaited/` scoped packages are trusted to come from the npm registry. All other packages — including agent-generated plugins, user workspace packages, and third-party integrations — must live in the local monorepo workspace and be discovered via `bun.lock` workspace entries.

This constraint prevents the agent from accidentally loading untrusted npm packages as behavioral plugins.

## 5. Package Export Contract

Packages declare exports via `package.json`:

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

## 7. File Watch Strategy

Watch target is `bun.lock` only. Rationale unchanged.

## 8. Schema Storage

- **Template `inputSchema`**: Converted to JSON Schema via `z.toJSONSchema()`, stored as `TEXT`. Reconstructed via `z.fromJSONSchema()`.
- **Behavior `detailSchema`**: Same pattern.
- **Skill frontmatter**: Stored as JSON `TEXT`.
- **Topic memory and user fields**: Stored as `TEXT` with `CHECK(length(value) <= limit)` constraints. Updated via behavioral events (`update_topic_memory`, `update_topic_user`).

## 9. Bounded Topic Memory

Unchanged from prior design.

## 10. Database Schema

```sql
-- Topics (projects/contexts)
CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  memory TEXT CHECK(length(memory) <= 2200),
  user TEXT CHECK(length(user) <= 1375),
  created_at INTEGER DEFAULT (unixepoch())
);

-- Discovered packages
CREATE TABLE packages (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  version TEXT,
  path TEXT NOT NULL,
  type TEXT CHECK(type IN ('workspace', 'npm')) NOT NULL,
  discovered_at INTEGER,
  last_modified INTEGER
);

-- Exports within a package
CREATE TABLE package_exports (
  id INTEGER PRIMARY KEY,
  package_id INTEGER REFERENCES packages(id),
  export_type TEXT CHECK(export_type IN ('behaviors', 'templates', 'skills')) NOT NULL,
  file_path TEXT,
  name TEXT
);

-- Topic → package associations
CREATE TABLE topic_packages (
  topic_id TEXT REFERENCES topics(id),
  package_id INTEGER REFERENCES packages(id),
  loaded_at INTEGER,
  PRIMARY KEY (topic_id, package_id)
);

-- Template metadata
CREATE TABLE templates (
  id INTEGER PRIMARY KEY,
  export_id INTEGER REFERENCES package_exports(id),
  name TEXT NOT NULL,
  scale TEXT,
  input_schema TEXT,
  file_path TEXT
);

-- Behavior metadata
CREATE TABLE behaviors (
  id INTEGER PRIMARY KEY,
  export_id INTEGER REFERENCES package_exports(id),
  name TEXT NOT NULL,
  events TEXT,
  file_path TEXT
);

-- Skill metadata
CREATE TABLE skills (
  id INTEGER PRIMARY KEY,
  export_id INTEGER REFERENCES package_exports(id),
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT,
  frontmatter TEXT,
  file_path TEXT
);

-- Behavioral engine observability (training data)
CREATE TABLE bp_snapshots (
  id INTEGER PRIMARY KEY,
  topic_id TEXT REFERENCES topics(id),
  kind TEXT CHECK(kind IN ('frontier', 'selection', 'deadlock', 'feedback_error')) NOT NULL,
  step INTEGER,
  data TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- UI state reconstruction (websocket messages)
CREATE TABLE ui_events (
  id INTEGER PRIMARY KEY,
  topic_id TEXT REFERENCES topics(id),
  type TEXT CHECK(type IN ('render', 'attrs', 'import', 'disconnect')) NOT NULL,
  version TEXT,
  target TEXT,
  html TEXT,
  swap TEXT,
  attr TEXT,
  registry TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);
```

## 11. Worker Communication: Pure Push, Agent Controls Sequencing

- **Worker → Agent**: Workers emit minimal events via `postMessage`. Agent handlers convert these to behavioral events (`trigger`).
- **Agent → Worker**: Agent handlers post structured commands to workers. Workers never read the database or behavioral state directly.

This keeps workers stateless and decoupled from the behavioral event schema.

## 12. Behavioral Lifecycle

```
Agent generates package
    ↓
Behavioral thread triggers `bun install`
    ↓
`bun.lock` changes
    ↓
Indexer worker detects change → re-scans → posts `packages_changed`
    ↓
Agent handler receives → upserts into SQLite
    ↓
Behavioral thread triggers `load_packages` → imports behaviors/templates
    ↓
Topic now has access to new skills, templates, and behaviors
```

## 13. Snapshot Lifecycle and Archiving

The `bp_snapshots` table records every event selection across all topics.

- **Live retention**: Recent snapshots stay in SQLite for fast query-based context assembly.
- **Archive threshold**: When the table exceeds a configurable size or age threshold, old rows are moved to Bun archives.
- **Topic context assembly** queries the live `bp_snapshots` table for recent events. Archived data is not used for runtime context assembly — bounded `memory` and `user` fields serve that role.

## 14. Frontier Analysis

- **CLI**: `plaited frontier-analysis` stays available for offline analysis.
- **Worker**: `frontier-analysis` worker accepts behavior paths + options, returns results. Agent can dispatch analysis reactively (e.g., on deadlock) and handle results as behavioral events.
- **History replay**: Agent queries `bp_snapshots` for a topic's actual history, passes `snapshotMessages` to the worker for replay.

## 15. Open Questions (Deferred)

- **Package `schemas` export**: Revisit if packages need custom DDL.
- **DuckDB migration**: Revisit if analytical querying needs emerge.
- **Indexer commands**: Currently autonomous; explicit commands may be added.
