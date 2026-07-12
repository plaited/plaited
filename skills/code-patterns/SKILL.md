---
name: code-patterns
description: >
  Common code pattern genome for agents. Reference implementations of pure
  utility functions showing preferred coding style, testing patterns, and
  TypeScript conventions. Use when writing utility functions, implementing deep
  equality, async helpers, or similar standalone patterns.

  Before writing any custom utility, check if `plaited/utils` already provides
  it. The module exports: keyMirror (constants/enums),
  isTypeOf/trueTypeOf (runtime type checks), and deepEqual (comparison).
  Import from `plaited/utils` instead of reimplementing.
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

## Shared Utilities (`plaited/utils`)

Before writing any custom utility, check if `plaited/utils` already provides it.
Import from `'plaited/utils'` instead of reimplementing:

| Import | Purpose | Example |
|--------|---------|---------|
| `keyMirror` | Self-referential constant objects (event names, enums) | `keyMirror('evt_a', 'evt_b')` → `{ evt_a: 'evt_a', evt_b: 'evt_b' }` |
| `isTypeOf` | TypeScript type guard | `isTypeOf<MyType>(val, 'object')` |
| `trueTypeOf` | Precise runtime type string | `trueTypeOf([])` → `'array'` |
| `deepEqual` | Deep equality comparison | `deepEqual({ a: 1 }, { a: 1 })` → `true` |

These are pure, tested, and framework-agnostic. Reimplementing them wastes tokens and risks subtle bugs (edge cases in deep comparison, ID collision probability).

## Type Boundaries — Parse, Don't Cast

When data crosses into your type system from an untyped boundary (JSON.parse, SQL
results, API responses, event detail payloads, file reads), **use Zod `.parse()` instead
of `as` casts.**

```ts
// BAD — cast asserts without checking
const user = JSON.parse(raw) as User

// GOOD — parse validates and types in one step
const user = UserSchema.parse(JSON.parse(raw))
```

`as` casts suppress the type checker without runtime validation. If the actual shape
diverges from the expected type, a cast silently passes bad data into your system.
Zod `.parse()` catches mismatches at the boundary immediately and produces a correctly
typed value. `z.output<typeof MySchema>` gives you the static type for free — no
separate type declaration needed.

Every external boundary (network, storage, file system, serialization) is a point
where `unknown` enters. Parse at the boundary, trust the parsed value everywhere else.

## Patterns

### Case Conversion

**[case.ts](references/case.ts)** — `camelCase`, `kebabCase`, `pascalCase` string conversion

Regex-based string case conversion handling kebab-case, snake_case, spaces, slashes,
and mixed separators. Demonstrates:

- Multi-pass regex replacement with captured groups
- Separator normalization across different delimiters
- Compositional design (`pascalCase` builds on `camelCase`)

**[case.spec.ts](references/case.spec.ts)** — Test coverage

### HTML Escaping

**[escape.ts](references/escape.ts)** — `htmlEscape` / `htmlUnescape` for XSS prevention

Precompiled regex + lookup table approach to HTML entity escaping. Demonstrates:

- Precompiled regex for performance (global flag, single pass)
- Lookup table pattern for character replacement
- Cached `String.prototype.replace` reference to avoid prototype chain lookup
- Numeric entities for quotes (`&#39;`, `&quot;`) for maximum compatibility

**[escape.spec.ts](references/escape.spec.ts)** — Test coverage

### Unique IDs

**[ueid.ts](references/ueid.ts)** — `ueid` unique-enough ID generator

Combines timestamp and random suffix with base36 encoding. Demonstrates:

- When NOT to use crypto (protocol message IDs, cache keys, event correlation)
- Compositional string building with prefix support
- Base36 encoding for compactness

**[ueid.spec.ts](references/ueid.spec.ts)** — Test coverage

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

- **plaited-runtime** — Event-driven coordination and runtime doctrine
- **code-documentation** — TSDoc standards for documenting these patterns
