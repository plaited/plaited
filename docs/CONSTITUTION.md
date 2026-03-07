# Constitution

> **Status: ACTIVE** — Extracted from SYSTEM-DESIGN-V3.md, updated with decisions from `HYPERGRAPH-MEMORY.md` (dual representation, factory generation, skill poles). Cross-references: `SAFETY.md` (defense layers), `HYPERGRAPH-MEMORY.md` (constitution as skills, governance factory generation).

## Overview

The framework ships with foundational bThreads — the **constitution** — encoding documented principles as deterministic constraints. Constitution rules have **dual representation**: bThreads enforce (block predicates), skills teach (context assembly injects governance knowledge).

## Governance Factories

Constitution rules are authored as **governance factory functions** — the same contract used by the client-side `update_behavioral` handler:

```typescript
type GovernanceFactory = {
  (trigger: Trigger): { threads?: Record<string, RulesFunction>; handlers?: DefaultHandlers }
  $: typeof GOVERNANCE_FACTORY_IDENTIFIER  // '🏛️'
  name: string
  layer: 'mac' | 'dac'
}
```

This extends the codebase's `$` brand pattern (`🦄` templates, `🪢` RulesFunction, `🎛️` ControllerTemplate, `🎨` DecoratorTemplate). A `createGovernanceFactory` helper brands the function and validates the return shape.

### MAC vs DAC

| Layer | Full Name | Lifecycle | Who Controls |
|---|---|---|---|
| `mac` | Mandatory Access Control | Loaded at spawn. Immutable. | Framework-provided. Cannot be overridden. |
| `dac` | Discretionary Access Control | Loaded with user approval at runtime. | Agent-generated from user desired outcomes. User can add/modify/remove. |

Both use the same contract. The distinction is lifecycle, not shape.

## Neuro-Symbolic Split

Our 7B reference model cannot reliably internalize complex constraints through training alone. The symbolic layer (BP) provides at runtime what training cannot guarantee in small models.

Constitutional knowledge splits across the pipeline:

| Kind | Mechanism | Pipeline Stage | Example |
|---|---|---|---|
| **Structural / syntactic** | `block` predicates in bThreads | Gate (synchronous) | "Does this module have all 5 bridge-code tags?" |
| **Contextual / semantic** | Async handlers → inference calls | Simulate → Evaluate (async) | "What happens if this `rm -rf` executes?" |

Factory functions encode both: `threads` for structural checks (synchronous block predicates), `handlers` for contextual checks that feed into simulate → evaluate.

## Dual Representation: bThreads + Skills

Constitution rules have dual representation (see `HYPERGRAPH-MEMORY.md` § Constitution Knowledge in Skills):

| Layer | Mechanism | What It Does |
|---|---|---|
| **bThread** (symbolic) | Block predicates | Prevents dangerous events structurally — the engine won't select them |
| **Skill** (neural) | Context assembly | Teaches the model the rules so it doesn't propose blocked actions |

Both are needed and non-substitutable:
- bThread alone: model keeps proposing blocked actions, wasting inference cycles
- Skill alone: model might find creative circumventions
- Both: model understands rules (fewer blocked proposals) AND engine enforces them (defense-in-depth)

Constitution skills follow area-of-effect scoping: governance rules relevant to the current module/workspace are included in context assembly, not all rules globally.

## Structural Information Architecture

Rachel Jaffe's structural vocabulary defines the primitives that digital environments are built from. The constitution encodes these as governance factories (see `Structural-IA.md` for the full vocabulary):

- **Objects** — discrete data containers with defined boundaries
- **Channels** — pathways for information flow between objects
- **Levers** — interaction points that change system state
- **Loops** — feedback mechanisms that reinforce or dampen behavior
- **Blocks** — constraints that prevent certain interactions

These are `block` predicates that prevent the agent from generating structures that violate the vocabulary. A module without a defined boundary is blocked. A channel without source and destination is blocked.

## Modnet Concepts

The constitution encodes modnet principles as constraints (see `Modnet.md` for the full design standards):

- **1 module : 1 user** — modules are owned, not shared
- **Bridge-code** — every module must declare content type, structure, mechanics, boundary, and scale
- **Transportability** — modules must be self-contained
- **A2A compatibility** — module interfaces must be expressible as A2A Agent Cards

## Governance Protection

Governance factories live in the workspace but are protected by the pipeline:

```typescript
// protectGovernance — blocks execute if the tool call modifies a MAC governance file
bSync({
  block: (e) => {
    if (e.type !== 'execute') return false
    return modifiesGovernancePath(e.detail?.toolCall)  // queries sidecar db
  }
})
```

When blocked, the handler routes to simulation — the Dreamer predicts consequences, generative UI explains to the user, the user decides. Danger is contextual (same `rm` command, different paths = different consequences).

The constitution is **additive and append-only** (ratchet principle). New factories can be added; existing MAC factories cannot be removed or weakened.

## Governance Factory Generation

Factories are created through file writes to protected locations — `data/memory/constitution/mac/` or `data/memory/constitution/dac/` — monitored by `protectGovernance` and `memoryIntegrity` bThreads.

**Who creates factories:** The agent itself, a system-builder agent, or a human system engineer. They generate governance rules from **user desired outcomes** — what the user wants to achieve, not explicit rule descriptions.

### Protection Model

| Actor | Access | Mechanism |
|---|---|---|
| Agent (normal operation) | Cannot delete or modify constitution files | `protectGovernance` bThread blocks writes |
| Agent (factory creation) | Can write new DAC factories with user approval | Write to `dac/` path, user confirms |
| System engineer | Direct modification via SSH | Outside agent process entirely |
| Non-technical user | Explicit permissioning for dangerous operations | Outside normal agent process |

### Capability Model

- MAC factories remain framework-provided (loaded at spawn, immutable at runtime)
- The agent generates new governance factories through the training flywheel — default bThreads protecting the files + model training to produce valid factory patterns
- Constitution skills teach the factory pattern; the model learns what valid governance looks like from its own skill context

## Authoring Model

| Layer | What | Example |
|---|---|---|
| **Reference document** (`docs/`) | Describes principles and rationale | `Structural-IA.md`, `Modnet.md` |
| **Governance factory** (TypeScript) | Encodes principles as `block` predicates + handlers | `.ts` files branded with `$: '🏛️'` |
| **Governance skill** (Markdown) | Teaches the model what rules mean and why | Area-of-effect scoped, context assembly injected |

The reference document is the source of truth for *intent*. The factory is the source of truth for *enforcement*. The skill is the source of truth for *understanding*. All are versioned in git.

- **Authored** as TypeScript — governance factories returning `{ threads?, handlers? }`
- **Branded** with `$: '🏛️'` — discoverable by collector tool and sidecar db
- **Versioned** in git — tracked like any other code
- **Distributed** via npm — MAC factories shipped with `plaited/agent`
- **Taught** via skills — constitution skills explain the rules for context assembly
