# Claude Instructions for Plaited TSDoc Documentation

## Overview
This document provides guidelines for writing and maintaining TypeScript documentation in the Plaited codebase. Follow these patterns to ensure consistency and clarity across all modules.

### Documentation Style Summary
- **Concise first line**: One-line summary without redundant phrases
- **Named examples**: Each `@example` should have a descriptive title
- **Factory functions only**: Never show raw `yield` statements in behavioral examples
- **Type over interface**: Always prefer `type` declarations
- **Cross-references**: Use `@see` tags to connect related APIs
- **Version tracking**: Include `@since` tags for public APIs

## Documentation Philosophy
- Public APIs require comprehensive documentation with examples
- Internal modules need maintainer-focused documentation
- All documentation should be practical and actionable
- Avoid redundant or obvious comments

## Public API Documentation Pattern

For publicly exported functions, types, and classes:

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

## Internal Module Documentation Pattern

For internal modules and utilities, use this maintainer-focused pattern:

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

## Internal Function Documentation

For internal helper functions:

```typescript
/**
 * @internal
 * Brief description of the function's purpose.
 * 
 * Detailed explanation of how it works and why it's needed.
 * Focus on implementation details that future maintainers need to know.
 * 
 * @param paramName - Internal parameter details and constraints
 * @returns What the function produces and how it's used internally
 * 
 * Implementation details:
 * - Algorithm or approach used
 * - Why this approach was chosen
 * - Edge cases handled
 * 
 * Integration notes:
 * - How this integrates with other internal systems
 * - Side effects or state mutations
 * - Error handling strategy
 */
```

## Enhanced Documentation Pattern for Complex APIs

For complex types and functions (like those in the behavioral module), use this comprehensive pattern:

```typescript
/**
 * Concise one-line summary of functionality.
 * More detailed explanation if needed.
 * 
 * @template T Description of generic type parameter
 * @param args Parameter with clear description
 * @returns What is returned and how it's used
 * 
 * @example Named example with context
 * ```ts
 * // Descriptive comment about what this example shows
 * const example = functionName({
 *   param: 'value'
 * });
 * ```
 * 
 * @example Another practical scenario
 * ```ts
 * // Show different use case or pattern
 * const advanced = functionName({
 *   complexParam: { nested: 'value' }
 * });
 * ```
 * 
 * @remarks
 * Key points about implementation:
 * - Important behavioral notes
 * - Performance characteristics
 * - Common patterns or anti-patterns
 * 
 * @see {@link RelatedType} for related concepts
 * @see {@link OtherFunction} for complementary functionality
 * @since 1.0.0
 */
```

### Key Principles for Enhanced Documentation

1. **Multiple Named Examples**: Each example should have a descriptive title
2. **Progressive Complexity**: Start with simple examples, build to advanced
3. **Cross-References**: Use `@see` tags to connect related APIs
4. **Version Tracking**: Include `@since` tags for API stability
5. **Template Documentation**: Document generic type parameters clearly
6. **Practical Focus**: Examples should reflect real-world usage

## Type Documentation Guidelines

**IMPORTANT**: This project prefers `type` over `interface` in both code and TSDoc comments. Always use `type` declarations unless there's a specific need for interface features like declaration merging.

### Public Types

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

### Internal Types

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

### Type vs Interface

Always use `type` declarations:

```typescript
// Preferred: Use type
type UserData = {
  id: string;
  name: string;
}

// Avoid: Don't use interface unless needed
interface UserData {
  id: string;
  name: string;
}
```

## Best Practices

### 1. Use Consistent Terminology

- `Purpose`: Why something exists
- `Architecture`: How it fits in the system
- `Implementation details`: How it works internally
- `Maintainer Notes`: Critical information for developers

### 2. Focus on the "Why"

- Don't just describe what code does (that's what the code is for)
- Explain why it does it that way
- Document design decisions and trade-offs

### 3. Examples Should Be Realistic

- Use practical, real-world examples
- Show both basic and advanced usage
- Include context and setup when needed

### 4. Document Edge Cases

- Null/undefined handling
- Error conditions
- Performance implications
- Security considerations

### 5. Keep Documentation Current

- Update docs when implementation changes
- Remove outdated information
- Add notes about breaking changes

## Special Annotations

### Security-Sensitive Code

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

### Performance-Critical Code

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

### Deprecated Code

```typescript
/**
 * @deprecated Use `newFunction` instead. Will be removed in v8.0.
 * @see {@link newFunction}
 */
```

## Module-Specific Patterns

### Behavioral Programming Modules

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

#### Correct Behavioral Examples

```typescript
// CORRECT: Using factory functions
const myThread = bThread([
  bSync({ request: { type: 'START' } }),
  bSync({ waitFor: 'READY' }),
  bSync({ request: { type: 'PROCESS' } })
]);

// WRONG: Using raw yield statements
function* myThread() {
  yield { request: { type: 'START' } };
  yield { waitFor: 'READY' };
  yield { request: { type: 'PROCESS' } };
}
```

#### Common Behavioral Patterns to Document

1. **Event Flow**: Show how events propagate through threads
2. **Synchronization**: Demonstrate coordination between threads
3. **Blocking Patterns**: Explain mutual exclusion scenarios
4. **Interruption**: Document cancellation and cleanup
5. **Repetition**: Show continuous and conditional loops

### DOM Manipulation Modules

- Document DOM update strategies
- Explain performance optimizations
- Note browser compatibility concerns

### CSS/Styling Modules

- Document style adoption mechanisms
- Explain scoping strategies
- Note performance implications

### Testing Infrastructure

- Document test setup and teardown
- Explain mocking strategies
- Note flaky test mitigation

## Common Anti-Patterns to Avoid

1. **Redundant Comments**

   ```typescript
   // Bad: States the obvious
   /** Gets the name */
   getName(): string { return this.name; }
   
   // Good: Explains context
   /** 
    * Returns the display name, falling back to username if not set.
    * Used for UI presentation throughout the app.
    */
   getName(): string { return this.displayName || this.username; }
   ```

2. **Missing Context**

   ```typescript
   // Bad: No context
   /** Processes data */
   
   // Good: Provides context
   /** 
    * Transforms raw API responses into normalized entities.
    * Handles nested relationships and circular references.
    */
   ```

3. **Outdated Examples**

   - Always test examples in documentation
   - Update when APIs change
   - Remove examples for deprecated features

## Review Checklist

When reviewing documentation:

- [ ] Is the purpose clear?
- [ ] Are examples realistic and tested?
- [ ] Is implementation detail appropriate for the audience?
- [ ] Are edge cases documented?
- [ ] Is the documentation maintainable?
- [ ] Are security/performance concerns noted?
- [ ] Is the formatting consistent?
- [ ] Are all parameters and return values documented?

## Plaited-Specific Conventions

1. **Event Documentation**: Always document event types and payloads
2. **Component Lifecycle**: Document initialization and cleanup
3. **Signal/Trigger Patterns**: Explain data flow and dependencies
4. **Shadow DOM**: Note style scoping and boundary crossing
5. **Worker Communication**: Document message protocols

## Build Commands

Use the following commands for the Plaited project:

- **Type checking**: `bun run check` (not `npm run typecheck`)
- **Linting**: `bun run lint`
- **Testing**: `bun test`
- **Building**: `bun run build`
