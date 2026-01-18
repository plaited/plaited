# Plaited-Specific Rules

Rules specific to the Plaited framework that extend the base development-skills rules.

> **Note:** The `.claude-plugins/` directory and `hooks.json` have been removed from this repository. Plugin development guidance is now managed in the [plaited/development-skills](https://github.com/plaited/development-skills) repository.

## Terminology

### Use "Template" Not "Component"

Plaited is a template-driven framework. Always use "template", "templates", "elements", "behavioral element", or "behavioral elements" instead of "component" or "components" in all documents, examples, comments, and code.

```typescript
// ✅ Good: Template terminology
const ButtonTemplate = () => <button>Click me</button>
// src/templates/button.tsx

// ❌ Avoid: Component terminology
const ButtonComponent = () => <button>Click me</button>
// src/components/button.tsx
```

**Rationale:** Plaited's architecture is fundamentally template-driven, not component-driven. Consistent terminology reinforces the framework's design philosophy.

## Verification with Plaited Skills

When verifying implementation details in Plaited projects:

1. **Plaited Skills First**: Check what the Plaited framework provides before consulting external sources:
   - `plaited-behavioral-core` - BP patterns, behavioral programs
   - `plaited-ui-patterns` - Templates, bElements, styling
   - `plaited-standards` - Code conventions

2. **TypeScript LSP**: Use `typescript-lsp` skill for type verification:
   - `lsp-hover` to verify type signatures
   - `lsp-references` to find all usages before modifying
   - `lsp-symbols` for file structure
   - `lsp-find` to search for patterns across the workspace

## Template/Browser Tests (`*.stories.tsx`)

Plaited uses a custom workshop CLI for browser-based template tests:

- Browser-based tests using Playwright integration
- Use `*.stories.tsx` extension
- Run with the workshop CLI at `src/workshop/cli.ts`
- Test visual templates, user interactions, and accessibility
- Powered by `story` helper from `plaited/testing`

### Running Story Tests

```bash
# Run story tests for specific path(s)
bun run test:stories src/main

# Run story tests for entire project
bun run test:stories

# Start dev server with hot reload for manual testing
bun run dev

# Run story tests with custom port
bun run test:stories -p 3500
```

### Test File Naming

- **`*.spec.ts` or `*.spec.tsx`**: Unit/integration tests run with Bun
- **`*.stories.tsx`**: Template/browser tests run with workshop CLI

## Plugin Skills Validation

When changes touch `.claude/skills/`, validate against the AgentSkills spec:

```
/validate-skill
```

This checks:
- SKILL.md exists and has required frontmatter
- Scripts have proper structure
- References are valid markdown files

## Code Examples with Plaited Types

When documenting object parameter patterns, use Plaited-specific types:

```typescript
// ✅ Good: Object parameter pattern with Plaited types
const toStoryMetadata = ({
  exportName,
  filePath,
  storyExport,
}: {
  exportName: string
  filePath: string
  storyExport: StoryExport
}): StoryMetadata => { /* ... */ }
```

## Documentation Standards

### Stories as Living Examples

Tests and stories serve as living examples. Do not add `@example` sections to TSDoc comments - reference the corresponding `*.stories.tsx` files instead.
