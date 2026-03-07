# Modnet Implementation

> **Status: ACTIVE** — Extracted from SYSTEM-DESIGN-V3.md. Cross-references: `Modnet.md` (design standards), `Structural-IA.md` (design grammar), `CONSTITUTION.md` (governance enforcement), `PROJECT-ISOLATION.md` (modules vs. projects).

## Topology: 1 Node : 1 User

A **modnet** (modular network) is a network of user-owned nodes connected peer-to-peer. Each node is one agent serving one user. There is no central server, no shared tenancy, no platform operator. Nodes communicate via the **A2A (Agent-to-Agent) protocol**.

- Each **node** is a Plaited agent instance (agent loop + modules + memory + constitution)
- Each node is **owned and controlled** by one user — their data lives on their node, nowhere else
- Nodes connect to other nodes via A2A — no intermediary, no aggregator
- A node going offline means its data disappears from the network, not from the owner
- Nodes can connect to **multiple networks simultaneously** — team workspace, public skill marketplace, private dev environment

This is not multiplayer (multiple users sharing one agent). It is a network of sovereign agents cooperating.

## Modules Are Internal

A module is an internal artifact — code, data, tools, skills, bThreads — living inside the agent. Modules are not exposed directly to the network. When one node wants to work with another node's module, it requests a **service** or receives an **artifact**. The module stays internal; the output crosses the boundary.

The Agent Card is the node's **public entry point** — a projection of capabilities, not an inventory of internals.

## Module Architecture: Module-Per-Repo

Each module is its own git repository inside a Bun workspace. The node directory is **not** a git repo — full-system backup is at the OS/machine level. Modules get independent version history and transportability. Bun workspace resolution (`workspace:*`) works regardless of whether subdirectories have `.git/`.

### Node Structure

```
node/                               ← plain directory (not a git repo)
  package.json                      ← "workspaces": ["modules/*"], "private": true
  bun.lock                          ← human-readable lockfile
  tsconfig.json
  .workspace.db                     ← rebuilt from sidecars via ATTACH
  modules/
    apple-block/                    ← git repo
      .git/
      package.json                  ← name: "@node/apple-block", "modnet": { MSS tags }
      .meta.db                      ← per-module sidecar, committed to module repo
      apple.ts
      apple.types.ts
      data/
        varieties.json
    farm-stand/                     ← git repo
      .git/
      package.json                  ← depends on "@node/apple-block": "workspace:*"
      .meta.db                      ← per-module sidecar, committed to module repo
      farm-stand.ts
      farm-stand.template.tsx
      farm-stand.behavior.ts        ← only this compiles for browser
      data/
        inventory.json
```

### Package.json as Module Manifest

MSS bridge-code tags live in a custom `"modnet"` field in `package.json`:

```json
{
  "name": "@node/farm-stand",
  "version": "1.0.0",
  "dependencies": {
    "@node/apple-block": "workspace:*"
  },
  "modnet": {
    "contentType": "produce",
    "structure": "list",
    "mechanics": ["sort", "filter"],
    "boundary": "ask",
    "scale": 3
  }
}
```

The `@node` scope is the agent's identity scope. All module packages share this scope. The `workspace:*` protocol resolves inter-module imports via Bun's workspace resolution — standard TypeScript imports, no custom loader.

### Scale Mapping

Scale determines module complexity:

| Scale | Structure | Example |
|---|---|---|
| S1 | JSON data + template | Single `data.json` + one JSX template |
| S2 | Structured data + list rendering | Multiple data files + list component |
| S3 | Multiple files + behavioral code + streams | Full package with `src/`, `data/`, behavioral modules |
| S4+ | Full package with dependencies | Package depending on other workspace packages |

### Code vs. Data Boundary

Each module package separates code from data:

- **`src/`** (or root `.ts` files) — code, bThreads, templates, behavioral modules. Never leaves the node.
- **`data/`** — JSON, assets, structured content. Can cross A2A boundaries, gated by the module's `boundary` tag.

A constitution MAC bThread blocks code from crossing A2A boundaries. When another node requests data from a module with `boundary: "all"` or `boundary: "ask"`, only the `data/` contents are eligible for sharing. The module's code stays internal — the receiving agent generates its own code to process the data.

### Browser Compilation

Bun runs TypeScript natively — no compilation needed for server-side module code. The only compilation step is `Bun.build({ target: 'browser' })` for behavioral modules sent to the client via `update_behavioral`. These are `.behavior.ts` files that the agent compiles on-demand when rendering generative UI.

### Dependency Isolation

Bun workspace resolution handles inter-module imports via symlinks. Each module declares its dependencies in `package.json` and can only import what it declares — standard npm semantics. The single `bun.lock` at the node root tracks the full dependency tree.

### Package Sidecar (`.meta.db`)

Each module contains a `.meta.db` SQLite sidecar — a small database committed to the module's git repo alongside the code it describes. The sidecar is populated by a collector tool that scans source files for branded objects (`$` identifiers) and indexes them for fast lookup.

**Why per-module sidecars (not a central db):**

- **Data ownership aligns with module ownership** — the sidecar travels with the module. When a module is transported to another node, its metadata comes with it.
- **No rebuild-from-source** — the sidecar is pre-indexed. The agent queries it directly without re-scanning source files.
- **Git-diffable provenance** — changes to branded objects produce visible diffs in the sidecar, auditable in git history.
- **No coordination** — each package's sidecar is independent. No lock contention, no merge conflicts across packages.

**Sidecar schema:**

```sql
-- Branded objects discovered by the collector tool
CREATE TABLE branded_objects (
  path       TEXT NOT NULL,           -- relative path within package
  identifier TEXT NOT NULL,           -- brand emoji: 🦄 🪢 🎛️ 🎨 🏛️
  name       TEXT NOT NULL,           -- export name or factory name
  layer      TEXT,                    -- 'mac' | 'dac' (governance factories only)
  metadata   TEXT,                    -- JSON blob for brand-specific fields
  PRIMARY KEY (path, name)
);

-- String constants extracted from source (not hardcoded in templates)
CREATE TABLE constants (
  key        TEXT PRIMARY KEY,        -- constant identifier
  value      TEXT NOT NULL,           -- the string value
  source     TEXT NOT NULL            -- file path where defined
);
```

The `constants` table isolates string values that would otherwise be hardcoded in templates — event type strings, attribute names, error messages. This eliminates an injection vector (the agent cannot redefine constants by editing source) and enables future encryption of sensitive values.

**Workspace-level view (`.workspace.db`):**

A `.workspace.db` at the node root provides cross-module queries by attaching all sidecars:

```sql
-- Rebuilt on workspace init or after package changes
ATTACH 'modules/apple-block/.meta.db' AS apple_block;
ATTACH 'modules/farm-stand/.meta.db' AS farm_stand;

-- Cross-package query: find all governance factories
SELECT * FROM apple_block.branded_objects WHERE identifier = '🏛️'
UNION ALL
SELECT * FROM farm_stand.branded_objects WHERE identifier = '🏛️';
```

The workspace db is ephemeral — it is rebuilt from sidecars, never the other way around. If deleted, it regenerates. If a sidecar is modified, the workspace view reflects the change on next attach.

**Collector tool:**

The collector scans a package's source files, identifies branded objects by their `$` property, and upserts the sidecar. It runs:
- On package creation (agent generates a new module)
- On governance factory changes (new rules added or modified)
- On demand (agent tool call)

The collector is a built-in agent tool — `collect_metadata` — that takes a package path and updates its `.meta.db`. No background daemon, no watch process.

**Engine-agnostic interface:**

SQLite is the initial engine — it's Bun-native (`bun:sqlite`), single-file, zero-config, and matches the access pattern (point queries, single writer, hundreds of rows). The query interface is designed to be engine-agnostic:

- Queries return plain objects, not SQLite-specific cursors
- Schema is simple enough to port to any relational or document store
- If analytical workloads emerge (event log analysis, training data extraction), a columnar engine (DuckDB, chDB) can serve those queries without replacing SQLite for point lookups

The decision on additional engines is deferred until real workload data reveals the need. Start with what's free and boring.

### Asset Management: Symlinks Over Git LFS

Large assets (images, models, datasets) live outside the workspace and are symlinked in. This avoids git repository bloat without the complexity of git LFS:

```
~/assets/                           ← outside workspace, not in git
  farm-photos/
    apple-red.jpg
    apple-green.jpg

workspace/modules/farm-stand/data/
  photos -> ~/assets/farm-photos    ← symlink
```

A constitution bThread enforces symlink integrity:

```typescript
// Asset symlink guard — blocks execute if symlink targets are missing or outside allowed paths
bSync({
  block: ({ type, detail }) => {
    if (type !== 'execute') return false
    return isSymlinkViolation(detail)
  }
})
```

The bThread ensures the agent cannot create symlinks to arbitrary filesystem locations (a security concern in a sandboxed environment). Only symlinks from `data/` directories to the configured asset root are permitted.

### Future: Local Registry Migration

When a workspace grows beyond practical limits for Bun workspaces (hundreds of packages, deeply nested dependency graphs), the migration path is a local npm registry:

1. Deploy a local registry (e.g., Verdaccio) on the node
2. Add a `bunfig.toml` at the node root to point `@node` scope at the local registry
3. Publish packages via `bun publish` instead of `workspace:*` resolution
4. No code changes — imports stay the same, only resolution changes

```toml
[install.scopes]
"@node" = { url = "http://localhost:4873" }
```

### Modules vs. Projects

Modules and projects are distinct concepts with different isolation models:

| Concern | Module | Project |
|---|---|---|
| **What** | Internal package within the node's workspace | External codebase (user's repo) |
| **Git** | Own git repo within `modules/` | Separate git repo, external |
| **Isolation** | Bun workspace dependency isolation | Process isolation (Bun.spawn + IPC) |
| **Scope** | `@node/` scope, workspace:* resolution | Independent, orchestrator-routed |
| **Lifecycle** | Created/modified by agent as workspace packages | Registered on encounter, independent subprocess |

The orchestrator (see `PROJECT-ISOLATION.md`) manages projects as separate subprocesses. Modules are packages within the node's own workspace — they don't need process isolation because they're the agent's own code.

## A2A Protocol

A2A is a transport-agnostic protocol for agent-to-agent communication with three layers:

1. **Canonical Data Model** — Protocol-agnostic core semantics (tasks, messages, artifacts, parts)
2. **Abstract Operations** — Binding-independent behaviors (SendMessage, GetTask, CancelTask)
3. **Protocol Bindings** — Concrete transport (HTTP/REST, JSON-RPC, gRPC)

**Streaming** uses SSE framing (`text/event-stream`) over POST — not GET. The browser's `EventSource` API cannot be used; streaming requires `fetch()` with `ReadableStream`. Each SSE `data:` line contains a JSON-RPC 2.0 response wrapping one of: `task`, `message`, `statusUpdate`, or `artifactUpdate`.

**A2A maps naturally to BP's event model.** Request-response maps to `trigger` → `waitFor`. Streaming maps to SSE events → `trigger()` per event. Push notifications map to inbound webhook → `trigger()`. No separate adapter layer — A2A calls are tool calls flowing through the same Gate → Execute pipeline.

## Identity & Authentication

The framework does not define its own identity system. A2A handles authentication at the protocol layer via standard web security mechanisms. The framework adds a **trust layer** on top.

**What A2A provides:**

| Mechanism | What it does |
|---|---|
| **Agent Card signing (JWS)** | Card is signed with the node's private key. Any peer can verify the card is authentic and untampered. |
| **Security schemes** | Each card declares its required auth via `securitySchemes` — mTLS, OAuth 2.0, API key, HTTP Bearer, or OpenID Connect. Peers read the card to discover what's required. |
| **Extended Agent Card** | Authenticated peers call `get-extended-agent-card` to see additional capabilities. The public card shows broad strokes; the extended card shows detail. |

**What the framework adds:**

| Mechanism | What it does |
|---|---|
| **Known-peers table** | Local trust store — records which peers the owner has approved. Trust-on-first-use (TOFU), like SSH `known_hosts`. |
| **Owner approval** | First connection to a new peer requires owner confirmation (human in the loop). Subsequent connections verify automatically against stored keys. |
| **Access control** | After authentication, BP evaluates every request via DAC + MAC + ABAC (see Access Control below). |

**Known-peers table:**

```sql
CREATE TABLE known_peers (
  public_key  TEXT PRIMARY KEY,   -- the peer's public key (from their Agent Card)
  card_url    TEXT,               -- where to fetch their Agent Card
  name        TEXT,               -- human-readable label
  trust_level TEXT NOT NULL,      -- 'tofu' | 'verified' | 'blocked'
  first_seen  INTEGER NOT NULL,   -- when we first connected
  last_seen   INTEGER             -- last successful interaction
);
```

**First connection flow:**

```
Node B fetches Node A's Agent Card from well-known URL
  → Verifies JWS signature (card is authentic)
  → Reads securitySchemes (e.g., mTLS required)
  → Node B's owner sees: "New peer: Node A. Approve?"
  → Owner approves → public key stored in known-peers
  → mTLS handshake completes (both sides verified)
  → Subsequent connections verify automatically
```

For sovereign nodes in a modnet, **mTLS is the natural fit** — both sides prove identity, no third party needed. For team deployments behind a shared auth server, OAuth 2.0 works. The framework is auth-scheme-agnostic — it reads whatever the peer's card declares.

## Module Discovery: Three Tiers

Module discovery uses the same three-tier model for both local and inter-agent contexts:

| Tier | Mechanism | What's Visible | Jaffe Boundary |
|---|---|---|---|
| **Public Card** | Agent Card at well-known URL | Broad capability categories — "generative UI", "code review" | Minimal — existence and category only |
| **Extended Card** | Authenticated Agent Card (A2A native) | Detailed skills, module categories — curated by owner | `ask` — identity verified, more revealed |
| **Task Negotiation** | SendMessage within a task | "I need form validation — do you have something?" Agent responds dynamically per policy | Contextual — full negotiation scoped to interaction |

The card surfaces broad capabilities. The task flow handles specific module negotiation. Modules are never listed exhaustively in the card — that would violate boundary constraints and leak internal structure.

Discovery **transport** (how you find a card) is deployment-specific: DNS, Bluetooth, QR codes, registries, geofencing for emergent networks. The framework defines how an agent publishes and evaluates cards, not how cards are found.

## Access Control: DAC + MAC + ABAC

Three layers of access control, each serving a different purpose:

| Layer | Model | Who Controls It | What It Does |
|---|---|---|---|
| **Surface** | DAC (Discretionary) | Owner | Sets boundary tags on modules (`all`/`none`/`ask`). Familiar mental model — like Google Drive sharing. |
| **Floor** | MAC (Mandatory) | Constitution bThreads | Constraints the owner **cannot override**. Even with boundary `all`, the constitution blocks sharing credentials, private keys, or modules missing bridge-code. |
| **Evaluation** | ABAC (Attribute-Based) | BP predicates | When boundary is `ask`, evaluates requester attributes + module attributes + context. Owner sets policy; BP enforces deterministically. |

**Why not RBAC?** There are no fixed roles between sovereign nodes. Trust between agents is contextual — the same agent might be a trusted peer in one network and unknown in another. Attributes (what the requester's card declares, what the module's tags say, what context this request is in) are the right evaluation basis.

**How the layers compose:**

```
Owner sets boundary: "all"
  → DAC: approved
  → MAC (constitution): blocks sharing of credentials module (mandatory)
  → Result: everything shared EXCEPT what the constitution protects

Owner sets boundary: "ask" + approves peer
  → DAC: approved
  → MAC: no mandatory block
  → ABAC: evaluates peer's card attributes against module boundary policy
  → Result: shared if attributes match policy

Owner sets boundary: "none"
  → DAC: blocked
  → No further evaluation needed
```

The MAC layer uses the same ratchet principle as the local constitution — mandatory bThreads only add, never remove. The security floor only rises.

**BP is the single policy engine.** The same `block` predicates that govern local tool execution govern inter-agent module sharing:

```typescript
bSync({
  block: ({ type, detail }) => {
    if (type !== 'share_module') return false
    const mod = getModule(detail.moduleId)
    const requester = detail.requesterCard

    // MAC: constitution blocks credentials regardless of owner setting
    if (mod.contentType === 'credentials') return true

    // DAC: owner's boundary decision
    if (mod.boundary === 'none') return true

    // ABAC: evaluate requester attributes when boundary is 'ask'
    if (mod.boundary === 'ask') {
      return !evaluatePolicy(requester, mod, detail.context)
    }

    return false
  }
})
```

## Payment (x402)

Payment is an essential feature of the modnet. Approval contingent on payment is normal for any content on the web — the modnet simply makes it machine-negotiable.

[x402](https://github.com/coinbase/x402) layers directly on HTTP via the `402 Payment Required` status code. Since A2A uses HTTP as its transport, x402 composes without a protocol bridge:

```
Agent A sends A2A request to Agent B
  → B evaluates access control (DAC + MAC + ABAC)
  → B determines this service requires payment
  → B returns HTTP 402 with x402 payment requirements header
  → A receives 402 → trigger({ type: 'payment_required', detail })
  → A's BP blocks until owner confirms payment
  → Owner approves → payment executes on-chain
  → A retries request with payment proof header
  → B verifies payment → processes request → returns result
```

**Payment is bidirectional.** A node can both charge for its services (selling) and pay for others' services (buying). The same agent that charges for module generation might pay another agent for specialized training data or domain knowledge.

**Payment as ABAC attribute.** In the access control model, payment status becomes another attribute the ABAC layer evaluates:

```typescript
bSync({
  block: ({ type, detail }) => {
    if (type !== 'share_module') return false
    const mod = getModule(detail.moduleId)

    // ABAC: module requires payment and payment not verified
    if (mod.boundary === 'paid' && !detail.paymentVerified) return true

    return false
  }
})
```

The boundary taxonomy extends naturally:

| Boundary | Meaning |
|---|---|
| `all` | Share freely |
| `ask` | Evaluate requester attributes |
| `paid` | Requires verified x402 payment |
| `none` | Never share |

**Owner approval maps to existing patterns.** The `payment_required` event follows the same human-in-the-loop flow as any other BP-gated action. No new approval mechanism needed — it's the same `trigger()` → bThread → owner confirmation flow used everywhere else.

## Inter-Agent Task Flow

When Agent A wants to work with Agent B's module:

1. **A sends a task** via A2A SendMessage — "I need validation for these form fields"
2. **A's BP evaluates the outbound request** — authority constraints, boundary checks
3. **B receives the task** — B's BP evaluates the inbound request via access control layers (DAC + MAC + ABAC)
4. **B's module processes internally** — the module is never exposed
5. **B returns artifacts** via streaming — generated code, validation result, whatever the module produces
6. **A receives artifacts** — SSE events become `trigger()` calls, bThreads process results

For **module transfer** (sending the module itself, not just output) — a higher-trust operation. Both agents' BP engines must approve: B's outbound sharing policy and A's inbound installation policy. Owner confirmation required on both sides.

## Modnet vs. Platform

| Property | Platform (centralized) | Modnet (Plaited) |
|---|---|---|
| **Data ownership** | Platform holds user data | User's agent holds user data |
| **Cost scaling** | Linear with usage (API calls) | Fixed per node regardless of usage |
| **Failure mode** | Platform down = all users affected | One node down = one user offline |
| **Composition** | Platform APIs, vendor lock-in | A2A protocol, agent-to-agent |
| **Training data** | Platform captures trajectories | User owns their trajectories |
| **Access control** | Platform-defined RBAC | Owner DAC + constitution MAC + BP ABAC |
| **Payment** | Platform billing (subscriptions, metered) | Per-request x402 between nodes (bidirectional) |

The framework ships primitives for building modnet nodes. It does not operate a modnet. Consumers deploy their own agents, publish their own Agent Cards, and connect to whichever peers they choose.
