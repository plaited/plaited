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

The node directory is a git repo (`.gitignore` excludes `modules/`). Each module in `modules/` has its own `git init`. This gives two layers of version history: node-level (constitution, global config, node `.memory/`) and module-level (code, data, module `.memory/`). OS-level backups capture `.git` folders. Bun workspace resolution (`workspace:*`) works regardless of whether subdirectories have `.git/`.

### Node Structure

```
node/                               ← git repo (.gitignore excludes modules/)
  .git/
  .gitignore                        ← modules/
  .memory/                          ← node-level decisions (session coordination, cross-module)
    @context.jsonld
    sessions/
    constitution/
  package.json                      ← "workspaces": ["modules/*"], "private": true
  bun.lock                          ← human-readable lockfile
  tsconfig.json
  modules/
    apple-block/                    ← git repo (independent of node .git)
      .git/
      .memory/                      ← module-scoped decisions (tool results, code changes)
        sessions/
      package.json                  ← name: "@node/apple-block", "modnet": { MSS tags }
      skills/
        apple-block/                ← seed skill (named after module)
          SKILL.md                  ← seed body + CONTRACT in metadata
          scripts/                  ← committed generated code
          references/               ← interface.jsonld, decisions.md
          assets/                   ← grading.jsonl (eval criteria)
      data/
        varieties.json
    farm-stand/                     ← git repo (independent of node .git)
      .git/
      .memory/                      ← module-scoped decisions
        sessions/
      package.json                  ← depends on "@node/apple-block": "workspace:*"
      skills/
        farm-stand/                 ← seed skill
          SKILL.md                  ← seed body + CONTRACT in metadata
          scripts/                  ← committed generated code
          references/               ← interface.jsonld
          assets/                   ← grading.jsonl
        price-lookup/               ← additional capability skill
          SKILL.md
          scripts/
      data/
        inventory.json
```

Modules follow the AgentSkills specification. Each module has a `skills/` directory containing a seed skill (named after the module) and optional capability skills. MSS bridge-code tags and CONTRACT fields live in the `metadata` field of SKILL.md frontmatter (arbitrary string key-value pairs, spec-compliant). The PM reads SKILL.md metadata for module discovery, cross-module queries, and dependency resolution — no sidecar database needed.

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

### Module Registry (SKILL.md Metadata)

> **Supersedes:** The `.meta.db` per-module sidecar and `.workspace.db` workspace view documented in earlier revisions. In the C+D module architecture, the PM generates code from specifications it already has — source-file scanning for branded objects is unnecessary.

The PM reads SKILL.md `metadata` fields for module discovery, cross-module queries, and dependency resolution. MSS bridge-code tags (`contentType`, `structure`, `mechanics`, `boundary`, `scale`) and CONTRACT fields (`produces`, `consumes`) are stored as string key-value pairs in the AgentSkills `metadata` field:

```yaml
---
name: farm-stand
description: Produce inventory management with filtering and sorting
metadata:
  contentType: produce
  structure: list
  mechanics: sort,filter
  boundary: ask
  scale: "3"
  produces: inventory-data
  consumes: apple-data
---
```

**Cross-module queries** use the same metadata: the PM scans `skills/*/SKILL.md` frontmatter to find modules by `contentType`, `scale`, or `produces`/`consumes` relationships. No SQLite, no collector tool, no workspace rebuild.

**Validation:** Modules validate with `bunx @plaited/development-skills validate-skill` — the same tool that validates framework skills.

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

### A2A Transport Strategy

The A2A spec (v1.0.0) requires encrypted communication for production but is transport-agnostic. The spec explicitly supports custom protocol bindings, including WebSocket (`protocolBinding: "WEBSOCKET"`). The requirement is **encryption**, not specifically HTTPS — `wss://` satisfies it for WebSocket, and unix sockets need no encryption (traffic never leaves the kernel).

**Bun-native implementation** — no a2a-js dependency. `Bun.serve()` handles all A2A transport needs in a single server: HTTP (JSON-RPC/REST), WebSocket (custom binding for persistent connections), and unix sockets — all with native mTLS support.

```typescript
Bun.serve({
  unix: "/tmp/a2a.sock",          // same-box: k8s pods, docker-compose
  tls: { cert, key, ca },         // cross-network: mTLS
  fetch(req, server) {
    // A2A JSON-RPC/REST endpoints (Layer 3 binding)
    // WebSocket upgrade for persistent A2A + UI
    // Agent Card at /.well-known/agent-card.json
  },
  websocket: {
    // A2A streaming (bidirectional, custom binding)
    // UI controller protocol (generative UI)
  },
})
```

A2A Layers 1 (data model) + 2 (abstract operations) are implemented once. Layer 3 (protocol binding) varies by deployment context and interaction pattern.

**By deployment (wire selection):**

| Deployment | Wire | Security | Bun API |
|---|---|---|---|
| **Same box** (k8s pod, docker-compose) | Unix domain socket | OS-level (no network) | `Bun.serve({ unix })` + `fetch({ unix })` |
| **Same cluster** (k8s services, docker network) | TCP over internal DNS | mTLS via cert-manager/Istio or direct | `Bun.serve({ tls })` + `fetch()` |
| **Cross-network** (sovereign nodes) | TCP over internet | mTLS (`MutualTlsSecurityScheme`) | `Bun.serve({ tls })` + `fetch()` / `new WebSocket()` |

**By interaction pattern (protocol selection):**

| Pattern | Protocol | When |
|---|---|---|
| **One-shot** (query, lookup, single task) | HTTP+JSON POST | Default. Stateless, no connection overhead. |
| **Streaming response** (task progress) | HTTP POST → SSE response (`text/event-stream`) | Standard A2A streaming. NOT `EventSource` (POST-initiated). `fetch()` + `ReadableStream`. |
| **Active collaboration** (multi-turn negotiation) | WebSocket | Persistent bidirectional. Avoids repeated TLS handshake per message. |
| **Async updates** (post-disconnect) | Webhook (HTTP POST back) | A2A native push notifications. |

Transport is **per-interaction, not per-node.** A node can use HTTP for one task and WebSocket for another with the same peer. The Agent Card declares both via `supportedInterfaces`; the client selects based on interaction needs. WebSocket is an optimization for sustained collaboration, not a requirement. HTTP+JSON is the default.

### A2A Interaction Strategy

The five A2A operations compose into a hybrid interaction model — the spec used as designed:

| A2A Operation | Wire | When |
|---|---|---|
| `POST /message:send` | HTTP POST → JSON response | One-shot. Short task, immediate result. |
| `POST /message:stream` | HTTP POST → SSE response | Client wants real-time progress. Connection held until task completes. |
| `POST /tasks/{id}:subscribe` | HTTP POST → SSE response | Client reconnects to in-progress task. Resumes from where it left off. |
| Push notification (webhook) | Agent POSTs to client's registered URL | Client disconnects, gets notified async. Requires client to be a server. |
| WebSocket (custom binding) | Persistent `wss://` connection | Active multi-turn collaboration. Replaces repeated POST + SSE cycles. |

**Typical interaction flow:**

```
1. POST /message:send → taskId + ack           (fire-and-forget)
2. Want real-time? POST /message:stream         (SSE, hold open)
3. Connection drops? POST /tasks/{id}:subscribe (SSE, resume)
4. Don't need real-time? Register webhook       (async POST back)
5. Heavy collaboration? Upgrade to WebSocket    (persistent bidirectional)
```

Each operation is independent — the client picks the right one per interaction. No state machine needed. Every node is already a server (`Bun.serve()`), so receiving webhooks is free.

**K8s same-box optimization:** Pods in the same deployment share a unix socket via `emptyDir` volume mount. Pods in different deployments use k8s Service DNS with mTLS. Same `Bun.serve()`, different wire.

### Bun Networking Surface

All networking primitives available for A2A and internal communication:

| Bun API | Protocol | TLS | Unix Socket | Use For |
|---|---|---|---|---|
| `Bun.serve()` | HTTP + WebSocket server | Yes | Yes | A2A server, UI server, WebSocket upgrade |
| `fetch()` | HTTP client | Yes | Yes | A2A client calls, inference server |
| `Bun.listen()` | Raw TCP server | Yes | Yes | Custom binary protocol (future) |
| `Bun.connect()` | Raw TCP client | Yes | Yes | Custom binary protocol (future) |
| `Bun.udpSocket()` | UDP | No | No | Heartbeats, discovery (future) |
| `Bun.spawn({ ipc })` | IPC (structured clone) | N/A | N/A | PM ↔ sub-agent |
| `new WebSocket()` | WebSocket client | Yes (`wss://`) | No | A2A client to other nodes |

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
