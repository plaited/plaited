# Default MAC Rules

Framework-provided MAC factories loaded at spawn. Immutable at runtime — `protectGovernance` bThread blocks any modification.

## noRmRf

Blocks `rm -rf` in execute events:

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

## noEtcWrites

Blocks writes to `/etc/` paths:

```typescript
const noEtcWrites = createGovernanceFactory({
  name: 'no_etc_writes',
  layer: 'mac',
  create: (_trigger) => ({
    threads: {
      noEtcWrites: bThread([
        bSync({
          block: (e) => e.type === 'execute' && e.detail?.path?.startsWith('/etc/'),
        }),
      ], true),
    },
  }),
})
```

## noForcePush

Blocks `git push --force` commands:

```typescript
const noForcePush = createGovernanceFactory({
  name: 'no_force_push',
  layer: 'mac',
  create: (_trigger) => ({
    threads: {
      noForcePush: bThread([
        bSync({
          block: (e) => e.type === 'execute' && e.detail?.command?.includes('push --force'),
        }),
      ], true),
    },
  }),
})
```

## protectGovernance

The self-protecting bThread — blocks execute if the tool call modifies a MAC governance file:

```typescript
const protectGovernance = createGovernanceFactory({
  name: 'protect_governance',
  layer: 'mac',
  create: (_trigger) => ({
    threads: {
      protectGovernance: bThread([
        bSync({
          block: (e) => {
            if (e.type !== 'execute') return false
            return modifiesGovernancePath(e.detail?.toolCall)  // queries sidecar db
          },
        }),
      ], true),
    },
  }),
})
```

When blocked, the handler routes to simulation — the Dreamer predicts consequences, generative UI explains to the user, the user decides. Danger is contextual (same `rm` command, different paths = different consequences).

## Loading at Spawn

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

**Critical ordering:** `bThreads.set()` before `trigger()` — see `behavioral-core` skill for why.

## Ratchet Principle

The constitution is **additive and append-only**:
- New factories can be added
- Existing MAC factories cannot be removed or weakened
- DAC factories can be modified with user approval
- Goals can be added/removed freely (user-approved)

This is enforced by `protectGovernance` blocking writes to `mac/` paths and by the `memoryIntegrity` bThread monitoring `.memory/constitution/`.
