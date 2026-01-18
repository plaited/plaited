# Code Review

TypeScript conventions and module organization standards.

## TypeScript Conventions

### Types Over Interfaces

```typescript
// ✅ Prefer type aliases
type UserProps = {
  name: string
  email: string
}

// ❌ Avoid interfaces
interface UserProps {
  name: string
  email: string
}
```

**Rationale**: Types are more flexible (unions, intersections, mapped types) and align with Plaited conventions.

### No `any` Types

```typescript
// ✅ Use unknown with type guards
const parseData = (input: unknown): User => {
  if (isUser(input)) return input
  throw new Error('Invalid user data')
}

// ✅ Use generics for flexibility
const first = <T>(arr: T[]): T | undefined => arr[0]

// ❌ Never use any
const parseData = (input: any): User => input
```

### Arrow Functions

```typescript
// ✅ Arrow functions for most cases
const calculateTotal = (items: Item[]): number =>
  items.reduce((sum, item) => sum + item.price, 0)

// ✅ Function declarations for hoisting needs only
function recursiveHelper(n: number): number {
  if (n <= 1) return n
  return recursiveHelper(n - 1) + recursiveHelper(n - 2)
}
```

### Object Parameters

For functions with 2+ parameters, use object destructuring:

```typescript
// ✅ Object parameter pattern
const createUser = ({
  name,
  email,
  role = 'user',
}: {
  name: string
  email: string
  role?: string
}): User => ({ name, email, role })

// ❌ Positional parameters
const createUser = (name: string, email: string, role?: string): User =>
  ({ name, email, role })
```

## Module Organization

### Import Order

1. External packages (node_modules)
2. Internal packages (workspace)
3. Relative imports (local files)

```typescript
// External
import { expect, test } from 'bun:test'

// Internal packages
import { bElement } from 'plaited'
import { story } from 'plaited/testing'

// Relative
import { helper } from './utils.ts'
import type { Config } from './types.ts'
```

### Export Patterns

```typescript
// ✅ Named exports for most cases
export const formatDate = (date: Date): string => { /* ... */ }
export type DateFormat = 'short' | 'long'

// ✅ Barrel exports in index.ts
export { formatDate } from './format-date.ts'
export type { DateFormat } from './format-date.ts'

// ❌ Avoid default exports (except for main entry)
export default function formatDate() { /* ... */ }
```

### File Naming

- `kebab-case.ts` for all TypeScript files
- `*.spec.ts` for unit tests
- `*.stories.tsx` for template/browser tests
- `*.d.ts` for type declarations

## Code Quality Checks

Before submitting code:

```bash
# Type check, lint, and format
bun run check

# Auto-fix issues
bun run check:write
```
