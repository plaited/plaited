---
name: modnet-modules
description: MSS vocabulary and module-boundary guidance for agent-owned modules over distributed data and capabilities.
license: ISC
compatibility: Requires bun
---

# Modnet Modules

## Purpose

Use this skill when defining, generating, or evaluating module semantics for
Plaited agents.

This skill is about MSS vocabulary and module boundaries, not protocol
mechanics.

Core rule:

1. MSS defines what may be projected.
2. The node runtime enforces whether projection is allowed.
3. Protocol adapters expose approved projections.

Projection is semantic/runtime vocabulary. Protocols are mechanics.

Treat A2A, MCP, DID/VC, WebSocket, Streamable HTTP, `postMessage`, and future
adapters as mechanics, not ontology.

## Current Vocabulary

### MSS

MSS is a coordination and boundary standard for agent-owned modules operating
over distributed data and capabilities.

The MSS tags below are required vocabulary in this skill:

- `content`
- `structure`
- `mechanics`
- `boundary`
- `scale`

Use the exact tag names above even when internal schemas remain intentionally
under-specified.

`scale` must include at least:

- `humanScale`
- `coordinationScale`
- `authorityScale`
- `projectionScale`
- `relationalScale`

### Module

A module is a user-owned agentic wrapper around a coherent domain of work,
data, interaction, or life context.

A module gives the agent controlled capability around:

- identity
- semantics
- permissions
- projections
- allowed integrations

Runtime module realization is:

- MSS envelope
- module program
- capability grants
- projections

### Composition

Skills teach the agent how to do something.

MCP/tools/resources provide access to external capabilities or data.

Modules decide how skills, MCP, tools, UI, data, and behavior compose inside a
user-owned boundary.

## Module Layers

Treat module design across four explicit layers:

- human-facing: a named capability or workspace the user's agent can manage
- agent-facing: a semantic wrapper around distributed data, tools, skills, UI,
  and behavior
- runtime-facing: MSS envelope plus module program plus capability grants plus
  projections
- network-facing: grant-scoped projection, not automatic node inventory

## Source Texts

Read these references when you need the original conceptual lineage behind MSS
and modnet:

- [references/Structural-IA.md](references/Structural-IA.md)
- [references/Modnet.md](references/Modnet.md)

These files are lineage source material only. They are not direct implementation
specs for current runtime behavior.

If older phrasing appears in those documents (including UI-first modnet framing
or protocol-specific claims), treat it as historical context.

Current source of truth for runtime behavior lives in:

- `src/agent/*`
- `src/modules/*`

Current planning/backlog context lives in:

- `dev-research/README.md` and linked GitHub issues

## Runtime Contract

### Module Contract

Current source of truth:

```typescript
type ModuleParams = {
  trigger: Trigger
  useSnapshot: UseSnapshot
  signals: Signals
  computed: Computed
}

type Module = (params: ModuleParams) => {
  threads?: Record<string, ReturnType<BSync>>
  handlers?: DefaultHandlers
}
```

### Module Export Contract

`AGENT_CORE_EVENTS.update_modules` already expects a concrete loadable module
shape:

```typescript
{
  default: Module[]
}
```

Treat that export contract as real and stable enough to generate against.

What is still research:

- how modules are discovered
- what metadata is mandatory
- how MSS is packaged and validated
- how many module bundles a module should expose
- how default, deployed, and generated modules should layer

## Composition Layers

The agent should be understood as composing three kinds of module sources:

1. default modules shipped with the agent profile
2. deployment-provided modules selected when the agent is provisioned
3. module-generated or module-provided modules loaded later

Generation should respect that layering.

Evaluation should ask whether a proposal makes those layers clearer or muddier.

## Generation Rules

- Keep `src/agent/create-agent.ts` minimal.
- Put richer node, boundary, and capability behavior into modules.
- Use MSS to shape capability meaning, not to invent fake runtime subsystems.
- Treat projection as grant-scoped and adapter-agnostic.
- Do not model modules as traditional installable plugins/packages by default.
- Do not require any single adapter protocol for module validity.
- Respect the concrete runtime contract: loadable modules export
  `default: Module[]`.
- Prefer explicit, reviewable behavior over hidden orchestration doctrine.
- When drawing on older Structural IA or Modnet concepts, treat them as lineage
  and translate through current module layers.
- Do not define auth/token storage here; credential/secret actors are future
  work.
- Do not introduce full package-layout doctrine in this skill.

## Evaluation Rubric

When judging a candidate module, node surface, or module bundle, ask:

- does the proposal preserve the minimal core / module split?
- does the module's MSS description match its module program behavior and
  approved projections?
- does the network-facing surface expose grant-scoped projections rather than
  raw internals or automatic inventory?
- does the design keep boundary, trust, and authority assumptions explicit?
- does the proposal distinguish default, deployed, and generated modules
  clearly?
- does it rely on runtime surfaces that do not exist in `src/agent`?

## What Not To Assume

Do not assume the repo currently ships:

- modules as mandatory Bun workspace packages
- A2A as mandatory node entry for all module projections
- any single transport/protocol as the module ontology
- old `createNode` / `src/modnet/*` runtime doctrine
- constitution MAC/DAC runtime layers
- `protectGovernance`
- `.memory/constitution/` loaders
- legacy module marketplace or template-registry assumptions

If a proposal needs one of those ideas, treat it as research and open or route
through a relevant GitHub issue.

## When To Read The Source Texts

Read `references/Structural-IA.md` when you need:

- deeper vocabulary for objects, groups, blocks, channels, loops, and scale
- lineage for why MSS fields exist
- broader interaction and composition concepts behind structure/mechanics

Read `references/Modnet.md` when you need:

- the original sovereignty and modular-network framing
- bridge-code lineage behind MSS
- historical module/network examples that need current reinterpretation

After reading them, always translate back into:

- personal modnet agent
- agent-owned module boundaries
- grant-scoped projection
- runtime integration through current module contracts

## Related Skills

- **node-auth** — auth implementation seam for sovereign/platform/enterprise/dev
- **behavioral-core** — BP primitives for deterministic policy
- **typescript-lsp** — type-aware analysis of runtime contracts
