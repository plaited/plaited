# Constitution

> **Status: ACTIVE** — Design rationale for the governance layer. Implementation patterns in `skills/constitution/`.

## Overview

The framework ships with foundational bThreads — the **constitution** — encoding documented principles as deterministic constraints. Constitution rules have **dual representation**: bThreads enforce (block predicates), skills teach (context assembly injects governance knowledge).

## Neuro-Symbolic Split

Our 7B reference model cannot reliably internalize complex constraints through training alone. The symbolic layer (BP) provides at runtime what training cannot guarantee in small models.

Constitutional knowledge splits across two mechanisms:

| Kind | Mechanism | Pipeline Stage |
|------|-----------|---------------|
| **Structural / syntactic** | `block` predicates in bThreads | Gate (synchronous) |
| **Contextual / semantic** | Async handlers → inference calls | Simulate → Evaluate (async) |

The symbolic layer catches what the model misses. The neural layer reduces wasted inference by teaching the model what's blocked. Neither alone is sufficient.

## Access Control: MAC / DAC / ABAC

Three access control models compose to form the governance stack:

**MAC (Mandatory Access Control)** — Framework-provided rules loaded at spawn. Immutable at runtime. The agent cannot override or remove them. Examples: `noRmRf`, `protectGovernance`.

**DAC (Discretionary Access Control)** — Agent-generated rules from user desired outcomes. User can add, modify, or remove. Loaded at spawn and runtime. Examples: `noProductionDeploys`, `requireReviewBeforeMerge`.

**ABAC (Attribute-Based Access Control)** — Risk tags on events determine routing. Tags: `workspace`, `crosses_boundary`, `inbound`, `outbound`, `irreversible`, `external_audience`. Empty/unknown tags → simulate + judge. Workspace-only → execute directly.

MAC and DAC share the same factory contract — the distinction is lifecycle, not shape. ABAC operates at the event routing layer, not the factory layer.

## Dual Representation

Constitution rules exist in two forms simultaneously:

| Layer | Mechanism | What It Does |
|-------|-----------|-------------|
| **bThread** (symbolic) | Block predicates | Prevents dangerous events structurally |
| **Skill** (neural) | Context assembly | Teaches the model the rules |

Both are needed and non-substitutable:
- bThread alone: model keeps proposing blocked actions, wasting inference cycles
- Skill alone: model might find creative circumventions
- Both: model understands rules (fewer blocked proposals) AND engine enforces them (defense-in-depth)

Constitution skills follow area-of-effect scoping: governance rules relevant to the current module/workspace are included in context assembly, not all rules globally.

## Ratchet Principle

The constitution is **additive and append-only**. New factories can be added; existing MAC factories cannot be removed or weakened. This is enforced structurally by `protectGovernance` blocking writes to MAC paths and by `memoryIntegrity` monitoring `.memory/constitution/`.

The ratchet ensures that safety guarantees only grow over time. A system that has learned to avoid a class of failures never unlearns that constraint. DAC rules (user-controlled) are exempt from the ratchet — users retain sovereignty over their own discretionary rules.

## Structural Information Architecture

Rachel Jaffe's structural vocabulary defines the primitives that digital environments are built from. The constitution encodes these as governance factories (see `Structural-IA.md`):

- **Objects** — discrete data containers with defined boundaries
- **Channels** — pathways for information flow between objects
- **Levers** — interaction points that change system state
- **Loops** — feedback mechanisms that reinforce or dampen behavior
- **Blocks** — constraints that prevent certain interactions

## Modnet Concepts

The constitution encodes modnet principles as constraints (see `Modnet.md`):

- **1 module : 1 user** — modules are owned, not shared
- **Bridge-code** — every module must declare content type, structure, mechanics, boundary, and scale
- **Transportability** — modules must be self-contained
- **A2A compatibility** — module interfaces must be expressible as A2A Agent Cards

## Cross-References

- **Implementation patterns:** `skills/constitution/` — factory contract, generated bThreads, MAC rules, verification stack
- **Safety layers:** `SAFETY.md` — defense-in-depth architecture
- **Memory integration:** `HYPERGRAPH-MEMORY.md` — constitution as skills, factory generation
- **BP primitives:** `skills/behavioral-core/` — `bThread`, `bSync`, event selection
