---
name: modnet-factories
description: Modnet/MSS context for factory-era Plaited agents. Use when generating or evaluating Bun workspace modules that export factories, mapping MSS semantics onto module behavior, or designing A2A-facing node capability surfaces without widening the minimal core.
license: ISC
compatibility: Requires bun
---

# Modnet Factories

## Purpose

This skill teaches the current modnet translation for Plaited:

- MSS is the semantic and compositional layer
- A2A is the node entry point and inter-node boundary
- modules are Bun workspaces
- modules integrate by exporting factories
- the agent composes default, deployment-provided, and generated factories

Use this skill for both:

- generation of candidate module/node factories and bThreads
- evaluation of candidate module and factory-bundle designs

Do not use this skill as proof that older modnet or constitution runtime
surfaces still exist.

## Source Texts

Read these references when you need the original conceptual lineage behind MSS
and modnet:

- [references/Structural-IA.md](references/Structural-IA.md)
- [references/Modnet.md](references/Modnet.md)

Use them as source material, not as direct implementation specs.

Current source of truth for runtime behavior lives in:

- `src/agent/*`
- `src/factories/a2a-factory/*`
- active `dev-research/*/program.md` lanes

## Current Translation

### 1. MSS

MSS provides semantic and compositional inputs for modules and artifacts:

- `contentType`
- `structure`
- `mechanics`
- `boundary`
- `scale`

Use MSS to reason about:

- what a module is for
- how it should compose with other modules
- what kind of capability surface it should project
- what sharing or boundary assumptions are implied

MSS is input context for generation and evaluation. It is not, by itself, a
runtime loader or policy engine.

### 2. A2A

A2A is the node entry point and node-to-node communication boundary.

Use it to reason about:

- what the node exposes
- how remote requests enter the system
- how Agent Card projection should reflect real capabilities
- how trust, auth, and authority shaping apply at the protocol edge

Do not treat A2A as an internal message bus or a replacement for the local
behavioral runtime.

### 3. Modules

Modules are Bun workspaces that carry MSS meaning and integrate into agent
behavior through factories.

The important current translation is:

- a module is not primarily a UI template or legacy modnet package concept
- a module is a workspace-level unit that can contribute executable factories
- modules may be shipped, deployment-provided, or generated later

## Concept Translation

The old Structural IA and Modnet texts still matter, but the introduction of a
personal agent changes how several concepts should be interpreted.

### Personal Agent

The personal agent is now the user's modnet agent:

- it owns the user's local runtime and working context
- it composes default, deployment-provided, and generated factories
- it decides how module semantics become behavior
- it mediates what is exposed beyond the node boundary

This means the user is not primarily interacting with a platform UI or raw
module template. They are interacting with their agent, which interprets
modules, renders views, and negotiates capability surfaces.

### Module

Old lineage:

- a self-contained composable unit carrying user-owned content and behavior

Current translation:

- a Bun workspace unit with MSS meaning that can export factories
- a module may project services, artifacts, or generated views rather than raw
  internals
- a module contributes behavior to the agent through factory composition

### Network

Old lineage:

- modules or patterns forming larger networks directly, sometimes through
  proximity or shared template structures

Current translation:

- nodes form networks through A2A
- modules do not casually self-assemble across node boundaries on their own
- the agent mediates discovery, translation, sharing, and composition

### Boundary

Old lineage:

- what information a module shares with other modules or networks

Current translation:

- boundary is still a core concept, but now informs:
  - exposure policy
  - authority shaping
  - auth/trust gating
  - A2A-facing capability projection

### Structure And Mechanics

Old lineage:

- direct information-architecture and interaction-pattern language

Current translation:

- semantic inputs that help the agent decide:
  - how a module should be rendered or projected
  - what behavior is coherent for the module
  - how it composes with other modules
  - what candidate factories or bThreads make sense

The agent may generate the realization dynamically rather than reusing a fixed
platform template.

### Sovereignty

Old lineage:

- user-owned modules and user-controlled data outside platform lock-in

Current translation:

- sovereignty centers on the user-owned node and its module/workspace graph
- the personal agent is the mediator that preserves user control while still
  exposing selected capabilities over A2A
- deleting a link or narrowing a boundary should remain more important than any
  one external platform or consumer

## Runtime Contract

### Factory Contract

Current source of truth:

```typescript
type FactoryParams = {
  trigger: Trigger
  useSnapshot: UseSnapshot
  signals: Signals
  computed: Computed
}

type Factory = (params: FactoryParams) => {
  threads?: Record<string, ReturnType<BSync>>
  handlers?: DefaultHandlers
}
```

### Module Export Contract

`AGENT_CORE_EVENTS.update_factories` already expects a concrete loadable module
shape:

```typescript
{
  default: Factory[]
}
```

Treat that export contract as real and stable enough to generate against.

What is still research:

- how modules are discovered
- what metadata is mandatory
- how MSS is packaged and validated
- how many factory bundles a module should expose
- how default, deployed, and generated modules should layer

## Composition Layers

The agent should be understood as composing three kinds of factory sources:

1. default factories shipped with the agent profile
2. deployment-provided factories selected when the agent is provisioned
3. module-generated or module-provided factories loaded later

Generation should respect that layering.

Evaluation should ask whether a proposal makes those layers clearer or muddier.

## Generation Rules

- Keep `src/agent/create-agent.ts` minimal.
- Put richer node, boundary, and capability behavior into factories.
- Use MSS to shape capability meaning, not to invent fake runtime subsystems.
- Use A2A as the node boundary, not as proof that every module must be remotely
  exposed.
- Generate modules as Bun workspace units that can export factories.
- Respect the concrete runtime contract: loadable modules export
  `default: Factory[]`.
- Prefer explicit, reviewable behavior over hidden orchestration doctrine.
- When drawing on older Structural IA or Modnet concepts, translate them
  through the personal-agent model before generating code or doctrine.

## Evaluation Rubric

When judging a candidate module, node surface, or factory bundle, ask:

- does the proposal preserve the minimal core / factory split?
- does the module’s MSS description match its exported behavior?
- does the A2A-facing surface project real capability rather than internals?
- does the design keep boundary, trust, and authority assumptions explicit?
- does the proposal distinguish default, deployed, and generated factories
  clearly?
- does it rely on runtime surfaces that do not exist in `src/agent`?

## What Not To Assume

Do not assume the repo currently ships:

- old `createNode` / `src/modnet/*` runtime doctrine
- constitution MAC/DAC runtime layers
- `protectGovernance`
- `.memory/constitution/` loaders
- legacy module marketplace or template-registry assumptions

If a proposal needs one of those ideas, treat it as research and route it
through the relevant `dev-research/*/program.md` lane.

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
- Bun workspace modules
- A2A as node boundary
- factory exports as runtime integration

## Related Skills

- **node-auth** — auth implementation seam for sovereign/platform/enterprise/dev
- **behavioral-core** — BP primitives for deterministic policy
- **trial-runner** — evaluation flows for candidate factory bundles
- **typescript-lsp** — type-aware analysis of runtime contracts
