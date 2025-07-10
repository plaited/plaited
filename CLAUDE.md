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
- **`src/mcp/`**: Model Context Protocol server support

### Critical Implementation Details

1. **DOM Updates**: Helper methods (`render`, `insert`, `attr`) are attached once per element via `Object.assign` for performance

2. **Style Management**: Uses WeakMap caching to prevent duplicate style adoption per ShadowRoot

3. **Event Scheduling**: Priority-based event selection with blocking capabilities

4. **Memory Management**: Automatic cleanup via PlaitedTrigger and WeakMap for styles

## TSDoc Comment Standards

When documenting code, follow the patterns in `.claude/instructions.md`:

- Public APIs need comprehensive examples
- Internal modules need maintainer-focused documentation
- Use `@internal` marker for non-public APIs
- Document the "why" not just the "what"

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
