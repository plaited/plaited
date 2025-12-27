---
name: plaited-patterns
description: Comprehensive Plaited framework patterns for AI-assisted design of MCP/A2UI outcome-based interfaces. Covers templates, styling, behavioral programming, custom elements, forms, cross-island communication, testing, and web workers. Automatically invoked when designing or implementing Plaited templates and BehavioralElements.
---

# Plaited Patterns Skill

## Purpose

This skill provides comprehensive documentation for building Plaited applications using behavioral programming, web components, and islands architecture. Use this when:
- Designing or implementing Plaited templates and BehavioralElements (bElement or FunctionalTemplate)
- Creating interactive islands with behavioral programs
- Building form-associated custom elements
- Coordinating cross-island communication
- Writing stories for testing
- Styling components with CSS-in-JS
- Offloading computation to web workers

## Quick Reference

**TypeScript LSP**: This plugin works with `typescript-lsp@claude-plugins-official` for type inference from imports. Use LSP for accurate type signatures from source code.

**Main Rules**: See @.claude/rules/ for:
- Code style standards (@.claude/rules/development/code-style.md)
- Testing with Bun (@.claude/rules/development/testing.md)
- TSDoc documentation (@.claude/rules/documentation/)
- Platform-specific APIs (@.claude/rules/platform/bun-apis.md)

## Pattern Categories

### Templates & Styling
- **[styling.md](plaited/styling.md)** - Templates (JSX, FT, useTemplate, SSR) + CSS-in-JS (createStyles, createHostStyles, tokens, keyframes)
  - Use for: JSX syntax, template security, FunctionalTemplate pattern, atomic CSS, host styling, design tokens

### Testing
- **[stories.md](plaited/stories.md)** - Story-based testing with Playwright integration
  - Use for: Writing stories for templates and bElements, workshop CLI usage, accessibility testing, inspector debugging
  - Workshop commands: `bun plaited test`, `bun plaited dev`

### Behavioral Programming Foundations
- **[behavioral-programs.md](plaited/behavioral-programs.md)** - BP paradigm, super-step execution, thread composition
  - Use for: Understanding BP coordination, event selection, rule composition, predicates, thread lifecycle
  - Key capabilities: Event Selection Strategy, Rule Composition Patterns, Predicate-Based Matching, Thread Lifecycle

### Custom Elements
- **[b-element.md](plaited/b-element.md)** - Creating custom elements with bElement
  - Use for: Islands architecture, decorator pattern, stateful elements, form controls
  - When to use: Interactive islands, wrapping native elements, complex state, form integration

### Form Integration
- **[form-associated-elements.md](plaited/form-associated-elements.md)** - Capturing user intent through forms
  - Use for: Custom form controls, ElementInternals API, custom states (`:state()`), validation, type-driven form generation
  - Integration: Works with MCP schemas for outcome-based interfaces

### Cross-Island Communication
- **[cross-island-communication.md](plaited/cross-island-communication.md)** - Three communication patterns
  - Pattern A: `trigger()` - Parent-to-child (direct method call)
  - Pattern B: `emit()` - Child-to-parent (event bubbling)
  - Pattern C: `useSignal()` - Cross-island pub/sub (actor pattern)
  - Use for: Coordinating islands NOT in parent-child relationship

### Performance
- **[web-workers.md](plaited/web-workers.md)** - Offloading computation to background threads
  - Use for: CPU-intensive calculations, data processing, complex algorithms
  - APIs: `useWorker()` (main thread), `bWorker()` (worker thread)

## Decision Trees

### When to Use Which Pattern?

**Creating UI Elements:**
```
Is it simple and presentational?
├─ YES → Use FunctionalTemplate (FT) in *.stories.tsx
│         (See plaited/styling.md for patterns)
└─ NO  → Need interactivity?
          └─ YES → Use bElement (See plaited/b-element.md)
                   - Islands architecture
                   - Decorator pattern
                   - Stateful elements
                   - Form controls
```

**Communication Between Elements:**
```
Are they in PARENT-CHILD relationship?
├─ YES → Parent → Child?
│        └─ Use Pattern A: trigger() (See plaited/cross-island-communication.md)
├─ YES → Child → Parent?
│        └─ Use Pattern B: emit() (See plaited/cross-island-communication.md)
└─ NO  → Cross-island?
         └─ Use Pattern C: useSignal() (See plaited/cross-island-communication.md)
```

**Performance Optimization:**
```
Is computation CPU-intensive?
├─ YES → Use Web Workers (See plaited/web-workers.md)
│        - useWorker() in main thread
│        - bWorker() in worker thread
└─ NO  → Keep in main thread
```

## File Organization

### For Simple Elements (FunctionalTemplate):
```
component/
  button.css.ts          # Styles (createStyles)
  button.tokens.ts       # Design tokens (optional)
  button.stories.tsx     # FT defined + stories
```

### For Complex Elements (bElement):
```
component/
  toggle-input.css.ts         # Styles + hostStyles
  fills.tokens.ts             # Tokens (optional)
  toggle-input.ts             # bElement definition
  toggle-input.stories.tsx    # Import bElement + stories
```

### Naming Conventions:
- **bElement-specific styles**: Export as `styles` and `hostStyles` (filename provides context)
- **Reusable pattern styles**: Export with descriptive names (e.g., `buttonStyles`, `cardStyles`)
- **Token files**: Use `*.tokens.ts` extension

## Integration Points

### With TypeScript LSP:
- Use LSP for type inference from `plaited` package imports
- LSP provides accurate signatures, reducing need for type documentation in rules
- Hover for TSDoc, goToDefinition for source, findReferences for usage

### With Main Rules:
- **Code Style**: Follow @.claude/rules/development/code-style.md
- **Testing**: Use Bun test runner (@.claude/rules/development/testing.md) for unit tests; stories for browser tests
- **Documentation**: TSDoc standards from @.claude/rules/documentation/
- **Imports**: Package imports from @.claude/rules/development/imports.md
- **Platform**: Bun-specific APIs from @.claude/rules/platform/bun-apis.md

## Best Practices

### Templates Are Static:
```typescript
// ❌ Don't try to re-render different variants
<Button variant={newVariant} />  // Templates are static

// ✅ Use attribute-based styling + helper methods
const btn = $('btn')[0]
btn?.attr('data-variant', 'primary')  // Change via attributes
```

### Token Usage:
```typescript
// ❌ Don't invoke tokens as CSS values
backgroundColor: tokens.primary()  // WRONG

// ✅ Pass token references directly
backgroundColor: tokens.primary    // CORRECT
```

### Communication Hierarchy:
```typescript
// ✅ Parent-child: Use trigger/emit
parent.trigger({ type: 'event' })
child.emit({ type: 'event', bubbles: true, composed: true })

// ✅ Cross-island: Use useSignal
const signal = useSignal<Data>()
signal.set(data)           // Write
signal.listen('evt', trigger)  // Subscribe
```

## Examples

Complete working examples demonstrating Plaited patterns:

### Decorator Pattern
- **[DecoratedCheckbox](examples/decorator-pattern/)** - Wraps native checkbox with custom styling
  - Shows decorator pattern for hard-to-style native elements
  - Uses `useAttributesObserver` to sync slotted element state with custom states
  - Demonstrates `createTokens` for state-based styling
  - Follows styling.md patterns: separate tokens, styles, and element files
  - Files:
    - `fills.tokens.ts` - Design tokens for checkbox states
    - `decorated-checkbox.css.ts` - Styles and hostStyles
    - `decorated-checkbox.ts` - bElement definition
    - `decorated-checkbox.stories.tsx` - Story tests

### Slot Styling
- **[InputAddon](examples/slot-styling/)** - Input decorator with prefix/suffix slots
  - Demonstrates `::slotted()` CSS for styling light DOM elements
  - Shows attribute observation on slotted elements
  - Custom state management with `internals.states`
  - Follows styling.md patterns: separate tokens, styles, and element files
  - Files:
    - `input-addon.tokens.ts` - Design tokens for stroke colors
    - `input-addon.css.ts` - Styles and hostStyles with ::slotted()
    - `input-addon.ts` - bElement definition
    - `input-addon.stories.tsx` - Story tests

### Stateful Elements
- **[Popover](examples/stateful-elements/)** - Native popover API wrapper
  - Stateful element pattern with custom states
  - Syncs custom states with native popover visibility
  - Shows child-to-parent communication via `emit()`
  - Files:
    - `popover.ts` - bElement definition
    - `popover.stories.tsx` - Story tests

### BP Coordination
- **[Tic-Tac-Toe](examples/bp-coordination/)** - Interactive game with BP
  - Complex behavioral program coordination
  - Multiple b-threads working together (turn enforcement, square occupancy, win detection, AI strategy)
  - Demonstrates rule composition and event selection
  - Shows how complex behavior emerges from simple thread interactions
  - Files: `tic-tac-toe-board.tsx`, `board-marker.tsx`, `x-marker.tsx`, `o-marker.tsx`, `tic-tac-toe-board.stories.tsx`

## Related Skills

- **code-documentation** - For writing TSDoc comments and API documentation
- **document-plaited-pattern** - For extracting new patterns from codebase (internal use)
- **extract-web-pattern** - For extracting Web API patterns from articles (internal use)

## Navigation Summary

- [styling.md](plaited/styling.md) - Templates + CSS-in-JS system
- [stories.md](plaited/stories.md) - Testing patterns with workshop CLI
- [behavioral-programs.md](plaited/behavioral-programs.md) - BP foundations (4 key capabilities)
- [b-element.md](plaited/b-element.md) - Custom elements API
- [form-associated-elements.md](plaited/form-associated-elements.md) - Form integration
- [cross-island-communication.md](plaited/cross-island-communication.md) - 3 communication patterns
- [web-workers.md](plaited/web-workers.md) - Performance optimization
