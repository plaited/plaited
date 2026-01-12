# Objects

> The basis of digital structures - anything conceived as one unit

## Definition

**Objects are anything that can be conceived as one.** What is viewed as "one" changes based on the goal of the system.

| System Goal | Primary Object |
|-------------|----------------|
| Room decoration app | A room |
| Energy monitoring | A building |
| Food access tracking | A neighborhood |
| E-commerce | A product |
| Social media | A post |

## Object Groups

Objects can be structured in different ways to form **object groups**:

| Grouping | Description | Example |
|----------|-------------|---------|
| **Relational** | Objects set beside each other | Recommended songs below playlist |
| **Nested** | Objects contained within categories | Songs in genre folders |
| **Structured Steps** | Objects linked across pages | Checkout flow steps |
| **List** | Objects in defined order | Album tracks |

## In Plaited

Objects map to the data your bElement manages:

```typescript
// Object: A counter value
// Grouping: None (single object)
bProgram({ $ }) {
  let count = 0  // The object
  return {
    increment() { count++ },
    decrement() { count-- }
  }
}
```

```typescript
// Object: A wizard step
// Grouping: List (ordered steps)
const steps = ['Personal Info', 'Address', 'Review']
const state = {
  current: 0,           // Current position in list
  validated: new Set()  // Completed objects
}
```

## Object Types for Training

When extracting structural metadata, identify:

```typescript
type ObjectType = {
  id: string           // Unique identifier
  contentType: string  // 'counter', 'step', 'product', 'comment'
  grouping?: 'nested' | 'relational' | 'list' | 'steps'
}
```

## Key Questions

When designing a pattern, ask:
1. What is the primary object? (What is "one"?)
2. How are objects grouped? (Nested, relational, list, steps?)
3. What defines the boundaries of an object?

## Related

- [channels.md](channels.md) - How objects connect and exchange information
- [blocks.md](blocks.md) - How objects compose into larger structures
