# Factory Patterns

These are current working starting patterns for constitution, goal, and workflow
factories. They encode useful defaults and invariants, but they are not meant to
freeze the final architecture or imply that one exact decomposition is the only
valid shape.

When using this file:

- treat the contracts and invariants as more stable than the exact examples
- treat the examples as practical starting points
- move unresolved strategy or alternative compositions into research/program surfaces rather than silently promoting them to doctrine

## GovernanceFactory Contract

All governance, goal, and workflow factories share one type signature:

```typescript
type GovernanceFactory = {
  (trigger: Trigger): { threads?: Record<string,  ReturnType<BSync>>; handlers?: DefaultHandlers }
  $: typeof GOVERNANCE_FACTORY_IDENTIFIER  // '🏛️'
  name: string
  layer: 'mac' | 'dac'
}
```

A `createGovernanceFactory` helper brands the function and validates the return shape. This extends the codebase's `$` brand pattern:

| Brand | Meaning |
|-------|---------|
| `🦄` | Templates |
| `🪢` |  ReturnType<BSync> |
| `🎛️` | ControllerTemplate |
| `🎨` | DecoratorTemplate |
| `🏛️` | GovernanceFactory (constitution) |
| `🎯` | GoalFactory |
| `🔄` | WorkflowFactory |

## MAC vs DAC

| Property | MAC (Mandatory Access Control) | DAC (Discretionary Access Control) |
|----------|-------------------------------|-----------------------------------|
| Loaded at | Spawn only | Spawn + runtime |
| Mutable | No — immutable once loaded | Yes — user can add/modify/remove |
| Who controls | Framework-provided | Agent-generated from user desired outcomes |
| Brand | `🏛️` | `🏛️` |

Both use the same contract. The distinction is lifecycle, not shape.

## Return Shape

Factory functions commonly encode two kinds of constitutional knowledge:

```typescript
{
  threads: {
    // Structural / syntactic checks — synchronous block predicates
    // Pipeline stage: Gate
    ruleName: bThread([bSync({ block: predicate })], true),
  },
  handlers: {
    // Contextual / semantic checks — async, feed into simulate → evaluate
    // Pipeline stage: Simulate → Evaluate
    eventType: async (detail) => { /* inference call */ },
  },
}
```

| Kind | Mechanism | Pipeline Stage | Example |
|------|-----------|---------------|---------|
| Structural / syntactic | `block` predicates in bThreads | Gate (synchronous) | "Does this module have all 5 bridge-code tags?" |
| Contextual / semantic | Async handlers → inference calls | Simulate → Evaluate (async) | "What happens if this `rm -rf` executes?" |

## Protection Model

| Actor | Access | Mechanism |
|-------|--------|-----------|
| Agent (normal operation) | Cannot delete or modify constitution files | `protectGovernance` bThread blocks writes |
| Agent (factory creation) | Can write new DAC factories with user approval | Write to `dac/` path, user confirms |
| System engineer | Direct modification via SSH | Outside agent process entirely |

## Goal Factory Example

Goals use brand `🎯` but follow the same contract. This is an example starting
pattern, not the only valid final arrangement:

```typescript
// .memory/goals/watch-alice.ts
import { bThread, bSync } from '../../src/behavioral/behavioral.utils.ts'
import { AGENT_EVENTS } from '../../src/agent/agent.constants.ts'
import type { Trigger, BPEvent } from '../../src/behavioral/behavioral.types.ts'

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

## Workflow Factory Example

Workflows use brand `🔄` — same contract, runtime-loaded. Again, this is a
current example pattern rather than a final required organization:

```typescript
export const dailyReport = {
  $: '🔄' as const,
  name: 'daily_report',
  layer: 'workflow' as const,
  create: (_trigger: Trigger) => ({
    threads: {
      workflow_daily_report: bThread([
        bSync({
          waitFor: (e: BPEvent) =>
            e.type === 'sensor_delta' &&
            e.detail?.sensor === 'cron' &&
            e.detail?.delta?.schedule === 'daily',
        }),
        bSync({
          request: {
            type: AGENT_EVENTS.context_assembly,
            detail: { workflow: 'daily_report', trigger: 'Daily schedule fired' },
          },
        }),
      ], true),
    },
  }),
}
```

## Authoring Model

| Layer | What | Source of Truth For |
|-------|------|-------------------|
| Reference document (`docs/`) | Describes principles and rationale | Intent |
| Governance factory (TypeScript) | Encodes principles as block predicates + handlers | Enforcement |
| Governance/goal skill (Markdown) | Teaches the model what rules/goals mean | Understanding |

All are versioned in git. Factories are distributed via npm — MAC factories shipped with `plaited/agent`.

The key stable point is the governance contract and its invariants. Specific
factory groupings, names, and decomposition strategies should remain open to
improvement until they are proven durable.
