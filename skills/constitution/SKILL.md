---
name: constitution
description: Governance factory patterns for MAC/DAC constitution rules, generated bThread workflows, and the verification stack. Use when implementing governance factories, loading MAC/DAC rules, generating goal/workflow bThreads, or wiring the protectGovernance safety layer.
license: ISC
compatibility: Requires bun
---

# Constitution

## Purpose

This skill teaches agents how to author, load, and protect governance factories — the TypeScript encoding of constitutional rules. Constitution rules use the same behavioral programming primitives from `behavioral-core` but follow a specific factory contract with branded identifiers, lifecycle distinctions (MAC vs DAC), and a multi-layer verification stack.

**Use this when:**
- Implementing governance factory functions (`GovernanceFactory` contract)
- Loading MAC/DAC rules at spawn or runtime
- Generating goal or workflow bThreads (test-first flow)
- Wiring `protectGovernance` to block modification of MAC files
- Understanding the verification stack for generated TypeScript bThreads
- Working with `.memory/constitution/` or `.memory/goals/` file structures

## Quick Reference

**Factory contract:** All governance/goal/workflow factories share one shape:
```typescript
(trigger: Trigger) => { threads?: Record<string,  ReturnType<BSync>; handlers?: DefaultHandlers }
```

**Brands:** `🏛️` constitution, `🎯` goal, `🔄` workflow — same contract, different lifecycle.

**Layers:** MAC (immutable, loaded at spawn) vs DAC (mutable, user-approved at runtime).

**Key principle:** Constitution is additive and append-only (ratchet). New factories can be added; existing MAC factories cannot be removed or weakened.

## References

### Factory Patterns

**[factory-patterns.md](references/factory-patterns.md)** — Complete governance factory contract:
- `GovernanceFactory` type signature and `createGovernanceFactory` helper
- Brand emoji identifiers (`🏛️`, `🎯`, `🔄`) and their meanings
- MAC vs DAC lifecycle and protection model
- Return shape: `{ threads?, handlers? }` for structural + contextual checks
- Goal and workflow factory examples

### Governance Model

**[governance-model.md](references/governance-model.md)** — Governance-layer rationale and control model:
- neuro-symbolic split between behavioral enforcement and model understanding
- MAC / DAC / ABAC composition and where each layer acts
- dual representation of constitution rules as symbolic + neural surfaces
- additive ratchet principle for MAC governance
- relationship between constitution, MSS, and broader Plaited governance semantics

### Generated bThreads

**[generated-bthreads.md](references/generated-bthreads.md)** — How the agent generates bThreads as TypeScript:
- Test-first generation flow (spec before implementation)
- Five-layer verification stack (tsc → LSP → test → trial → BP runtime)
- `.memory/` file structure for constitution, goals, and sessions
- `validateAndImport` gate (7-point check before loading)
- Trial/grader integration for measuring generation quality
- Goal factory example with `watchAlice` pattern

### MAC Rules

**[mac-rules.md](references/mac-rules.md)** — Current shipped MAC baseline:
- `noRmRf` — blocks `rm -rf` in execute events
- `noEtcWrites` — blocks writes to `/etc/` paths
- `noForcePush` — blocks `git push --force` commands
- `protectGovernance` — blocks execute if tool call modifies MAC governance files
- loading-at-spawn pattern (`loadPersistedThreads`)
- framing as current baseline defaults rather than the final complete MAC set

## Key Patterns

### Pattern 1: Governance Factory Contract

Every governance rule is a branded factory function returning threads and/or handlers:

```typescript
const noRmRf = createGovernanceFactory({
  name: 'no_rm_rf',
  layer: 'mac',
  create: (_trigger) => ({
    threads: {
      noRmRf: bThread([
        bSync({
          block: (e) => e.type === 'execute' && e.detail?.command?.includes('rm -rf'),
        }),
      ], true),
    },
  }),
})
```

`threads` encode structural/syntactic checks (synchronous block predicates). `handlers` encode contextual/semantic checks (async, feed into simulate → evaluate).

### Pattern 2: protectGovernance

The self-protecting bThread that prevents MAC modification:

```typescript
bSync({
  block: (e) => {
    if (e.type !== 'execute') return false
    return modifiesGovernancePath(e.detail?.toolCall)
  },
})
```

When blocked, the handler routes to simulation — the Dreamer predicts consequences, generative UI explains to the user, the user decides.

### Pattern 3: Test-First Generation

The agent generates the test before the implementation:

```
1. User: "Watch for emails from Alice"
2. Agent generates: .memory/goals/tests/watch-alice.spec.ts
3. Agent runs: bun test → FAILS (no implementation)
4. Agent generates: .memory/goals/watch-alice.ts
5. Agent runs: tsc --noEmit → passes
6. Agent runs: bun test → PASSES
7. Thread loaded into BP engine
```

### Pattern 4: Dual Representation

Constitution rules exist in two forms simultaneously:
- **bThread** (symbolic): block predicates prevent dangerous events structurally
- **Context / teaching surface**: skills, memory, or training context teach the model the rules

Both are needed: bThread alone wastes inference (model keeps proposing blocked
actions). Context alone risks circumvention. Together: defense-in-depth.

See [governance-model.md](references/governance-model.md) for the broader governance framing, including the neuro-symbolic split and MAC / DAC / ABAC layering.

## Related Skills

- **behavioral-core** — BP primitives (`bThread`, `bSync`, `behavioral()`)
- **trial-runner** — Measuring bThread generation quality (pass@k)
- **code-patterns** — Utility function genome (coding conventions)
