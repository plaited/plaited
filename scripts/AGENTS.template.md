# Plaited AI Plugin

AI-assisted development for Plaited templates. This plugin provides comprehensive knowledge of behavioral programming patterns, template creation, and framework conventions.

## Terminology

**Important**: Plaited is a **template-based** framework. Use "template" not "component". Refer to browser APIs by specific names (Custom Elements, Shadow DOM) not "Web Components".

## Available Skills

### plaited-framework-patterns
Comprehensive Plaited patterns for templates and behavioral elements:
- Templates & Styling (JSX, CSS-in-JS, design tokens)
- Behavioral Programming (threads, events, coordination)
- Custom Elements (bElement, Shadow DOM, form controls)
- Cross-Island Communication (trigger, emit, signals)
- Testing (story-based tests with Playwright)

### typescript-lsp
TypeScript Language Server for type verification:
- Hover for type signatures
- Find symbol references
- Navigate to definitions

### code-documentation
TSDoc templates and documentation workflow:
- Public API documentation
- Internal module docs
- Type documentation

### code-query
Story and template discovery:
- Find stories by pattern
- Generate preview URLs
- Discover behavioral elements

### plaited-web-patterns
Default Web API patterns for bElement:
- Modern HTML features (dialog, popover)
- Performance optimizations
- Shadow DOM compatible patterns

## Workshop CLI Commands

```bash
# Run all story tests
bun plaited test

# Run tests for specific path
bun plaited test src/components

# Start dev server
bun plaited dev

# Dev server with hot reload
bun --hot plaited dev
```

## Code Conventions

- Use `type` over `interface`
- Prefer arrow functions
- JSX syntax only (not `h()` or `createTemplate()`)
- Package imports in tests: `import { bElement } from 'plaited'`
- Object parameters for functions with 2+ parameters

## File Organization

```
element/
  button.css.ts          # Styles (createStyles)
  button.tokens.ts       # Design tokens (optional)
  button.stories.tsx     # Template + stories
```

For interactive elements (bElement):
```
element/
  toggle-input.css.ts    # Styles + hostStyles
  toggle-input.ts        # bElement definition
  toggle-input.stories.tsx
```

## Learn More

See the skills directory for detailed pattern documentation:
- `skills/plaited-framework-patterns/references/` - Framework patterns
- `skills/code-documentation/references/` - TSDoc templates
