# Code Review Standards

The following standards are not automatically enforced by Biome but should be checked during code review:

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
