# Plaited Code Conventions

Essential code style and conventions for writing idiomatic Plaited code.

## General Preferences

- Prefer arrow functions over function declarations
- Avoid using `any` type - use proper TypeScript types
- Use `test` instead of `it` in test files
- Prefer Bun native APIs over Node.js equivalents (see standards.md#bun-platform-apis)

## Type System

### Prefer `type` over `interface`

Use type aliases instead of interfaces for better consistency and flexibility:

```typescript
// ✅ Good
type User = {
  name: string
  email: string
}

// ❌ Avoid
interface User {
  name: string
  email: string
}
```

### No `any` Types

Always use proper types; use `unknown` if type is truly unknown and add type guards:

```typescript
// ✅ Good
function process(data: unknown) {
  if (typeof data === 'string') {
    return data.toUpperCase()
  }
}

// ❌ Avoid
function process(data: any) {
  return data.toUpperCase()
}
```

### PascalCase for Types and Schemas

All type names and Zod schema names should use PascalCase:

```typescript
// ✅ Good
type UserConfigType = { /* ... */ }
const ApiResponseSchema = z.object({ /* ... */ })

// ❌ Avoid
type userConfig = { /* ... */ }
const api_response_schema = z.object({ /* ... */ })
```

## Function Style

### Arrow Functions Preferred

```typescript
// ✅ Good
const greet = (name: string) => `Hello, ${name}!`

// ❌ Avoid
function greet(name: string) {
  return `Hello, ${name}!`
}
```

### Object Parameter Pattern

**For functions with more than two parameters**, use a single object parameter with named properties:

```typescript
// ✅ Good: Object parameter pattern
const toStoryMetadata = ({
  exportName,
  filePath,
  storyExport,
}: {
  exportName: string
  filePath: string
  storyExport: StoryExport
}): StoryMetadata => { /* ... */ }

// ❌ Avoid: Multiple positional parameters
const toStoryMetadata = (
  exportName: string,
  filePath: string,
  storyExport: StoryExport
): StoryMetadata => { /* ... */ }
```

## Template Creation

**IMPORTANT**: Always use JSX syntax for creating templates in tests, examples, and application code.

```typescript
// ✅ Good: JSX syntax
<div className="foo">Hello</div>

// ❌ Avoid: Direct h() or createTemplate() calls
h('div', { className: 'foo' }, 'Hello')
createTemplate('div', { className: 'foo', children: 'Hello' })
```

**Rationale:** `h()` and `createTemplate()` are internal JSX transformation functions exported only through jsx-runtime modules. They are not part of the public API and should not be used directly. JSX provides better type safety, readability, and IDE support.

## Import Path Standards

**IMPORTANT**: Use package imports instead of relative paths in test files and fixtures for better maintainability.

### In Test Files and Fixtures

```typescript
// ✅ Good: Package imports in test files
import { bElement, type FT } from 'plaited'
import { story } from 'plaited/testing'
import { wait, noop } from 'plaited/utils'

// ❌ Avoid: Relative paths in test files
import { bElement, type FT } from '../../../../main.ts'
import { story } from '../../../../../testing/testing.fixture.tsx'
import { wait, noop } from '../../utils.ts'
```

### When to Use Relative Imports

- Within the same module/directory for local dependencies
- Test fixtures importing other fixtures in the same test directory
- Shared test utilities within the test directory

**Rationale:** Package imports are cleaner, resilient to directory restructuring, and match how consumers will import from the published package.

## Null Handling

**Use non-null assertions (`!`) when elements are guaranteed to exist** by the framework or element structure. Use optional chaining (`?.`) for defensive programming when existence is uncertain.

### DOM Element Query Patterns

In the `bProgram` callback of `bElement` where elements are defined in `shadowDom`:

```typescript
bProgram({ $ }) {
  // ✅ Good: Non-null assertion for guaranteed elements
  const template = $<HTMLTemplateElement>('row-template')[0]!
  const slot = $<HTMLSlotElement>('slot')[0]!

  return {
    someHandler() {
      // ✅ Good: Optional chaining for runtime safety
      const table = $('table')[0]
      table?.render('content')
    }
  }
}
```

### Array Destructuring vs Indexed Access

```typescript
// ✅ Preferred: Direct indexed access with optional chaining
let slot = $<HTMLSlotElement>('slot')[0]
let input = slot?.assignedElements()[0]

// ❌ Avoid: Destructuring with fallback arrays (verbose)
let [slot] = $<HTMLSlotElement>('slot')
let [input] = slot?.assignedElements() ?? []
```

### When to Use Each Pattern

**1. Non-null Assertion (`!`)** - Element defined in template, guaranteed to exist:

```typescript
const template = $<HTMLTemplateElement>('my-template')[0]!
```

**2. Optional Chaining (`?.`)** - Element may not exist, dynamic content, or runtime queries:

```typescript
const dynamicEl = $('dynamic-target')[0]
dynamicEl?.attr('class', 'active')
```

**3. Indexed Access Over Destructuring** - Cleaner for single element queries:

```typescript
// ✅ Good
const slot = $<HTMLSlotElement>('slot')[0]

// ❌ Verbose
const [slot] = $<HTMLSlotElement>('slot')
```

**Rationale:** Non-null assertions express confidence in element presence when structurally guaranteed. Optional chaining provides runtime safety for uncertain cases. Indexed access is cleaner than destructuring for single elements.

## Test Naming

Use `test` instead of `it` in test files:

```typescript
// ✅ Good
test('should render button correctly', () => {
  // ...
})

// ❌ Avoid
it('should render button correctly', () => {
  // ...
})
```

## Type Inference

Leverage TypeScript's type inference where appropriate:

```typescript
// ✅ Good: Let TypeScript infer when obvious
const styles = createStyles({
  button: {
    padding: '10px'
  }
})

// ❌ Avoid: Explicit type when inference works
const styles: StylesObject = createStyles({
  button: {
    padding: '10px'
  }
})
```

## Union and Intersection Types

Use union types and intersection types effectively:

```typescript
// ✅ Union type for alternatives
type Status = 'pending' | 'active' | 'completed'

// ✅ Intersection type for composition
type UserWithTimestamps = User & {
  createdAt: Date
  updatedAt: Date
}
```
