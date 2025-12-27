# Null Handling and Type Assertions

**Use non-null assertions (`!`) when elements are guaranteed to exist** by the framework or element structure. Use optional chaining (`?.`) for defensive programming when existence is uncertain.

## DOM Element Query Patterns

### In the `bProgram` callback of `bElement` where elements are defined in `shadowDom`:

```typescript
// ✅ Good: Non-null assertion for guaranteed elements
bProgram({ $ }) {
  const template = $<HTMLTemplateElement>('row-template')[0]!
  const slot = $<HTMLSlotElement>('slot')[0]

  return {
    someHandler() {
      // Use optional chaining for runtime safety
      const table = $('table')[0]
      table?.render('content')
    }
  }
}
```

## Array Destructuring vs Indexed Access

```typescript
// ✅ Preferred: Direct indexed access with optional chaining
let slot = $<HTMLSlotElement>('slot')[0]
let input = slot?.assignedElements()[0]

// ❌ Avoid: Destructuring with fallback arrays (verbose)
let [slot] = $<HTMLSlotElement>('slot')
let [input] = slot?.assignedElements() ?? []
```

## When to Use Each Pattern

### 1. Non-null Assertion (`!`)

Element defined in template, guaranteed to exist

```typescript
const template = $<HTMLTemplateElement>('my-template')[0]!
```

### 2. Optional Chaining (`?.`)

Element may not exist, dynamic content, or runtime queries

```typescript
const dynamicEl = $('dynamic-target')[0]
dynamicEl?.attr('class', 'active')
```

### 3. Indexed Access Over Destructuring

Cleaner for single element queries

```typescript
// ✅ Good
const slot = $<HTMLSlotElement>('slot')[0]

// ❌ Verbose
const [slot] = $<HTMLSlotElement>('slot')
```

## Rationale

Non-null assertions express confidence in element presence when structurally guaranteed. Optional chaining provides runtime safety for uncertain cases. Indexed access is cleaner than destructuring for single elements.
