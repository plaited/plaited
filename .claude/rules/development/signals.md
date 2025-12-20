# Signal Usage Best Practices

## Islands Architecture Context

Plaited encourages an **islands-based architecture**. Signals (`useSignal`, `useComputed`) enable **cross-island communication** outside the normal parent-child event flow:

- **Normal event flow**: Parent calls `trigger()` on child element in its shadowDOM, or child uses `emit()` to broadcast events up to parent
- **Signal use case**: Communication between islands that are not in a direct parent-child relationship

## Use `useSignal` for Cross-Island Communication (Actor Pattern)

When you need bidirectional communication with BOTH reading and writing across islands:

```typescript
// ✅ Good: Actor pattern - multiple islands reading AND writing shared state
const store = useSignal<{ count: number }>({ count: 0 })

// Island 1: Reads and writes
const currentCount = store.get()  // READ
store.set({ count: currentCount + 1 })  // WRITE

// Island 2: Listens, reads, and triggers updates in its own island
store.listen('update', () => {
  const count = store.get()  // READ
  someElement?.trigger('count-changed', count)  // Trigger within this island
})
```

## When to Use `useSignal`

- Cross-island communication (islands not in direct parent-child relationship)
- Multiple listeners need to react to state changes
- Actors need to query current state via `.get()`
- Bidirectional communication where both reading and writing are needed
- Shared state across disconnected parts of the component tree

## When NOT to Use `useSignal`

**Use normal event flow (trigger/emit) instead for:**
- Parent-child communication within shadowDOM
- Child-to-parent event broadcasting
- Direct hierarchical relationships

**Avoid using signals for:**
- One-time notifications (use callbacks or promises)
- Single listener scenarios with no state queries
- Communication that follows the component tree hierarchy
