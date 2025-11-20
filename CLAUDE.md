# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development Setup
```bash
# Install dependencies (requires bun >= v1.2.9)
bun install

# Type checking
bun run check

# Type checking with watch mode
bun run check:watch

# Linting (check only, no fixes)
bun run lint

# Lint and format (auto-fix issues)
bun run lint-fix
```

## Testing

Plaited uses Bun's built-in test runner for unit and integration tests, and a custom workshop CLI for browser-based template tests.

### Test Types

#### Unit/Integration Tests (`*.spec.{ts,tsx}`)
- Standard Bun tests using `*.spec.ts` or `*.spec.tsx` extensions
- Run with `bun test` command
- Used for testing business logic, utilities, behavioral programs, and non-visual functionality
- No browser or DOM dependencies required

#### Template/Browser Tests (`*.stories.tsx`)
- Browser-based tests using Playwright integration via the workshop CLI
- Use `*.stories.tsx` extension
- Run with the workshop CLI at `src/workshop/cli.ts`
- Test visual templates, user interactions, and accessibility
- Powered by `story` helper from `plaited/testing`

### Running Tests

```bash
# Run all tests (both spec tests and story tests)
bun run test

# Run only unit/integration tests
bun test

# Run only template/browser tests (via package.json script)
bun run test-stories

# Run template tests directly with CLI
bun src/workshop/cli.ts test

# Run template tests from specific directory
bun src/workshop/cli.ts test src/components

# Run template tests from specific file(s)
bun src/workshop/cli.ts test src/Button.stories.tsx

# Run template tests with custom port
bun src/workshop/cli.ts test -p 3500

# Run template tests with custom working directory
bun src/workshop/cli.ts test -d ./my-project

# Run template tests with hot reload (auto-rerun on file changes)
bun --hot src/workshop/cli.ts test
```

### Running Specific Test Files

```bash
# Run a specific spec test file
bun test path/to/file.spec.ts

# Run tests matching a pattern
bun test pattern
```

### Test File Naming Conventions

- **`*.spec.ts` or `*.spec.tsx`**: Unit/integration tests run with Bun
- **`*.stories.tsx`**: Template/browser tests run with workshop CLI

## Architecture Overview

### Core Concepts

Plaited is a behavioral programming framework for building reactive web components with these key architectural pillars:

1. **Behavioral Programming (BP) Paradigm**
   - Located in `src/main/behavioral.ts` and related files
   - Central coordination through `behavioral()` factory which manages b-threads
   - Thread composition with `bThread()` and `bSync()` utilities
   - Higher-level `useBehavioral()` for reusable program configurations
   - Event-driven architecture with request/waitFor/block/interrupt idioms
   - Signals for reactive state management (`useSignal`, `useComputed`)
   - Type guards (`isBPEvent`, `isPlaitedTrigger`) for runtime validation

2. **Web Components with Shadow DOM**
   - `bElement` in `src/main/b-element.ts` creates custom elements
   - Automatic style scoping via Constructable Stylesheets
   - Template system with JSX support
   - Helper methods attached to DOM elements via `p-target` attributes
   - Declarative event binding via `p-trigger` attributes
   - MutationObserver for dynamic content monitoring
   - Form-associated custom elements support via ElementInternals
   - Type guards (`isBehavioralElement`, `isBehavioralTemplate`) for validation

3. **CSS-in-JS System**
   - `createStyles()` for atomic CSS class generation with hash-based naming
   - `createHostStyles()` for styling custom element host (`:host` selector)
   - `createKeyframes()` for CSS animation definitions
   - `createTokens()` for design token system with CSS custom properties
   - `joinStyles()` for composing multiple style objects
   - Automatic style adoption in Shadow DOM via Constructable Stylesheets
   - Style deduplication and caching per ShadowRoot
   - Support for nested rules (media queries, pseudo-classes, attribute selectors)

### Key Architectural Patterns

#### Event Flow Architecture
```
External Trigger → bProgram → Event Selection → Thread Notification → Feedback Handlers
                     ↑                              ↓
                  b-threads ←─────────────────── State Updates
```

#### Template Lifecycle
1. Element defined with `bElement`
2. Shadow DOM created with template
3. `bProgram` initialized with threads
4. Elements bound via `p-target` attributes
5. Event triggers connected via `p-trigger`
6. Reactive updates through helper methods

#### Signal Pattern
- `useSignal`: Creates reactive state containers
- `useComputed`: Derived state with automatic updates
- Signals integrate with PlaitedTrigger for automatic cleanup

### Module Organization

- **`src/main/`**: Core framework including:
  - Web Components: `bElement`, `bWorker`, type guards (`isBehavioralElement`, `isBehavioralTemplate`)
  - Behavioral Programming: `behavioral`, `bThread`, `bSync`, `useBehavioral`, behavioral type guards
  - State Management: `useSignal`, `useComputed`, reactive signals
  - Styling: `createStyles`, `createHostStyles`, `createKeyframes`, `createTokens`, `joinStyles`
  - Templates: `ssr`, `useTemplate`, template types
  - Utilities: `useDispatch`, `useAttributesObserver`, `useWorker`
- **`src/utils/`**: Pure utility functions (type checking, string manipulation, DOM utilities, etc.)
- **`src/workshop/`**: Development and testing tools:
  - Template discovery: `getBehavioralTemplateMetadata`, `discoverBehavioralTemplateMetadata`
  - Story discovery: `getStoryMetadata`, `discoverStoryMetadata`
  - Test infrastructure: `useRunner`, `TEST_RUNNER_EVENTS`
  - Types: `TemplateType`, `TemplateExport`, `StoryMetadata`, `TestResult`, `TestStoriesOutput`
- **`src/testing/`**: Story factory function (`story`) and type definitions for template-based testing
- **`src/stories/`**: Example story files demonstrating framework usage

### Critical Implementation Details

1. **DOM Updates**: Helper methods (`render`, `insert`, `attr`, `replace`) are attached once per element via `Object.assign` for performance

2. **Style Management**: Uses WeakMap caching to prevent duplicate style adoption per ShadowRoot; hash-based class names for deduplication

3. **Event Scheduling**: Priority-based event selection with blocking capabilities in super-step execution model

4. **Memory Management**: Automatic cleanup via internal PlaitedTrigger system and WeakMap for styles; disconnect callbacks invoked on component removal

5. **Type Safety**: Runtime type guards (`isBehavioralElement`, `isBehavioralTemplate`, `isBPEvent`, `isPlaitedTrigger`) ensure type correctness

6. **Form Integration**: ElementInternals API support for form-associated custom elements with full lifecycle callbacks

7. **Security**: Public event filtering prevents unauthorized internal event triggering; automatic HTML escaping in templates

## Code Style Preferences

- Prefer arrow functions over function declarations
- Avoid using `any` type - use proper TypeScript types
- Use `test` instead of `it` in test files
- Prefer Bun native APIs over Node.js equivalents (see Bun API Preferences below)
- **Prefer `type` over `interface`**: Use type aliases instead of interfaces for better consistency and flexibility
- **No `any` types**: Always use proper types; use `unknown` if type is truly unknown and add type guards
- **PascalCase for types and schemas**: All type names and Zod schema names should use PascalCase (e.g., `UserConfigSchema`, `ApiResponseType`)
- Use union types and intersection types effectively
- Leverage TypeScript's type inference where appropriate
- **Object parameter pattern**: For functions with more than two parameters, use a single object parameter with named properties instead of positional parameters. This improves readability and makes the function calls self-documenting.
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
  }): StoryMetadata => { ... }

  // ❌ Avoid: Multiple positional parameters
  const toStoryMetadata = (
    exportName: string,
    filePath: string,
    storyExport: StoryExport
  ): StoryMetadata => { ... }
  ```

### Signal Usage Best Practices

**Use `useSignal` for the Actor Pattern** - when you need bidirectional communication with BOTH reading and writing:

```typescript
// ✅ Good: Actor pattern - multiple actors reading AND writing shared state
const store = useSignal<{ count: number }>({ count: 0 })

// Actor 1: Reads and writes
const currentCount = store.get()  // READ
store.set({ count: currentCount + 1 })  // WRITE

// Actor 2: Listens and reads
store.listen('update', () => {
  console.log(store.get())  // READ
})
```

**DON'T use `useSignal` for one-way callbacks** - use `Promise.withResolvers()` instead:

```typescript
// ❌ Avoid: Using signal as one-time callback (no .get(), single listener)
const reporter = useSignal<Results>()
const promise = new Promise(resolve => reporter.listen('_', ({ detail }) => resolve(detail)))
await someFunction({ reporter })  // calls reporter.set() once

// ✅ Good: Use Promise.withResolvers for one-time callbacks
const { promise, resolve } = Promise.withResolvers<Results>()
await someFunction({ onComplete: resolve })  // calls resolve() once
```

**About `Promise.withResolvers()`:**
- ES2024 standard feature supported by Bun and modern browsers
- Returns an object with `{ promise, resolve, reject }` for external promise control
- Cleaner alternative to wrapping `new Promise((resolve, reject) => { ... })`
- Perfect for callback-based APIs where you need to await a future result
- Use when you need to pass `resolve`/`reject` functions to other code

**When to use `useSignal`:**
- Multiple listeners need to react to state changes
- Actors need to query current state via `.get()`
- Bidirectional communication between components
- Shared state management with both read and write access

**When to use `Promise.withResolvers()` or callbacks:**
- One-time notifications or results
- Single listener waiting for completion
- Unidirectional data flow
- No need to query current state

### Code Review Standards

The following standards are not automatically enforced by Biome but should be checked during code review:

#### TypeScript Comment Directives

**`@ts-ignore` requires description:**
- When using `@ts-ignore`, always include a description explaining why the type error is being suppressed
- This helps future maintainers understand the reasoning
- Example:
  ```typescript
  // @ts-ignore - TypeScript incorrectly infers this as string when it's actually a number from the API
  const value = response.data
  ```

**Rationale:** Lost TypeScript-ESLint rule `ban-ts-comment` with `allow-with-description` option during Biome migration

#### Expression Statements

**Allow short-circuit and ternary expressions:**
- Short-circuit evaluation is acceptable: `condition && doSomething()`
- Ternary expressions are acceptable: `condition ? doThis() : doThat()`
- These patterns are idiomatic and improve code readability

**Rationale:** Lost TypeScript-ESLint rule `no-unused-expressions` with `allowShortCircuit` and `allowTernary` options during Biome migration

#### Empty Object Types

**Allow empty object types when extending a single interface:**
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

### Template Creation

**IMPORTANT**: Always use JSX syntax for creating templates in tests, examples, and application code.

- ✅ Use JSX syntax: `<div className="foo">Hello</div>`
- ❌ Avoid `h()` or `createTemplate()` direct calls (these are internal transformation functions)
- JSX is automatically transformed to `createTemplate()` calls by TypeScript/Bun
- JSX provides better type safety, readability, and IDE support

**Rationale:** `h()` and `createTemplate()` are internal JSX transformation functions exported only through jsx-runtime modules. They are not part of the public API and should not be used directly.

### Bun API Preferences

**IMPORTANT**: Prefer Bun's native APIs over Node.js equivalents when running in Bun environment.

**File System Operations:**
- ✅ Use `Bun.file(path).exists()` instead of `fs.existsSync()`
- ✅ Use `Bun.file(path)` API for reading/writing files
- ✅ Use `Bun.write()` for efficient file writes

**Shell Commands:**
- ✅ Use `Bun.$` template literal for shell commands
- ❌ Avoid `child_process.spawn()` or `child_process.exec()`
- Example: `await Bun.$\`npm install\`` instead of spawn('npm', ['install'])

**Path Resolution:**
- ✅ Use `Bun.resolveSync()` for module resolution
- ✅ Use `import.meta.dir` for current directory
- ⚠️ Keep `node:path` utilities for path manipulation (join, resolve, dirname)

**Package Management:**
- ✅ Use `Bun.which(cmd)` to check for executables
- ⚠️ No programmatic package manager API yet - use CLI commands via `Bun.$`

**Environment Detection:**
- ✅ Check `typeof Bun !== 'undefined'` for Bun runtime
- ✅ Use `Bun.which('bun')` to verify bun executable exists

**When to Use Node.js APIs:**
- Interactive input (readline)
- Complex path manipulation (prefer node:path utilities)
- APIs without Bun equivalents

**Bun Documentation:**
- Main docs: https://bun.sh/docs
- Shell API: https://bun.sh/docs/runtime/shell
- File I/O: https://bun.sh/docs/api/file-io
- Runtime APIs: https://bun.sh/docs/runtime/bun-apis

## Terminology: Templates Not Components

**IMPORTANT**: Plaited is a **template-based** framework, not a component-based framework.

- ✅ Use: template, templates, FunctionTemplate, BehavioralTemplate
- ❌ Avoid: component, components (except when referring to Web Components API)

**Exception**: The term "Web Components" refers to the browser's Custom Elements API and should remain unchanged. This is the standard term for custom HTML elements created with `customElements.define()`.

**In documentation and code:**
- Plaited templates (created with `bElement` or as functions)
- Template exports, template metadata, template discovery
- Template tests (not component tests)
- Template lifecycle (not component lifecycle)

## TSDoc Comment Standards

### Documentation Philosophy
- Public APIs require comprehensive documentation without code examples (tests/stories serve as living examples)
- Internal modules need maintainer-focused documentation
- All documentation should be practical and actionable
- Avoid redundant or obvious comments
- Use `@internal` marker for non-public APIs
- Document the "why" not just the "what"
- **No `@example` sections in TSDoc** - Tests and stories provide living examples
- **Type over interface**: Always prefer `type` declarations
- **Factory functions only**: Never show raw `yield` statements in behavioral documentation
- **Cross-references**: Use `@see` tags to connect related APIs

### Agent TSDoc Generation Workflow

When creating or updating TSDoc comments, follow this systematic exploration process:

#### Phase 1: Type & Interface Analysis
1. **Identify the target** (function, type, class, or module)
2. **Analyze type signatures:**
   - Parameter types and constraints
   - Return types
   - Generic type parameters
   - Type relationships and dependencies
3. **Trace type dependencies:**
   - What types does this depend on?
   - What types depend on this?
   - Are there related utility types?

#### Phase 2: Usage Reference Discovery
1. **Find all usage locations:**
   - Search codebase for imports and references
   - Identify calling patterns
   - Note common usage contexts
2. **Analyze integration points:**
   - How is this used in the architecture?
   - What modules consume this?
   - What are the typical call chains?

#### Phase 3: Test & Story Analysis
1. **Review test files** (`.test.ts`, `.spec.ts`):
   - What behaviors are tested?
   - What edge cases are covered?
   - What scenarios are validated?
2. **Review story files** (`.stories.tsx`):
   - How is this used in practice?
   - What real-world scenarios exist?
   - What configurations are demonstrated?

#### Phase 4: Documentation Generation
1. **Synthesize findings** from phases 1-3
2. **Apply appropriate TSDoc template** (see TSDoc Format Guidelines below)
3. **Cross-reference related APIs** using `@see` tags
4. **Document discovered constraints** in `@remarks`
5. **Note performance characteristics** if evident from usage
6. **Identify limitations** found in tests or usage patterns

### TSDoc Format Guidelines

#### Public API Functions

```typescript
/**
 * Concise one-line description of functionality.
 * Extended explanation providing context, use cases, and when to use this.
 *
 * @template T - Description of generic type parameter and constraints
 * @param paramName - Parameter purpose, constraints, and expected values
 * @returns Description of return value, what it represents, and guarantees
 *
 * @remarks
 * - Key behavioral characteristics
 * - Important execution details
 * - Performance considerations (with Big-O if relevant)
 * - Common pitfalls or gotchas
 * - Threading/async behavior if applicable
 *
 * @throws {ErrorType} When and why this error occurs
 *
 * @see {@link RelatedFunction} for related functionality
 * @see {@link RelatedType} for type details
 * @since 1.0.0
 */
```

#### Internal Module Documentation

```typescript
/**
 * @internal
 * @module module-name
 *
 * Purpose: Why this module exists in the codebase
 * Architecture: How it fits into the overall system design
 * Dependencies: What this module depends on (be specific)
 * Consumers: What parts of the system use this module
 *
 * Maintainer Notes:
 * - Key implementation details and design decisions
 * - Important invariants that must be maintained
 * - Tricky aspects of the implementation
 * - Performance-critical sections with complexity analysis
 *
 * Common modification scenarios:
 * - When you might need to modify this module
 * - How to extend functionality safely
 * - What to watch out for when making changes
 *
 * Performance considerations:
 * - Optimization strategies used
 * - Memory management concerns
 * - Computational complexity (Big-O notation)
 *
 * Known limitations:
 * - Current constraints or technical debt
 * - Planned improvements
 * - Workarounds for known issues
 */
```

#### Public Types

```typescript
/**
 * Description of what this type represents in the API.
 * When and why to use this type.
 *
 * @template T - Generic parameter description and constraints
 * @property propName - What this property controls or represents
 * @property optionalProp - Purpose and when to include this property
 *
 * @remarks
 * - Type constraints and relationships
 * - Common usage patterns
 * - Integration with other types
 *
 * @see {@link RelatedType} for related type definitions
 * @since 1.0.0
 */
export type TypeName<T> = {
  propName: string;
  optionalProp?: number;
}
```

#### Internal Types

```typescript
/**
 * @internal
 * What this type represents internally and why it exists.
 * How it's used in the implementation.
 *
 * @property propName - Internal property purpose
 *
 * @remarks
 * - Implementation-specific constraints
 * - Why this structure was chosen
 */
type InternalType = {
  // Implementation-specific properties
}
```

#### Internal Helper Functions

```typescript
/**
 * @internal
 * Brief description of what this internal function does.
 * Why it exists and how it's used within the module.
 *
 * @param paramName - Parameter purpose
 * @returns Return value meaning
 *
 * @remarks
 * - Algorithm details (e.g., "Fisher-Yates shuffle")
 * - Complexity: O(n) where n is...
 * - Why this approach was chosen
 */
const internalHelper = () => { ... }
```

#### Behavioral Programming Functions

**CRITICAL:** For behavioral programming APIs (bSync, bThread, behavioral, useBehavioral), always use factory functions in documentation - never raw `yield` statements.

```typescript
/**
 * Creates a behavioral thread for coordinating async operations.
 * Explain the coordination pattern and synchronization approach.
 *
 * @param config - Thread configuration options
 * @returns Configured behavioral thread
 *
 * @remarks
 * - Thread execution model (sequential through sync points)
 * - Event coordination semantics
 * - Blocking precedence rules
 * - Repetition behavior
 * - Integration with trigger/feedback mechanisms
 *
 * @see {@link bSync} for creating sync points
 * @see {@link behavioral} for program setup
 * @see {@link Idioms} for synchronization options
 * @since 1.0.0
 */
```

#### Special Annotations

**Security-Sensitive Code:**
```typescript
/**
 * @internal
 * SECURITY: This function handles [sensitive operation].
 *
 * Security considerations:
 * - Input sanitization approach
 * - XSS/injection prevention measures
 * - Authentication/authorization requirements
 */
```

**Performance-Critical Code:**
```typescript
/**
 * @internal
 * PERFORMANCE: Hot path - called [frequency/context].
 *
 * Performance notes:
 * - Optimization strategy (e.g., "minimal allocations")
 * - Caching approach (e.g., "WeakMap cache")
 * - Complexity: O(1) lookup after initial computation
 */
```

**Deprecated Code:**
```typescript
/**
 * @deprecated Use {@link NewFunction} instead. Will be removed in v8.0.
 *
 * Migration path: [Brief guidance on how to migrate]
 *
 * @see {@link NewFunction}
 */
```

#### Required Elements by Context

**All Public APIs Must Include:**
- One-line description + extended context
- `@param` for all parameters
- `@returns` for return values
- `@remarks` section with behavioral notes
- `@see` tags to related APIs

**All Internal Modules Must Include:**
- Purpose and architecture context
- Dependencies and consumers
- Maintainer notes
- Modification scenarios
- Performance considerations
- Known limitations

**All Types Must Include:**
- Description of what it represents
- `@property` documentation for all properties
- `@template` for generic parameters
- `@remarks` for constraints and patterns

### Type Documentation Guidelines

**IMPORTANT**: This project prefers `type` over `interface` in both code and TSDoc comments. Always use `type` declarations unless there's a specific need for interface features like declaration merging.

#### Type Analysis Process

When documenting types, follow this discovery process:

1. **Analyze type structure:**
   - Identify all properties and their types
   - Find optional vs required properties
   - Trace generic type parameters
   - Identify union and intersection types

2. **Find type relationships:**
   - What types does this extend or implement?
   - What types reference this type?
   - What utility types are derived from this?
   - Are there branded/nominal types involved?

3. **Discover usage patterns:**
   - How is this type constructed?
   - What validation occurs?
   - Are there Zod schemas associated?
   - What are the common configurations?

4. **Document from analysis:**
   - Property purposes from usage context
   - Constraints from validation/tests
   - Relationships from type dependencies
   - Patterns from real usage

#### Complex Object Types

```typescript
/**
 * Configuration for [purpose].
 * Used by [consumers] to [achieve goal].
 *
 * @template T - [Constraint and purpose of generic]
 * @property propName - [Purpose discovered from usage]
 * @property optionalProp - [When to include, discovered from tests]
 *
 * @remarks
 * - Validation: [Zod schema or validation rules if present]
 * - Defaults: [Default values if any]
 * - Constraints: [Type constraints or invariants]
 * - Common patterns: [Patterns found in usage]
 *
 * @see {@link RelatedType} for [relationship]
 * @since 1.0.0
 */
export type ConfigType<T> = {
  propName: string;
  optionalProp?: T;
}
```

#### Union Types

```typescript
/**
 * Represents [different states/variants].
 * Each variant is used when [context].
 *
 * @remarks
 * - Discriminant property: [if discriminated union]
 * - Type guards: {@link isVariantA}, {@link isVariantB}
 * - Selection logic: [how variants are chosen]
 *
 * @see {@link TypeGuard} for runtime type checking
 */
export type UnionType = VariantA | VariantB | VariantC;
```

#### Function Types

```typescript
/**
 * Callback invoked when [event/condition].
 * Implementation should [expectations].
 *
 * @param paramName - [Purpose from calling context]
 * @returns [What return value controls]
 *
 * @remarks
 * - Called: [When/how often this is invoked]
 * - Context: [What 'this' refers to if relevant]
 * - Timing: [Sync/async behavior]
 *
 * @see {@link RegisterFunction} for registration
 */
export type CallbackType = (param: Type) => ReturnType;
```

#### Utility Types

```typescript
/**
 * @internal
 * Utility type for [transformation purpose].
 * Maps [source] to [result] by [mechanism].
 *
 * @template T - Input type constraints
 *
 * @remarks
 * - Usage: Found in [locations]
 * - Preserves: [what type properties are maintained]
 * - Transforms: [what changes occur]
 */
type UtilityType<T> = { [K in keyof T]: Transform<T[K]> };
```

#### Branded/Nominal Types

```typescript
/**
 * Branded type ensuring [guarantee].
 * Created via {@link createBrand} to enforce [invariant].
 *
 * @remarks
 * - Brand purpose: [why nominal typing is used]
 * - Validation: [what makes a value valid]
 * - Construction: Must use factory function
 *
 * @see {@link createBrand} for creating valid instances
 */
export type BrandedType = string & { readonly brand: unique symbol };
```

#### Discriminated Unions

```typescript
/**
 * Discriminated union for [variants].
 * Discriminant: 'type' property
 *
 * @remarks
 * Variants:
 * - type: 'a' - [When this variant is used]
 * - type: 'b' - [When this variant is used]
 * - type: 'c' - [When this variant is used]
 *
 * Type narrowing: Use switch on 'type' property
 *
 * @see {@link isVariant} for type guards
 */
```

#### Mapped Types

```typescript
/**
 * @internal
 * Maps [source] properties to [result] structure.
 *
 * @template T - Source object type
 *
 * @remarks
 * Transformation:
 * - [What happens to keys]
 * - [What happens to values]
 * - [What properties are added/removed]
 *
 * Usage: [Where this mapped type is applied]
 */
```

#### Recursive Types

```typescript
/**
 * Recursive type representing [tree/nested structure].
 *
 * @remarks
 * Recursion:
 * - Base case: [When recursion stops]
 * - Recursive case: [How nesting continues]
 * - Depth limits: [Any constraints on depth]
 *
 * Traversal: {@link traverseFunction}
 */
```

#### Zod Schema Integration

When types have associated Zod schemas:

```typescript
/**
 * Configuration validated by {@link ConfigSchema}.
 *
 * @property prop - [Purpose] (validated: [Zod validation rules])
 *
 * @remarks
 * Validation:
 * - Schema: {@link ConfigSchema}
 * - Required fields: [list]
 * - Optional fields: [list]
 * - Default values: [from schema defaults]
 * - Validation errors: {@link ConfigError}
 *
 * @see {@link ConfigSchema} for validation rules
 */
```

#### Property Documentation

**Required for each property:**
```typescript
@property propName - [Purpose] [Constraints] [When to use]
```

**Discovery sources:**
1. From usage: How the property is accessed/used
2. From tests: What values are tested, edge cases
3. From validation: Zod schemas, type guards
4. From defaults: Default values in code

#### Generic Type Parameters

**Always document with:**
```typescript
@template T - [Constraint] [Purpose] [Where it flows]
```

**Discovery process:**
1. Find where T is used in type body
2. Identify constraints (extends clauses)
3. Trace how T flows through type
4. Note variance (in/out if relevant)

#### Cross-Referencing Types

**Always link:**
- Related types (subtypes, supertypes)
- Factory functions that create instances
- Type guards that check instances
- Validation schemas
- Consumer functions/classes

**Format:**
```typescript
/**
 * @see {@link ParentType} for base type definition
 * @see {@link createInstance} for creating valid instances
 * @see {@link isInstanceOf} for runtime type checking
 * @see {@link InstanceSchema} for validation schema
 * @see {@link Consumer} for primary consumer
 */
```

## Important Constraints

1. **No Open Contribution**: This is open-source but not open-contribution
2. **Bun Required**: Development requires bun >= v1.2.9
3. **ES2024 Features**: Uses Promise.withResolvers() and other modern APIs
4. **Shadow DOM Focus**: Framework assumes Shadow DOM usage
