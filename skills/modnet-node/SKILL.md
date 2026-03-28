---
name: modnet-node
description: Modnet node architecture — node topology, A2A protocol bindings, access control patterns, and supporting workspace/reference structure. Use when building modnet nodes, configuring A2A transports, implementing access control, or reviewing node-level design constraints.
license: ISC
compatibility: Requires bun
---

# Modnet Node

## Purpose

This skill teaches agents how to build and configure modnet nodes: sovereign agent
instances that communicate peer-to-peer via A2A. It covers the active node surface:
A2A protocol bindings for different deployment contexts, node/module boundary rules,
access control (DAC + MAC + ABAC) code patterns, and reference architecture for
workspace and enterprise layouts.

**Use when:**
- Building a new modnet node or reviewing node topology
- Configuring A2A transport for a deployment context (same-box, same-cluster, cross-network)
- Implementing access control policies (boundary tags, block predicates, payment gating)
- Wiring identity and authentication between nodes (known-peers, TOFU, mTLS)
- Reviewing workspace structure, module boundaries, or enterprise node roles

**Not for:** Local user authentication to a node (that's `node-auth` skill).

## Key Concepts

A **modnet** (modular network) is a network of user-owned nodes connected peer-to-peer via A2A. Each node is one agent serving one user. There is no central server, no shared tenancy, no platform operator.

- **Modules** are internal artifacts (code, data, tools, skills, bThreads) inside the agent. They never cross A2A boundaries directly — only services and artifacts cross.
- **Agent Card** is the node's public entry point — a projection of capabilities, not an inventory of internals.
- **Constitution** (MAC bThreads) defines what the node cannot do. Modules define what it can do. The role is the structure.
- **Node identity** is structural: constitution + modules + Agent Card + DAC configuration. Skills are operational tools, not identity.

## Node Topology

A modnet uses a **1 node : 1 user** topology. Each node is one Plaited agent
serving one owner. There is no central server, no shared tenancy, and no platform
operator in the middle.

- each node owns its own memory, constitution, and Agent Card
- nodes cooperate through A2A rather than by sharing internal packages directly
- nodes can participate in multiple networks at once
- if one node goes offline, that node disappears from the network without taking
  other nodes down with it

This is a network of sovereign agents, not a multi-user agent platform.

## Module Boundary Model

Modules are internal node artifacts: code, data, skills, tools, bThreads, and local
memory. They do not cross A2A boundaries directly. Nodes expose **services** and
**artifacts** through the Agent Card and A2A operations; the underlying module stays
internal unless a higher-trust transfer path is explicitly approved.

That distinction matters for both identity and safety:

- the Agent Card projects capabilities, not internals
- outputs can cross the boundary
- module internals remain node-local by default
- constitution and access-control rules apply at the service/artifact boundary

## Workspace Structure

The module-per-workspace layout is preserved as a reference architecture, not a claim
that a single scaffolding API is the current operator surface. Use
[module-architecture.md](references/module-architecture.md) for:

- node and module directory layout
- `@node` package scope and `workspace:*` resolution
- module-level git history inside the node workspace
- code-vs-data boundary rules
- metadata and asset-management conventions

### Module package.json Manifest

MSS tags live in the `"modnet"` field, validated by `ModnetFieldSchema` from `src/modnet/modnet.schemas.ts`:

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

### Seed Skill Metadata

Each module generates a seed skill with MSS metadata as SKILL.md frontmatter fields for PM discovery:

```yaml
---
name: farm-stand
description: Seed skill for the farm-stand module
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

The PM reads `skills/*/SKILL.md` frontmatter to find modules by `contentType`, `scale`, or `produces`/`consumes` relationships — no sidecar database needed.

## A2A Protocol Bindings

### Composing a Node with A2A

`createNode` from `src/modnet/create-node.ts` composes agent loop + server + A2A into a running node:

```typescript
import { createNode } from '../modnet/create-node.ts'
import type { AgentCard } from '../a2a/a2a.schemas.ts'

const card: AgentCard = {
  name: 'Farm Agent',
  url: 'https://farm.example.com',
  version: '1.0.0',
  capabilities: { streaming: true },
  skills: [{ id: 'produce-lookup', name: 'Produce Lookup' }],
  metadata: {
    'modnet:role': 'worker',
    'modnet:mss:contentType': 'produce',
    'modnet:mss:boundary': 'ask',
    'modnet:protocolVersion': '1.0.0',
  },
}

const node = await createNode({
  model,           // Model.reason() interface
  tools,           // ToolDefinition[]
  toolExecutor,    // local, SSH, or A2A executor
  constitution,    // ConstitutionFactory[] (MAC bThreads)
  goals,           // GoalFactory[] (goal bThreads)
  memoryPath: '/home/user/my-node/.memory',
  port: 3000,
  tls: { cert, key, ca },
  agentCard: card,          // enables A2A routes
  a2aAuthenticate: async (req) => {
    // verify mTLS client cert or bearer token
    return req.headers.get('x-client-id') ?? undefined
  },
})

// node.agent — AgentNode (trigger, subscribe, destroy)
// node.server — ServerHandle (port, send, stop)
// node.a2a — { routes } (present when agentCard provided)
// node.destroy() — tears down both
```

### Handler Factory (Lower-Level)

For custom composition without `createNode`, use `createA2AHandler` directly from `src/a2a/create-a2a-handler.ts`:

```typescript
import { createA2AHandler } from '../a2a/create-a2a-handler.ts'
import { createServer } from '../server/server.ts'

const { routes } = createA2AHandler({
  card: agentCard,             // AgentCard | (() => AgentCard)
  handlers: {
    async sendMessage(params, signal) {
      // Required — process A2A task, return Task or Message
      return { kind: 'task', id, status: { state: 'completed' }, artifacts }
    },
    // Optional handlers: sendStreamingMessage, getTask, cancelTask,
    // subscribeToTask, getExtendedAgentCard, set/get/list/deletePushConfig
  },
  authenticate: async (req) => { /* returns identifier or throws */ },
})

// Merge A2A routes with other routes in Bun.serve()
const server = createServer({
  trigger: agent.trigger,
  routes: { ...routes, ...otherRoutes },
  port: 3000,
})
```

### Transport Selection by Deployment

Transport is **per-interaction, not per-node.** Use `createA2AClient` from `src/a2a/create-a2a-client.ts`:

```typescript
import { createA2AClient } from '../a2a/create-a2a-client.ts'

// Same-box (k8s pod, docker-compose) — unix socket
const local = createA2AClient({
  url: 'http://localhost',
  unix: '/tmp/a2a.sock',
})

// Same-cluster (k8s services) — mTLS
const cluster = createA2AClient({
  url: 'https://registry.internal:8443',
  tls: { cert, key, ca },
})

// Cross-network (sovereign nodes) — mTLS over internet
const remote = createA2AClient({
  url: 'https://peer.example.com',
  tls: { cert, key, ca },
  headers: { 'X-Node-Id': 'farm-agent' },
})

// All clients share the same interface
const result = await remote.sendMessage({
  message: { role: 'user', parts: [{ kind: 'text', text: 'List produce' }] },
})
const card = await remote.fetchAgentCard()
remote.disconnect()
```

See [a2a-bindings.md](references/a2a-bindings.md) for transport selection tables, interaction strategy, and the full Bun networking surface.

## Access Control

Three layers compose to gate every cross-boundary request:

1. **DAC (Surface)** — Owner sets boundary tags on modules (`all`/`none`/`ask`/`paid`)
2. **MAC (Floor)** — Constitution bThreads enforce constraints the owner cannot override
3. **ABAC (Evaluation)** — When boundary is `ask`, BP predicates evaluate requester + module + context

### Block Predicates

BP is the single policy engine. The same `block` predicates that govern local tool execution govern inter-agent module sharing:

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

### Payment Gating (x402)

The `paid` boundary can use HTTP 402 / x402-style payment proofs as an ABAC input.
Treat this as an optional access-control extension, not a guaranteed active runtime
surface in every deployment. Payment status is modeled as an ABAC attribute:

```typescript
bSync({
  block: ({ type, detail }) => {
    if (type !== 'share_module') return false
    const mod = getModule(detail.moduleId)
    if (mod.boundary === 'paid' && !detail.paymentVerified) return true
    return false
  }
})
```

### Known-Peers Trust Store (TOFU)

Identity uses TOFU (trust-on-first-use) via `createPeerStore` from `src/a2a/peers.ts`:

```typescript
import { createPeerStore, TRUST_LEVEL } from '../a2a/peers.ts'

const peers = createPeerStore('/home/user/my-node/.memory/known-peers.json')

// First encounter — add with TOFU trust
const peer = await peers.addPeer(remoteCard, remotePublicKey)
// peer.trustLevel === 'tofu'

// Owner explicitly verifies
await peers.updateTrust(remoteCard.url, TRUST_LEVEL.verified)

// Subsequent connections — verify stored key matches
const { trusted, reason } = await peers.verifyPeer(remoteCard, remotePublicKey)
// trusted: true, reason: 'verified'

// Revoke trust
await peers.updateTrust(remoteCard.url, TRUST_LEVEL.revoked)
// All future verifyPeer calls return { trusted: false, reason: 'peer_revoked' }
```

Trust levels progress: `untrusted` -> `tofu` -> `verified`, or -> `revoked`.

See [access-control.md](references/access-control.md) for the full TOFU flow, payment integration, boundary taxonomy, and inter-agent task flow.

## Enterprise Topology

Enterprise deployments use a PM/orchestrator node that provisions infrastructure nodes (registry, observer, gateway) and worker nodes via seed skills.

### Node Roles

From `src/modnet/modnet.constants.ts`:

| Role | Constitution (MAC) | Agent Card Declares |
|---|---|---|
| `pm` | Orchestrates work, manages sub-agents | `provisioning`, `coordination` |
| `registry` | Can't read worker data. Can provision/revoke nodes, issue certs | `provisioning`, `directory`, `certificates` |
| `observer` | Can't modify nodes. Can receive/store audit events | `audit`, `compliance`, `tracing` |
| `worker` | Standard agent constraints + org-level MAC | Domain-specific skills |

Metadata keys from `MODNET_METADATA`:

```typescript
import { NODE_ROLE, MODNET_METADATA } from '../modnet/modnet.constants.ts'

const agentCard = {
  // ...
  metadata: {
    [MODNET_METADATA.role]: NODE_ROLE.registry,
    [MODNET_METADATA.constitutionHash]: await hashConstitution(mac),
    [MODNET_METADATA.protocolVersion]: '1.0.0',
  },
}
```

### PM Provisioning Flow

```
BUILD TIME (ephemeral):
  enterprise-genome + Claude Code -> PM node
  genome is archived after generation

PM NODE GENERATES (via registry, using seeds):
  1. PM creates registry node with provisioning MAC
  2. Registry generates observer node (audit MAC)
  3. Registry generates gateway node (federation MAC)
  4. Registry generates worker nodes per employee (standard MAC + org MAC)
  Each seed is discarded after generation — node identity is structural
```

### Enterprise MAC Composition

The org distributes a base constitution that ALL nodes must run. Each role adds constraints:

```typescript
// Org base MAC (all nodes)
const orgBase: ConstitutionFactory[] = [
  enforceAuditLogging,       // all decisions must be logged
  blockCredentialSharing,     // credentials never cross A2A
  requireOrgCert,             // all A2A must use org-issued certs
]

// Registry adds role-specific MAC
const registryMac: ConstitutionFactory[] = [
  ...orgBase,
  blockDataAccess,            // can't read worker module data
  allowProvisioning,          // can provision/revoke nodes
]

// Worker adds role-specific MAC
const workerMac: ConstitutionFactory[] = [
  ...orgBase,
  standardFileSandbox,        // workspace-scoped file access
  standardBashSafety,         // Bun Shell, no rm -rf /
  orgToolRestrictions,        // per org policy
]
```

MAC ratchet principle: org-level bThreads only add constraints, never remove. Workers add DAC preferences on top but cannot weaken the org floor.

See [enterprise-topology.md](references/enterprise-topology.md) for node type specifications, seed lifecycle, multi-client access, and discovery mechanisms.

## Skeleton Generation Guide

When generating a module skeleton from a natural language description, reason in this order: **scale → contentType → structure → mechanics → boundary**.

### Canonical Hard Cases

These are edge cases with non-obvious answers. Apply them directly when the description matches:

| Description pattern | scale | structure | mechanics | Notes |
|---------------------|-------|-----------|-----------|-------|
| Color mixing tool showing blend + palettes | **2** | form | [] | Multiple output sections = S2 even without persistence |
| Calendar with day/week/month views | **3** | steps | track, filter | 3 navigable views = S3 block, not S2 |
| Shared expense tracker (roommates, log + split) | **3** | collection | sort, filter | Organized by person + category = S3. **No `track`** — logging ≠ temporal tracking |
| Two-person turn-based canvas (pass-and-draw) | **4** | form | limited-loops | Spatial arrangement of two S3 blocks = S4 |

### Scale: S2 vs S3 vs S4

The most common error is assigning S2 when the module is actually S3 or S4.

**S2 = One group of items.** A single organized collection, list, form, or tracker with no internal sub-groups.
- Examples: recipe collection, workout log, budget tracker, plant diary, wine collection
- A stateless tool that produces **multiple simultaneous output items** is S2 — the outputs form a group of objects, even without data persistence.
  - **S1 form**: single output (a format converter → one converted result = S1)
  - **S2 form**: rich output panel with **multiple simultaneous outputs grouped together**. Example: A color mixer that shows the blend result + complementary palette + analogous palette in the same output view = S2. The multiple palette outputs form an object group, even if stateless.
  - **The decisive rule:** Does the tool display multiple *categories* of output items (blend + palettes + color values together)? → S2. Does it display one converted/calculated result? → S1.

**S3 = Multiple groups combined into an interactive block.**
- Signal: "combining X, Y, and Z" — health overview combining step count + sleep + heart rate = three groups = S3
- Signal: "multiple views / modes" — a **personal calendar with day, week, and month views** = S3 (`steps` structure). The three navigable view modes compose into a multi-mode block. Note: `steps` is valid at both S2 (simple 2-step sequence) and S3 (3+ navigable modes). **3 distinct view modes = S3, not S2.**
- Signal: "map with categories of markers" — a city map with restaurants/parks/landmarks organized in categories = S3 (map block with category groups)
- Signal: "organized by person and category in a shared context" — shared expense tracker = S3 (multiple axes)
- Signal: "dashboard" combining multiple data types = S3
- **Rule of thumb:** If you can describe the module as "a block that *contains* multiple groups" — it's S3, not S2.

**S4 = Spatial arrangement of multiple S3 blocks between participants.**
- Signal: "two participants taking turns / passing back and forth" — each participant has a block, arranged spatially = S4
- Example: two-person turn-based collaborative canvas where each person's workspace is a block

**Quick test:** Count how many distinct *groups* the module contains. One group → S2. Multiple groups combined into one interactive space → S3. Multiple blocks arranged between participants → S4.

### ContentType Defaults

When a module doesn't match an obvious domain keyword, apply these rules:

| Module type | → contentType |
|-------------|---------------|
| Fitness/workout/exercise/gym trackers | `health` (never `tools` — body/exercise is always health domain) |
| Personal organization tool for **non-body content** (recipe book, plant diary, wine collection) | `tools` |
| Nature observation, field notes, birdwatching, scientific study | `science` |
| Collaborative **creative** exchange between specific participants (turn-based, pass-and-draw) | `play-cocreation` |
| Hobby management that is primarily an organizational tool | `tools` |

**Never use boundary values as contentType.** The values `"all"`, `"none"`, `"ask"`, `"paid"` are boundary values — they are never valid contentType values. If you're tempted to write `"none"` as contentType, you have confused the two fields.

**Hyphenated contentType:** Use `play-cocreation` (not `art`, not `play`) specifically for turn-based collaborative creative tools where participants exchange control. `play` is for solo games; `art` is for individual creative work; `play-cocreation` is for co-creation between partners.

### Mechanics: When to Tag `track`

`track` applies when the module contains **temporal data that changes over time**, including:
- User-recorded data across sessions (logs, diaries, trackers, history)
- External data that **auto-refreshes** (weather readings, live metrics, stock prices)

A weather display that "refreshes periodically" = `track` (temporal external data, even if user doesn't write it).

**Conservative tagging:** Only add mechanics the description explicitly names or directly implies. If the description doesn't mention sorting, don't add `sort` even if it seems useful. A calendar with events does *not* imply `sort` — events are filtered and tracked, not sorted by user action.

**`share` mechanic:** Tag `share` when the description explicitly mentions sharing files, links, or content with others. "Members can share file links" = `share`. If boundary is `ask` or `all` and the description involves sending/attaching files or links to others in a stream — include `share`.

**`limited-loops` mechanic:** Tag `limited-loops` when participants alternate turns and cannot act again until the other responds. Trigger phrases: "take turns", "passes to the other", "one person draws then the other", "turn-based". A two-person collaborative tool where "one person acts then passes to the other" = `limited-loops`.

### Boundary: `ask` vs `all` for Viewable Content

- `all` = **publicly accessible without any action** — no login, no consent, no request needed
- `ask` = viewing requires **user consent or explicit request** — "upon request", "with consent", "must join", "need to be added"

"Visitors can view it **upon request**" → `ask` (consent is required before data flows, even if unauthenticated).

### Structure: `collection` vs `list` vs `pool`

- `collection` = items **grouped by category** (flat grouping, no nesting) — expenses by category, metrics side-by-side, cuisine groupings
- `list` = items in a **defined order/sequence** — ordered queue, priority-ranked, chronological
- `pool` = **hierarchical browsing** — folders within folders, nested categories, drill-down navigation

"Expenses across categories (dining, transport, bills)" → `collection` (grouped flat, no inherent order between categories).
"An ordered list of movies by priority" → `list` (sequence matters).
"Health metrics displayed side-by-side in one view" → `collection` (flat grouping of metrics — NOT `pool` which requires nesting).
"Map with markers categorized into restaurants, parks, landmarks" → `collection` (flat category grouping — the categories are side-by-side groups, not nested. Maps with categorical filters use `collection`, not `pool`).
"Folders within folders / nested sub-categories" → `pool` (hierarchical browsing only). `pool` = drill-down navigation, NOT flat categories.

**Critical distinction:** Category filters ("show only restaurants") = flat grouping = `collection`. Nested folders-in-folders = hierarchical = `pool`. When in doubt: is there drill-down navigation where clicking a category reveals sub-categories? If no sub-categories → `collection`.

- `form` = the **primary interaction is creation/input** — users draw, type, calculate, or compose. A collaborative drawing canvas where each turn involves drawing = `form`. Even if content accumulates over turns, if the UX is about *creating*, it's `form`. A drawing canvas is NOT a `collection` of drawings — it's a single shared canvas where users actively input strokes.

---

## Composition Guide

When generating **two-module compositions** (inner + outer), apply these rules AFTER the single-module Skeleton Generation Guide rules.

### Rule: Outer Mechanics — Structure-Dependent Inheritance

The outer module declares mechanics that are **directly operable at its own structural level**. Apply these rules:

**`track` on outer:** Only when the outer's own description involves monitoring ongoing/live data streams.
- Outer "fitness dashboard groups workout log, step count, and sleep quality" → the step count and sleep quality are live ongoing metrics the outer aggregates → `track`
- Outer "wellness workspace arranging health overview + mood journal + meditation log" → the mood journal and meditation log are daily ongoing records → `track`
- Outer "research dashboard combining birdwatching log, weather data, notes" → aggregating historical records for analysis (not live monitoring) → NO `track`

**`chart` on outer:** Only when the outer itself has chart visualizations in its description ("combined view — charts for each metric", "trend charts and filtering").

**`sort` and `filter` on `collection` outer:** A `collection` outer that aggregates multiple distinct data types typically supports both `sort` and `filter` — users sort/filter across the combined view.

**`sort` on `steps` outer:** NO. You navigate between predefined steps, you don't reorder them. A `steps` outer may inherit `filter` (filter which step/view to show), but never `sort`.

**`share` mechanic:** ONLY when the description explicitly mentions a user-facing export/sharing action ("share pieces externally", "members can share file links", "share with clients"). Do NOT add `share` just because boundary=`ask` and "sharing" appears. Boundary=`ask` already handles consent-based data access — "the research dashboard can share findings with a collaborating team with consent" is just the `ask` boundary, not a `share` mechanic.

**Examples:**
- Inner: birdwatching log with `track`, `filter`. Outer: "research dashboard combining log, weather data, and notes — grouped collection with charts. Can share findings with team with consent." → outer has `chart` (visualizes data), `filter` (explicit), `sort` (collection of heterogeneous data). No `track` (historical aggregation, not live monitoring). No `share` (just boundary=`ask`).
- Inner: workout log with `track`, `chart`. Outer: "fitness dashboard groups workout log, step count, sleep quality — charts for each metric, filtered by type. Requires consent to share with doctor." → outer has `track` (aggregates live step count + sleep quality streams), `chart` (explicit), `filter` (explicit). No `share` (doctor access = just `ask` boundary).

### Rule: Inner Auto-Refreshing S1 Objects Get `track`

An S1 display card that "updates automatically", "refreshes with each new measurement", or shows live/current data → `track` mechanic, even though it's just a display card.

- "Blood pressure reading card that updates automatically with each new measurement" → `mechanics: ["track"]`
- "Current weather card showing live temperature" → `mechanics: ["track"]`
- Contrast: "flashcard showing word + translation" (static, no refresh) → `mechanics: []`

### Rule: `form` vs `collection` for Trackers

`form` structure = the primary UI is the INPUT/ENTRY interface itself (the form IS the module).
- "Personal blood pressure tracker that stores each reading over time, shows trends as line chart" → `form` (the primary UX is recording each reading)
- "Workout log — form where I record exercises, sets, reps, and weight. Charts show progress." → `form`

`collection` structure = items are organized BY CATEGORY (the category grouping IS the primary view, even if you can add new entries).
- "Personal expense tracker — expenses organized by category (dining, transport, bills) with trend charts and filters" → `collection` (category grouping is the primary view, not the entry form)
- "Expenses across categories" = the categories ARE the structure → `collection`

**Key test:** Is the module primarily a VIEW of organized categories? → `collection`. Or primarily the entry/input screen itself? → `form`.

### Rule: Don't Add `track` to Static Sorted Lists

A sorted list or collection that doesn't change over time → no `track`.
- "Study deck sorted by difficulty" → `mechanics: ["sort"]` (no track — the flashcards don't auto-update)
- "Recipe collection filterable by ingredient" → `mechanics: ["filter"]` (no track)

### Rule: Include `sort` When Description Implies User Reordering

`sort` when the description mentions sorting by attribute OR when items are explicitly "organized by [non-temporal category] + user can reorder":
- "expenses organized by category (dining, transport, bills) with filters" = `filter` (sort by category alone ≠ user reordering → no `sort`)
- "expenses... sort by amount or date" = `sort` (explicit)
- "trend charts and filters" only → no `sort`

### Canonical Composition Hard Cases

These require non-obvious contentType, scale, or mechanics choices. Apply directly:

| Description pattern | inner | outer |
|---------------------|-------|-------|
| Personal reading journal (form-based daily reactions/reflections) → study group discussion thread | contentType: **education-study** | contentType: **education-discussion** |
| Vocabulary flashcard card → personal study deck sorted by difficulty | contentType: `education` | contentType: **education** (NOT `education-study` — a sorted flashcard list is generic education, not personal reflection writing) |
| Project coordination workspace spatially arranging calendar + task board + invoice log; "The coordination space requires consent to **share with clients**" | inner is `tools` | outer contentType: **work-coordination**, mechanics: `["sort","filter","share"]`, scale: **4** — **`share` is required** because "share with clients" = user actively shares workspace access with an external person (a client-facing sharing action, not just internal consent) |
| Health overview combining 3 metrics (step count + sleep + heart rate), grouped view with trend charts | — | scale: **3** (three data groups = S3 block) |
| Wellness workspace arranging health overview + mood journal + meditation log side-by-side | inner scale: 3, has `chart` | outer scale: **4**, mechanics: `["track","filter"]` — track (daily journals = ongoing data), filter (by area), but **NO `chart`** (charts are in the inner health overview, not the outer arranger) |
| Kitchen management hub navigating between recipe browsing, grocery shopping, meal planning | inner is recipe book `["filter","sort"]` | outer structure: `steps`, mechanics: `["filter"]` only — **NO `sort`** (steps structure navigates between views, doesn't sort them) |
| Field research dashboard combining birdwatching log + weather + observation notes into grouped collection with charts; can share findings with team with consent | inner has `track`, `filter` | outer: `["filter","sort","chart"]` — chart (explicit "collection with charts"), **sort** (combining heterogeneous data types: log + weather + notes = users sort by type/date), filter (explicit). **NO `track`** — even though weather data is live, the outer dashboard is a COMPILATION VIEW for analysis, not a live monitor. The outer aggregates historical records for research, period. No `share` (team consent access = `ask` boundary, not user-facing export) |
| Personal expense tracker (expenses by category with trend charts and filters) → shared household budget board (combines roommate spending by category and person) | inner mechanics: **`["track","chart","filter","sort"]`** — sort implied for finance collections (users sort by date/amount) | outer mechanics: **`["sort","filter"]`** — sort (group by person+category), filter. **NO `track`** (outer views collected spending, doesn't monitor live streams). **NO `chart`** (outer doesn't have its own charts) |

**education-study** vs **education-discussion** vs **education:**
- `education-study` — personal **writing-based reflection tool** (reading journal, practice diary, daily reactions to texts, reflective writing tracker). The user WRITES personal thoughts/reflections. NOT for flashcard decks or quiz tools.
- `education-discussion` — group discussion space (forum thread, peer replies, students posting to a shared space). Content involves multiple participants interacting.
- `education` — all other education modules: flashcard decks, quiz builders, vocabulary study, course content, study tools that don't involve personal reflection writing.

**work-coordination:** Use for workspaces that *spatially arrange multiple work tools* (calendar + task board + document log + invoice) into a coordination hub. Not just `work` (which is for individual work tasks). Signal: "coordination workspace", "arranges alongside", "project suite with multiple tools".
- work-coordination outer mechanics: `sort` (users reorder tasks/items), `filter` (filter by type/status), `share` (explicit "requires consent to share with clients" → `share` mechanic when client-facing sharing is described as a user action).
- The `share` mechanic applies here because clients actively receive shared access — this is an explicit interactive sharing action, not just internal consent-gated access.

**Scale cap — NEVER exceed S4 in compositions:**
The schema hard cap is scale=4. If a "coordination workspace" or "project suite" spatially arranges blocks, it is S4, NOT S5. Do not assign scale=5 under any circumstances. If your analysis leads to S5, assign S4.

---

## Related Skills

- **mss** — MSS tag definitions, composition rules, valid combinations
- **node-auth** — User authentication to a node (WebAuthn, JWT, OIDC)
- **behavioral-core** — BP engine that drives access control and the agent loop
- **agent-loop** — The 6-step agent pipeline nodes run
- **constitution** — Governance factories for MAC/DAC rules
- **generative-ui** — Server-driven UI the node renders
- **varlock** — AI-safe environment configuration for node secrets

## Related Code

- `src/a2a/` — A2A protocol implementation (schemas, server, client, utils, peers)
- `src/modnet/modnet.constants.ts` — `NODE_ROLE`, `MODNET_METADATA` constants
- `src/modnet/modnet.schemas.ts` — `ModnetFieldSchema`, `BoundarySchema`, `ScaleSchema`
- `src/modnet/workspace.ts` — `initNodeWorkspace`, `initModule`
- `src/modnet/node.ts` — `createNode` (agent loop + server + A2A composition)
- `src/modnet/node.types.ts` — `CreateNodeOptions`, `NodeHandle`
- `src/server/` — `createServer` with `validateSession` seam
