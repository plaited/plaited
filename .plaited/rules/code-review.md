# Code Review Standards

The following standards are not automatically enforced by Biome but should be checked during code review.

## Automated Validation

Before completing a code review, run these validation scripts:

### AgentSkills Validation

When working with AgentSkills directories (`.plaited/skills/`, `.claude/skills/`, `.cursor/skills/`, `.factory/skills/`, etc.):

**Validate structure:**
```bash
bunx @plaited/development-skills validate-skill <path>
```

This checks:
- SKILL.md exists with required frontmatter (name, description)
- Proper naming conventions
- Valid markdown references

## TypeScript Style Conventions

### Prefer `type` Over `interface`

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

**Rationale:** Type aliases are more flexible (unions, intersections, mapped types) and provide consistent syntax across the codebase.

### No `any` Types

Always use proper types; use `unknown` if type is truly unknown and add type guards:

```typescript
// ✅ Good
const process = (data: unknown) => {
  if (typeof data === 'string') {
    return data.toUpperCase()
  }
}

// ❌ Avoid
const process = (data: any) => {
  return data.toUpperCase()
}
```

### PascalCase for Types and Schemas

All type names use PascalCase. Zod schema names use `PascalCaseSchema` suffix:

```typescript
// ✅ Good
type UserConfig = { /* ... */ }
const UserConfigSchema = z.object({ /* ... */ })

// ❌ Avoid
type userConfig = { /* ... */ }
const zUserConfig = z.object({ /* ... */ })  // Don't use z-prefix
```

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

For functions with more than two parameters, use a single object parameter:

```typescript
// ✅ Good: Object parameter pattern
const createClient = ({
  command,
  timeout,
  cwd,
}: {
  command: string[]
  timeout: number
  cwd?: string
}): ACPClient => { /* ... */ }

// ❌ Avoid: Multiple positional parameters
const createClient = (
  command: string[],
  timeout: number,
  cwd?: string
): ACPClient => { /* ... */ }
```

## TypeScript Comment Directives

### `@ts-ignore` Requires Description

- When using `@ts-ignore`, always include a description explaining why the type error is being suppressed
- This helps future maintainers understand the reasoning
- Example:
  ```typescript
  // @ts-ignore - TypeScript incorrectly infers this as string when it's actually a number from the API
  const value = response.data
  ```

**Rationale:** Lost TypeScript-ESLint rule `ban-ts-comment` with `allow-with-description` option during Biome migration

## Expression Statements

### Allow Short-Circuit and Ternary Expressions

- Short-circuit evaluation is acceptable: `condition && doSomething()`
- Ternary expressions are acceptable: `condition ? doThis() : doThat()`
- These patterns are idiomatic and improve code readability

**Rationale:** Lost TypeScript-ESLint rule `no-unused-expressions` with `allowShortCircuit` and `allowTernary` options during Biome migration

## Empty Object Types

### Allow Empty Object Types When Extending a Single Interface

- Empty object types are acceptable when they extend exactly one other interface
- This pattern is useful for creating branded types or extending third-party interfaces
- Example:
  ```typescript
  // ✅ Acceptable: Extends single interface
  interface CustomElement extends HTMLElement {}

  // ❌ Avoid: Empty with no extends or multiple extends
  interface Empty {}
  interface Multi extends Foo, Bar {}
  ```

**Rationale:** Lost TypeScript-ESLint rule `no-empty-object-type` with `allowInterfaces: 'with-single-extends'` option during Biome migration

## Modern JavaScript Standards

### Prefer Private Fields Over `private` Keyword

Use JavaScript private fields (`#field`) instead of TypeScript's `private` keyword:

```typescript
// ✅ Good: JavaScript private fields (ES2022+)
class EventBus {
  #listeners = new Map<string, Set<Function>>()
  #count = 0

  #emit(event: string) {
    this.#count++
    this.#listeners.get(event)?.forEach(fn => fn())
  }
}

// ❌ Avoid: TypeScript private keyword
class EventBus {
  private listeners = new Map<string, Set<Function>>()
  private count = 0

  private emit(event: string) {
    this.count++
    this.listeners.get(event)?.forEach(fn => fn())
  }
}
```

**Rationale:** JavaScript private fields are a runtime feature (ES2022) providing true encapsulation. TypeScript's `private` is erased at compile time and can be bypassed. Prefer platform standards over TypeScript-only features

### JSON Import Attributes

Use import attributes when importing JSON files. This is required because the tsconfig uses `verbatimModuleSyntax: true` without `resolveJsonModule`:

```typescript
// ✅ Good: Import attribute for JSON
import { version } from '../package.json' with { type: 'json' }
import config from './config.json' with { type: 'json' }

// ❌ Avoid: Missing import attribute
import { version } from '../package.json'
import config from './config.json'
```

**Rationale:** Import attributes (ES2025) explicitly declare module types to the runtime. The `with { type: 'json' }` syntax is the standard (replacing the deprecated `assert` keyword). This provides runtime enforcement—if the file isn't valid JSON, the import fails.

## Documentation Standards

### Mermaid Diagrams Only

Use [mermaid](https://mermaid.js.org/) syntax for all diagrams in markdown files:

```markdown
\```mermaid
flowchart TD
    A[Start] --> B[Process]
    B --> C[End]
\```
```

**Avoid**: ASCII box-drawing characters (`┌`, `│`, `└`, `─`, etc.)

**Rationale:** Token efficiency, clearer semantic meaning, easier maintenance.

### No `@example` Sections in TSDoc

Tests serve as living examples. Do not add `@example` sections to TSDoc comments.
