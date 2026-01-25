# Levers

> Tools that change energy demand or alter energy inputs

## Definition

**Levers are tools to change the energy demand of a system or alter energy inputs.**

Users exert the lowest amount of energy possible to achieve their goals. Levers help designers either:
1. **Decrease** the energy needed to interact
2. **Increase** the energy users are willing to exert

## Lever Types

| Lever | Purpose | Effect on Energy |
|-------|---------|------------------|
| **Affordance** | Signal how to interact | Decreases energy (clarity) |
| **Mechanic** | Shape feedback patterns | Increases engagement (dopamine) |
| **Game** | Define rules and incentives | Channels energy (motivation) |

## Affordances

**Affordances are properties that make explicit how a user can engage.**

Well-designed affordances decrease energy by helping users understand interactions without guessing.

```typescript
/** Affordance type contract */
type Affordance = {
  kind: 'affordance'
  signal: string  // How interaction is signaled
}
```

### In Plaited

```typescript
// Affordance via aria-label
<button aria-label="Increment counter">+</button>

// Affordance via p-trigger (signals clickability)
<button p-trigger={{ click: 'increment' }}>+</button>

// Affordance via visual styling
<button {...styles.primaryButton}>Submit</button>
```

### Detection Heuristics

| Signal | Affordance Present |
|--------|-------------------|
| `aria-label` | ✅ Screen reader affordance |
| `aria-describedby` | ✅ Extended description |
| `role` attribute | ✅ Semantic affordance |
| `p-trigger` | ✅ Interaction signal |
| Visual button styling | ✅ Visual affordance |

## Mechanics

**Mechanics are designed ways to present and interact with loops that alter dynamics.**

Mechanics shape how feedback is revealed, affecting user engagement through dopamine patterns.

```typescript
/** Mechanic type contract */
type Mechanic = {
  kind: 'mechanic'
  reveal: 'instant' | 'progressive' | 'delayed'
}
```

### Reveal Patterns

| Pattern | Description | Energy Effect |
|---------|-------------|---------------|
| **Instant** | Immediate full feedback | Low anticipation, high clarity |
| **Progressive** | Bit-by-bit reveal | Building anticipation |
| **Delayed** | Feedback after pause | Maximum anticipation |

### In Plaited

```typescript
// Instant mechanic - immediate render
increment() {
  count++
  $('display')[0]?.render(<>{count}</>)  // Instant feedback
}

// Progressive mechanic - step-by-step reveal
async revealResults() {
  for (const result of results) {
    await wait(200)
    $('list')[0]?.insert('beforeend', <li>{result}</li>)
  }
}

// Delayed mechanic - suspense before reveal
async submitAnswer() {
  $('feedback')[0]?.render(<>Checking...</>)
  await wait(1500)  // Build anticipation
  $('feedback')[0]?.render(<>Correct!</>)
}
```

## Games

**Games are system rules and incentive structures that lead to desired interactions.**

Games define what "winning" means, channeling user energy toward goals.

```typescript
/** Game type contract */
type Game = {
  kind: 'game'
  constraint: string  // The rule or boundary
}
```

### In Plaited (via bThreads)

```typescript
// Game: Cannot exceed maximum (boundary constraint)
bThreads.set({
  blockAtMax: bThread([
    bSync({
      block: ({ type }) => type === 'increment' && count >= max
    })
  ], true)
})

// Game: Must complete steps in sequence (progression constraint)
bThreads.set({
  enforceSequence: bThread([
    bSync({
      block: ({ type, detail }) =>
        type === 'goto' && detail.step > current + 1
    })
  ], true)
})

// Game: Cannot finish without validation (completion constraint)
bThreads.set({
  requireValidation: bThread([
    bSync({
      block: ({ type }) =>
        type === 'finish' && validated.size < totalSteps
    })
  ], true)
})
```

### Common Game Patterns

| Pattern | bThread Enforcement | User Experience |
|---------|---------------------|-----------------|
| Boundary | Block at max/min | Fair limits |
| Sequence | Block skip-ahead | Guided progression |
| Validation | Block until complete | Quality assurance |
| Cooldown | Block rapid repeat | Prevent spam |

## Combined Lever Type

```typescript
/** Lever union type for structural metadata */
type Lever =
  | { kind: 'affordance'; signal: string }
  | { kind: 'mechanic'; reveal: 'instant' | 'progressive' | 'delayed' }
  | { kind: 'game'; constraint: string }
```

## In Plaited Training

When extracting structural metadata, identify levers:

```typescript
type StructuralMetadata = {
  levers: Lever[]
  // ... other fields
}

// Detection:
// - aria-* attributes → affordance
// - render timing patterns → mechanic
// - bThread block patterns → game
```

## Key Questions

When designing a pattern, ask:
1. How does the user know what to do? (Affordance)
2. How is feedback revealed? (Mechanic)
3. What rules shape behavior? (Game via bThreads)

## Related

- [objects.md](objects.md) - What levers act upon
- [channels.md](channels.md) - Bandwidth affected by levers
- [loops.md](loops.md) - Action→response cycles shaped by levers
