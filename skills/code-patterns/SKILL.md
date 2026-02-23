---
name: code-patterns
description: Common code pattern genome for agents. Reference implementations of pure utility functions showing preferred coding style, testing patterns, and TypeScript conventions. Use when writing utility functions, implementing deep equality, async helpers, or similar standalone patterns.
license: ISC
---

# Code Patterns

## Purpose

This skill is a **genome** of common code patterns — reference implementations that teach agents how we prefer utility code to be written. Each pattern demonstrates:

- Pure functions with no side effects
- Arrow function style with `const` declarations
- Proper TypeScript typing (no `any`, use `unknown` with type guards)
- Comprehensive test coverage (happy path, edge cases, falsey values)

**Use this when:**
- Writing standalone utility functions
- Implementing deep comparison, async helpers, or similar patterns
- Needing a reference for our preferred coding conventions
- Writing tests for utility-style code

## Patterns

### Deep Equal

**[deep-equal.ts](references/deep-equal.ts)** — Deep equality comparison for any JavaScript values

A recursive comparator that handles all built-in types including circular references. Demonstrates:

- `Object.is()` for primitive comparison (correct NaN and +0/-0 handling)
- `instanceof` checks for Date, RegExp, Map, Set, TypedArrays
- `WeakMap` for circular reference detection (no memory leaks)
- `Reflect.ownKeys()` for thorough object comparison (includes symbols)
- Early exit optimizations (length/size checks before iteration)

**[deep-equal.spec.ts](references/deep-equal.spec.ts)** — Test coverage

Shows testing conventions: flat `test()` blocks (not `it()`), comment-separated sections for each type category, no conditional assertions.

### Wait

**[wait.ts](references/wait.ts)** — Promise-based delay utility

A minimal async helper showing our conventions for:

- Type-first design (`type Wait` declared separately from implementation)
- Single-expression arrow functions
- Promise wrapping of callback APIs (`setTimeout` → `Promise`)

## Conventions Demonstrated

| Convention | Pattern |
|-----------|---------|
| Arrow functions | `const fn = () =>` not `function fn()` |
| Type over interface | `type Wait = ...` not `interface Wait` |
| No `any` | Use `unknown` with type guards |
| Pure functions | No side effects, deterministic output |
| `test()` not `it()` | Bun test convention |
| No conditional assertions | Assert condition first, then assert value |

## Related Skills

- **behavioral-core** — Event-driven coordination patterns
- **code-documentation** — TSDoc standards for documenting these patterns
