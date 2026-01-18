# Testing

Bun test runner conventions and testing patterns.

## Test Framework

Plaited uses Bun's built-in test runner for unit/integration tests.

### Basic Syntax

```typescript
import { expect, test, describe, beforeEach, mock } from 'bun:test'

// ✅ Use test() not it()
test('should validate email format', () => {
  expect(isValidEmail('user@example.com')).toBe(true)
})

// ✅ Group related tests
describe('EmailValidator', () => {
  test('accepts valid emails', () => { /* ... */ })
  test('rejects invalid emails', () => { /* ... */ })
})
```

### File Naming

| Pattern | Purpose | Runner |
|---------|---------|--------|
| `*.spec.ts` | Unit/integration tests | `bun test` |
| `*.spec.tsx` | Tests with JSX | `bun test` |
| `*.stories.tsx` | Template/browser tests | Workshop CLI |

## Assertion Patterns

### Assert Existence Before Values

```typescript
// ✅ Check existence first
const user = getUser(id)
expect(user).toBeDefined()
expect(user.name).toBe('Alice')

// ❌ Don't assume existence
expect(getUser(id).name).toBe('Alice')
```

### No Conditionals Around Assertions

```typescript
// ✅ Test specific scenarios
test('handles missing user', () => {
  const user = getUser('nonexistent')
  expect(user).toBeUndefined()
})

test('returns user when found', () => {
  const user = getUser('valid-id')
  expect(user).toBeDefined()
  expect(user.name).toBe('Alice')
})

// ❌ Don't conditionally assert
test('gets user', () => {
  const user = getUser(id)
  if (user) {
    expect(user.name).toBe('Alice')
  }
})
```

### Use Specific Matchers

```typescript
// ✅ Specific matchers
expect(array).toHaveLength(3)
expect(string).toContain('hello')
expect(obj).toMatchObject({ name: 'Alice' })
expect(fn).toThrow(ValidationError)

// ❌ Generic equality for complex checks
expect(array.length === 3).toBe(true)
```

## Mocking

```typescript
import { mock, spyOn } from 'bun:test'

// Mock functions
const mockFetch = mock(() => Promise.resolve({ ok: true }))

// Spy on methods
const spy = spyOn(console, 'log')
expect(spy).toHaveBeenCalledWith('message')
```

## Running Tests

```bash
# Run all tests
bun test

# Run specific file
bun test src/utils/validator.spec.ts

# Run with pattern
bun test --grep "email"

# Watch mode
bun test --watch
```

## Template/Browser Tests

For visual templates and user interactions, use stories:

```bash
# Run story tests
bun run test:stories

# Run for specific directory
bun run test:stories src/templates

# Dev server for manual testing
bun run dev
```

See `.claude/rules/plaited-rules.md` for story test patterns.
