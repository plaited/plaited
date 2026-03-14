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

Factories are created through file writes to protected locations — `.memory/constitution/mac/` or `.memory/constitution/dac/` — monitored by `protectGovernance` and `memoryIntegrity` bThreads.

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

## Generated bThreads: Beyond Constitution

> **Status: DESIGN** — Decided architecture. Depends on `createAgentLoop()` and governance factory implementation.

Constitution (MAC/DAC) is one category of bThread the agent manages. But the agent generates bThreads for **four purposes**, all using the same TypeScript factory pattern with different brands:

| Category | Brand | Loaded at | Mutable | Approval | Example |
|----------|-------|-----------|---------|----------|---------|
| MAC Constitution | `🏛️` | Spawn | No | Framework | `noRmRf`, `protectGovernance` |
| DAC Constitution | `🏛️` | Spawn + runtime | Yes | User | `noProductionDeploys` |
| Goals | `🎯` | Spawn + runtime | Yes | User (DAC-style) | `watchAliceEmail`, `serverHealth` |
| Workflows | `🔄` | Runtime | Yes | User (DAC-style) | `dailyReport`, `weeklyDigest` |

All categories use the same contract — a branded factory function returning `{ threads?, handlers? }`. The distinction is brand, mutability, and approval flow — not shape.

### Why Generated TypeScript (Not Declarative Data)

The agent generates bThreads as **TypeScript files with companion tests**, not JSON-LD data with a predicate DSL. The verification stack makes code generation as safe as data generation while being far more expressive:

```
Agent generates .ts file
  │
  ▼
Layer 1: TypeScript Type Check (bun --bun tsc --noEmit)
  │  RulesFunction must yield Idioms (branded 🪢)
  │  bSync params must match { request?, waitFor?, block?, interrupt? }
  │  Factory return type must match { threads?, handlers? }
  │  CATCHES: wrong types, missing fields, bad imports, structural errors
  │
  ▼
Layer 2: LSP Static Analysis (plaited lsp)
  │  No imports outside allowed modules (behavioral types, agent constants)
  │  Exported symbols match expected factory shape
  │  No side effects in factory (no fetch, no fs, no Bun.$)
  │  CATCHES: import violations, symbol misuse, sandboxing
  │
  ▼
Layer 3: Generated Test Execution (bun test)
  │  Agent generates companion .spec.ts alongside the bThread
  │  Test instantiates behavioral(), loads thread, triggers events
  │  Asserts: correct events blocked/allowed, correct lifecycle
  │  CATCHES: behavioral errors, wrong blocking logic, infinite loops
  │
  ▼
Layer 4: Trial/Grader Evaluation (plaited trial)
  │  Run k=10 attempts of "generate bThread for goal X"
  │  Grader: does generated thread pass tsc + bun test?
  │  pass@k = capability, pass^k = reliability
  │  CATCHES: flaky generation, edge cases, training signal
  │
  ▼
Layer 5: BP Runtime (the engine itself)
  │  MAC bThreads block dangerous execute events regardless of source
  │  useSnapshot captures every decision — bad threads are observable
  │  protectGovernance blocks threads that modify MAC
  │  CATCHES: anything that slips through layers 1-4
```

**Verification IS the training signal.** Every generated bThread that passes tsc + tests becomes a positive training example. Every failure becomes a negative example with structured feedback (which layer caught it, what the error was). This feeds the distillation pipeline in `TRAINING.md`.

### Test-First Generation

The agent generates the test before the thread:

```
1. User: "Watch for emails from Alice"
2. Agent generates: .memory/goals/tests/watch-alice.spec.ts
   - Creates behavioral(), loads thread, triggers sensor_delta events
   - Asserts: fires context_assembly when from includes "alice@example.com"
   - Asserts: does NOT fire for other senders
   - Asserts: repeats after firing
3. Agent runs: bun test → FAILS (no implementation)
4. Agent generates: .memory/goals/watch-alice.ts
5. Agent runs: tsc --noEmit → passes
6. Agent runs: bun test → PASSES
7. Thread loaded into BP engine
```

### File Structure

```
.memory/
├── @context.jsonld
├── constitution/
│   ├── mac/                          # Framework-provided (immutable)
│   │   ├── no-rm-rf.ts
│   │   ├── protect-governance.ts
│   │   └── tests/
│   │       ├── no-rm-rf.spec.ts
│   │       └── protect-governance.spec.ts
│   └── dac/                          # User-approved (mutable)
│       ├── no-prod-deploys.ts
│       └── tests/
│           └── no-prod-deploys.spec.ts
├── goals/                            # Agent-generated, user-approved
│   ├── watch-alice.ts
│   ├── server-health.ts
│   ├── daily-report.ts
│   └── tests/
│       ├── watch-alice.spec.ts
│       ├── server-health.spec.ts
│       └── daily-report.spec.ts
└── sessions/                         # Runtime snapshots (not generated)
```

### Goal Factory Example

```typescript
// .memory/goals/watch-alice.ts
import { bThread, bSync } from '../../src/behavioral/behavioral.utils.ts'
import { AGENT_EVENTS } from '../../src/agent/agent.constants.ts'
import type { Trigger } from '../../src/behavioral/behavioral.types.ts'
import type { BPEvent } from '../../src/behavioral/behavioral.types.ts'

export const watchAlice = {
  $: '🎯' as const,
  name: 'watch_alice',
  layer: 'goal' as const,
  create: (_trigger: Trigger) => ({
    threads: {
      goal_watch_alice: bThread([
        bSync({
          waitFor: (e: BPEvent) =>
            e.type === 'sensor_delta' &&
            e.detail?.sensor === 'email' &&
            e.detail?.delta?.from?.includes('alice@example.com'),
        }),
        bSync({
          request: {
            type: AGENT_EVENTS.context_assembly,
            detail: { goal: 'watch_alice', trigger: 'New email from Alice' },
          },
        }),
      ], true),
    },
  }),
}
```

### Loading at Spawn

```typescript
const loadPersistedThreads = (trigger: Trigger, bThreads: BThreads) => {
  // MAC constitution (immutable, framework-provided)
  for (const file of glob('.memory/constitution/mac/*.ts')) {
    const factory = await validateAndImport(file)
    const { threads, handlers } = factory.create(trigger)
    if (threads) bThreads.set(threads)
  }
  // DAC constitution (user-approved)
  for (const file of glob('.memory/constitution/dac/*.ts')) {
    const factory = await validateAndImport(file)
    const { threads, handlers } = factory.create(trigger)
    if (threads) bThreads.set(threads)
  }
  // Goals (agent-generated, user-approved)
  for (const file of glob('.memory/goals/*.ts')) {
    const factory = await validateAndImport(file)
    const { threads, handlers } = factory.create(trigger)
    if (threads) bThreads.set(threads)
  }
}
```

### Validation Gate

Before loading any generated thread, `validateAndImport` checks:

1. **Parse** — must be valid TypeScript
2. **Brand check** — must have correct `$` identifier for its directory
3. **Sandbox check** — no imports outside behavioral types and agent constants
4. **Purity check** — factory must be pure (no fetch, no fs, no Bun.$)
5. **MAC protection** — goals cannot block MAC-protected events
6. **Name collision** — cannot shadow existing thread names
7. **Tests pass** — companion `.spec.ts` must exist and pass

### Trial/Grader for bThread Generation

bThread generation quality is measurable via the trial runner:

```jsonl
{"id":"goal-email-filter","input":"Generate a goal bThread that watches for emails from alice@example.com","hint":"must repeat, must filter by sender, must produce context_assembly"}
{"id":"dac-no-weekend-deploys","input":"Generate a DAC rule that blocks deploy on weekends","hint":"must use repeat:true, must check day of week"}
```

Grader runs tsc + bun test on the generated output. pass@k measures capability; pass^k measures reliability. This feeds the augmented self-distillation pipeline.

## Authoring Model

| Layer | What | Example |
|---|---|---|
| **Reference document** (`docs/`) | Describes principles and rationale | `Structural-IA.md`, `Modnet.md` |
| **Governance factory** (TypeScript) | Encodes principles as `block` predicates + handlers | `.ts` files branded with `$: '🏛️'` |
| **Goal factory** (TypeScript) | Encodes user directives as `waitFor` + `request` sequences | `.ts` files branded with `$: '🎯'` |
| **Governance/goal skill** (Markdown) | Teaches the model what rules/goals mean and why | Area-of-effect scoped, context assembly injected |

The reference document is the source of truth for *intent*. The factory is the source of truth for *enforcement*. The skill is the source of truth for *understanding*. All are versioned in git.

- **Authored** as TypeScript — factories returning `{ threads?, handlers? }`
- **Branded** with category identifier — `🏛️` (constitution), `🎯` (goal), `🔄` (workflow)
- **Tested** with companion `.spec.ts` — red-green verification before loading
- **Versioned** in git — tracked like any other code
- **Distributed** via npm — MAC factories shipped with `plaited/agent`
- **Taught** via skills — constitution/goal skills explain the rules for context assembly
