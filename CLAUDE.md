# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development Setup
```bash
# Install dependencies (requires bun >= v1.2.9)
bun install

# Run all tests
bun test

# Run story tests (visual component tests)
bun scripts/test-stories.ts

# Run hot-reload story tests during development
bun --hot scripts/test-stories.ts

# Type checking
bun run check

# Type checking with watch mode
bun run check:watch

# Linting
bun run lint

# Lint and fix
bun run lint-fix

# Format code
bun run prettier
```

### Testing Single Files
```bash
# Run a specific test file
bun test path/to/file.spec.ts

# Run tests matching a pattern
bun test --preload ./test/setup.ts pattern
```

## Architecture Overview

### Core Concepts

Plaited is a behavioral programming framework for building reactive web components with these key architectural pillars:

1. **Behavioral Programming (BP) Paradigm**
   - Located in `src/behavioral/`
   - Central coordination through `bProgram` which manages b-threads
   - Event-driven architecture with request/waitFor/block idioms
   - Signals for reactive state management

2. **Web Components with Shadow DOM**
   - `bElement` in `src/main/define-element.ts` creates custom elements
   - Automatic style scoping via Constructable Stylesheets
   - Template system with JSX support
   - Helper methods attached to DOM elements via `p-target` attributes

3. **CSS-in-JS System**
   - `css` namespace in `src/main/css.ts` for atomic CSS generation
   - Automatic style adoption in Shadow DOM
   - Style deduplication and caching per ShadowRoot

### Key Architectural Patterns

#### Event Flow Architecture
```
External Trigger → bProgram → Event Selection → Thread Notification → Feedback Handlers
                     ↑                              ↓
                  b-threads ←─────────────────── State Updates
```

#### Component Lifecycle
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

- **`src/main/`**: Core framework (bElement, css, ssr, templates)
- **`src/behavioral/`**: BP implementation (bProgram, bThread, signals)
- **`src/utils/`**: Utility functions (well-documented, pure functions)
- **`src/workshop/`**: Development tools (story runner, design tokens)
- **`src/ai/`**: AI integration modules (MCP server support)
  - **`tests/`**: Test files for AI/MCP modules

### Critical Implementation Details

1. **DOM Updates**: Helper methods (`render`, `insert`, `attr`) are attached once per element via `Object.assign` for performance

2. **Style Management**: Uses WeakMap caching to prevent duplicate style adoption per ShadowRoot

3. **Event Scheduling**: Priority-based event selection with blocking capabilities

4. **Memory Management**: Automatic cleanup via PlaitedTrigger and WeakMap for styles

## Code Style Preferences

- Prefer arrow functions over function declarations
- Avoid using `any` type - use proper TypeScript types
- Use `test` instead of `it` in test files
- Prefer `Bun.resolveSync()` over path.join() for resolving file paths in Bun environments
- **Prefer `type` over `interface`**: Use type aliases instead of interfaces for better consistency and flexibility
- **No `any` types**: Always use proper types; use `unknown` if type is truly unknown and add type guards
- **PascalCase for types and schemas**: All type names and Zod schema names should use PascalCase (e.g., `UserConfigSchema`, `ApiResponseType`)
- Use union types and intersection types effectively
- Leverage TypeScript's type inference where appropriate

## TSDoc Comment Standards

### Documentation Style Summary
- **Concise first line**: One-line summary without redundant phrases
- **Named examples**: Each `@example` should have a descriptive title
- **Factory functions only**: Never show raw `yield` statements in behavioral examples
- **Type over interface**: Always prefer `type` declarations
- **Cross-references**: Use `@see` tags to connect related APIs
- **Version tracking**: Include `@since` tags for public APIs

### Documentation Philosophy
- Public APIs require comprehensive documentation with examples
- Internal modules need maintainer-focused documentation
- All documentation should be practical and actionable
- Avoid redundant or obvious comments
- Use `@internal` marker for non-public APIs
- Document the "why" not just the "what"

### Public API Documentation Pattern

```typescript
/**
 * Brief one-line description of what this does.
 * Extended description providing context and use cases.
 * 
 * @param paramName Description of parameter purpose and constraints
 * @returns Description of return value and what it represents
 * 
 * @example Basic Usage
 * ```ts
 * const result = functionName(args);
 * ```
 * 
 * @example Advanced Usage  
 * ```ts
 * // More complex example with context
 * const config = { ... };
 * const result = functionName(config);
 * ```
 * 
 * @remarks
 * - Important implementation details
 * - Performance considerations
 * - Common pitfalls or gotchas
 * 
 * @see {@link RelatedFunction} for related functionality
 * @since 1.0.0
 */
```

### Internal Module Documentation Pattern

```typescript
/**
 * @internal
 * @module module-name
 * 
 * Purpose: Why this module exists in the codebase
 * Architecture: How it fits into the overall system design
 * Dependencies: What this module depends on
 * Consumers: What parts of the system use this module
 * 
 * Maintainer Notes:
 * - Key implementation details and design decisions
 * - Important invariants that must be maintained
 * - Tricky aspects of the implementation
 * - Performance-critical sections
 * 
 * Common modification scenarios:
 * - When you might need to modify this module
 * - How to extend functionality safely
 * - What to watch out for when making changes
 * 
 * Performance considerations:
 * - Optimization strategies used
 * - Memory management concerns
 * - Computational complexity notes
 * 
 * Known limitations:
 * - Current constraints or technical debt
 * - Planned improvements
 * - Workarounds for known issues
 */
```

### Type Documentation Guidelines

**IMPORTANT**: This project prefers `type` over `interface` in both code and TSDoc comments. Always use `type` declarations unless there's a specific need for interface features like declaration merging.

#### Public Types

```typescript
/**
 * Description of what this type represents in the API.
 * 
 * @property propName - What this property controls or represents
 * 
 * @example
 * ```ts
 * const config: TypeName = {
 *   propName: 'value'
 * };
 * ```
 */
export type TypeName = {
  propName: string;
}
```

#### Internal Types

```typescript
/**
 * @internal
 * What this type represents internally and why it exists.
 * How it's used in the implementation.
 */
type InternalType = {
  // Implementation-specific properties
}
```

### Behavioral Programming Documentation

- Document event flow and synchronization
- Explain thread lifecycle and state management
- Include sequence diagrams for complex interactions
- **IMPORTANT**: Always use factory functions (`bSync`, `bThread`) in examples, never raw `yield` statements
- Show practical usage patterns with the behavioral API
- Use descriptive example titles that explain the scenario

#### Behavioral Documentation Template

```typescript
/**
 * Creates a behavioral thread for handling user interactions.
 * Coordinates multiple async operations with proper synchronization.
 * 
 * @param config Thread configuration options
 * @returns Configured behavioral thread
 * 
 * @example Simple request-response pattern
 * ```ts
 * const simpleFlow = bThread([
 *   bSync({ request: { type: 'FETCH_DATA' } }),
 *   bSync({ waitFor: ['SUCCESS', 'ERROR'] })
 * ]);
 * ```
 * 
 * @example Complex coordination with blocking
 * ```ts
 * const coordinatedFlow = bThread([
 *   bSync({ 
 *     waitFor: 'USER_ACTION',
 *     block: 'SYSTEM_BUSY',
 *     request: { type: 'PROCESS' }
 *   }),
 *   bSync({ waitFor: 'COMPLETE' })
 * ], true); // Repeat indefinitely
 * ```
 * 
 * @remarks
 * - Threads execute sequentially through sync points
 * - Blocking has precedence over requests
 * - Use repetition for continuous behaviors
 * 
 * @see {@link bSync} for creating sync points
 * @see {@link behavioral} for program setup
 */
```

### Special Annotations

#### Security-Sensitive Code

```typescript
/**
 * @internal
 * SECURITY: This function handles user input validation.
 * 
 * Security considerations:
 * - Input sanitization approach
 * - XSS prevention measures
 * - Authentication/authorization checks
 */
```

#### Performance-Critical Code

```typescript
/**
 * @internal
 * PERFORMANCE: Hot path - called frequently during render.
 * 
 * Performance notes:
 * - Optimized for minimal allocations
 * - Caches results in WeakMap
 * - O(1) lookup after initial computation
 */
```

#### Deprecated Code

```typescript
/**
 * @deprecated Use `newFunction` instead. Will be removed in v8.0.
 * @see {@link newFunction}
 */
```

## Important Constraints

1. **No Open Contribution**: This is open-source but not open-contribution
2. **Bun Required**: Development requires bun >= v1.2.9
3. **ES2024 Features**: Uses Promise.withResolvers() and other modern APIs
4. **Shadow DOM Focus**: Framework assumes Shadow DOM usage

## Common Development Patterns

### Creating a Component
```tsx
export const MyComponent = bElement({
  tag: 'my-component',
  shadowDom: <div p-target="content" />,
  bProgram({ $, trigger }) {
    const [content] = $('content');
    return {
      UPDATE_CONTENT(text: string) {
        content.render(text);
      }
    };
  }
});
```

### Using Signals
```ts
const state = useSignal(initialValue);
state.listen('STATE_CHANGED', trigger);
state.set(newValue);
```

### Testing Components
Create a `*.stories.tsx` file and use `storyFixture` for component testing with Playwright integration.