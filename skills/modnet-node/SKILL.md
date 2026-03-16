---
name: modnet-node
description: Modnet node architecture — module-per-repo structure, A2A protocol bindings, access control patterns, enterprise topology, and node generation via seeds. Use when building modnet nodes, configuring A2A transports, implementing access control, or provisioning enterprise networks.
license: ISC
compatibility: Requires bun
---

# Modnet Node

## Purpose

This skill teaches agents how to build and configure modnet nodes — sovereign agent instances that communicate peer-to-peer via A2A. It covers the full implementation surface: module-per-repo workspace structure, A2A protocol bindings for different deployment contexts, access control (DAC + MAC + ABAC) code patterns, and enterprise network provisioning via seeds.

**Use when:**
- Building a new modnet node (setting up the module-per-repo workspace)
- Configuring A2A transport for a deployment context (same-box, same-cluster, cross-network)
- Implementing access control policies (boundary tags, block predicates, payment gating)
- Provisioning enterprise infrastructure (registry, observer, gateway, worker nodes)
- Wiring identity and authentication between nodes (known-peers, TOFU, mTLS)

**Not for:** Local user authentication to a node (that's `node-auth` skill). Design rationale and conceptual models (that's `docs/MODNET-IMPLEMENTATION.md`).

## Key Concepts

A **modnet** (modular network) is a network of user-owned nodes connected peer-to-peer via A2A. Each node is one agent serving one user. There is no central server, no shared tenancy, no platform operator.

- **Modules** are internal artifacts (code, data, tools, skills, bThreads) inside the agent. They never cross A2A boundaries directly — only services and artifacts cross.
- **Agent Card** is the node's public entry point — a projection of capabilities, not an inventory of internals.
- **Constitution** (MAC bThreads) defines what the node cannot do. Modules define what it can do. The role is the structure.
- **Node identity** is structural: constitution + modules + Agent Card + DAC configuration. Skills are operational tools, not identity.

## Workspace Initialization

Use `initNodeWorkspace` from `src/modnet/workspace.ts` to create a new node:

```typescript
import { initNodeWorkspace } from '../modnet/workspace.ts'

await initNodeWorkspace({
  path: '/home/user/my-node',
  scope: '@mynode',
  name: 'personal-agent',
})
```

This creates:
- `package.json` with `"workspaces": ["modules/*"]` and `"modnet": { scope }`
- `tsconfig.json` (strict, ESNext, bundler resolution)
- `.gitignore` excluding `modules/` (each module has its own git)
- `.memory/` with `@context.jsonld`, `sessions/`, `constitution/`
- `modules/` directory (empty, ready for modules)
- Runs `bun install` to initialize the workspace

See [module-architecture.md](references/module-architecture.md) for the full directory layout, scale mapping, code vs. data boundary, dependency isolation, and asset management.

## Module Generation

Use `initModule` to create modules from MSS tags. MSS tags are defined in the `mss-vocabulary` skill — the five bridge-code tags (`contentType`, `structure`, `mechanics`, `boundary`, `scale`) govern how modules connect, nest, and share data.

```typescript
import { initModule } from '../modnet/workspace.ts'

await initModule({
  nodePath: '/home/user/my-node',
  name: 'farm-stand',
  modnet: {
    contentType: 'produce',
    structure: 'list',
    mechanics: ['sort', 'filter'],
    boundary: 'ask',
    scale: 3,
  },
})
```

This creates under `modules/farm-stand/`:
- Own `git init` (independent version history from the node)
- `package.json` with `@node/farm-stand` name and MSS `"modnet"` field
- `skills/farm-stand/SKILL.md` — seed skill with MSS metadata in frontmatter
- `.memory/sessions/` — module-scoped decision history
- `data/` — shareable data directory (gated by `boundary` tag)
- Runs `bun install` at node root to link the new workspace package

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

`createNode` from `src/modnet/node.ts` composes agent loop + server + A2A into a running node:

```typescript
import { createNode } from '../modnet/node.ts'
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

For custom composition without `createNode`, use `createA2AHandler` directly from `src/a2a/a2a.server.ts`:

```typescript
import { createA2AHandler } from '../a2a/a2a.server.ts'
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

Transport is **per-interaction, not per-node.** Use `createA2AClient` from `src/a2a/a2a.client.ts`:

```typescript
import { createA2AClient } from '../a2a/a2a.client.ts'

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

The `paid` boundary uses HTTP 402 with x402 headers. Payment status is an ABAC attribute:

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

Identity uses TOFU (trust-on-first-use) via `createPeerStore` from `src/a2a/a2a.peers.ts`:

```typescript
import { createPeerStore, TRUST_LEVEL } from '../a2a/a2a.peers.ts'

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

## Related Skills

- **mss-vocabulary** — MSS tag definitions, composition rules, valid combinations
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
