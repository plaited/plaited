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

## Node Structure

A modnet node is a Bun workspace where the root is a git repo and each module in `modules/` has its own `git init`. This gives two layers of version history: node-level and module-level.

Key decisions:
- `@node` scope for all module packages, `workspace:*` resolution
- MSS bridge-code tags (`contentType`, `structure`, `mechanics`, `boundary`, `scale`) in `package.json` `"modnet"` field
- SKILL.md `metadata` for module discovery and cross-module queries (no sidecar database)
- Symlinks for large assets (no git LFS)
- Code never crosses A2A boundaries; only `data/` contents are eligible for sharing

See [module-architecture.md](references/module-architecture.md) for the full directory layout, package.json manifest, scale mapping, code vs. data boundary, dependency isolation, asset management, and module registry.

## A2A Protocol Bindings

A2A has three layers: canonical data model, abstract operations, and protocol bindings. Layers 1+2 are implemented once. Layer 3 varies by deployment context and interaction pattern.

The existing implementation is in `src/a2a/`:
- `a2a.schemas.ts` — Layer 1 (data model: Parts, Messages, Tasks, Artifacts, Agent Card)
- `a2a.types.ts` — Layer 2 (abstract operations: server handlers, client interface)
- `a2a.server.ts` + `a2a.client.ts` — Layer 3 (HTTP+JSON-RPC binding)
- `a2a.utils.ts` — SSE encoding/parsing, JSON-RPC framing, Agent Card JWS signing

Transport is **per-interaction, not per-node.** A node can use HTTP for one task and WebSocket for another with the same peer. The Agent Card declares both via `supportedInterfaces`; the client selects based on interaction needs.

See [a2a-bindings.md](references/a2a-bindings.md) for transport selection tables, `Bun.serve()` configuration, interaction strategy, and the full networking surface.

## Access Control

Three layers compose to gate every cross-boundary request:

1. **DAC (Surface)** — Owner sets boundary tags on modules (`all`/`none`/`ask`/`paid`)
2. **MAC (Floor)** — Constitution bThreads enforce constraints the owner cannot override
3. **ABAC (Evaluation)** — When boundary is `ask`, BP predicates evaluate requester + module + context

Identity uses TOFU (trust-on-first-use) like SSH `known_hosts`. First connection to a new peer requires owner confirmation. Subsequent connections verify automatically against stored keys.

See [access-control.md](references/access-control.md) for BP block predicates, known-peers schema, TOFU flow, payment integration (x402), boundary taxonomy, and the inter-agent task flow.

## Enterprise Topology

Enterprise deployments use a PM/orchestrator node that provisions infrastructure nodes (registry, observer, gateway) and worker nodes via seed skills.

Node generation lifecycle:
1. **Bootstrap** — Enterprise genome generates PM node (one-shot, genome archived)
2. **Infrastructure** — PM uses registry to provision infrastructure nodes
3. **Workers** — PM uses registry to provision worker nodes per employee
4. **Evolution** — PM pulls new seeds to add node types
5. **Ongoing** — PM monitors via observer, rotates certs via registry, adjusts federation via gateway

See [enterprise-topology.md](references/enterprise-topology.md) for node type specifications, seed lifecycle, MAC composition, multi-client access, discovery mechanisms, and A2A implementation status.

## Related Skills

- **node-auth** — User authentication to a node (WebAuthn, JWT, OIDC)
- **behavioral-core** — BP engine that drives access control and the agent loop
- **agent-loop** — The 6-step agent pipeline nodes run
- **constitution** — Governance factories for MAC/DAC rules
- **generative-ui** — Server-driven UI the node renders
- **varlock** — AI-safe environment configuration for node secrets

## Related Code

- `src/a2a/` — A2A protocol implementation (schemas, server, client, utils, peers)
- `src/modnet/modnet.constants.ts` — `NODE_ROLE`, `MODNET_METADATA` constants
- `src/server/` — `createServer` with `validateSession` seam
