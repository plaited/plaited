# Pattern Library Generation

This document describes how to extract, document, and maintain patterns for the `plaited-framework-patterns` skill in the workshop plugin.

## Overview

The `plaited-framework-patterns` skill (`plugins/workshop/skills/plaited-framework-patterns/`) is a comprehensive knowledge base of Plaited framework patterns. It enables AI-assisted development by providing:

1. **Pattern documentation** - Detailed guides in `plaited/` subdirectory
2. **Working examples** - Complete code examples in `examples/` subdirectory
3. **Decision trees** - When to use which patterns
4. **Integration points** - How patterns work together

## Pattern Library Structure

```
plugins/workshop/skills/plaited-framework-patterns/
├── SKILL.md                          # Main skill file (auto-invoked)
├── plaited/                          # Pattern documentation
│   ├── behavioral-programs.md       # BP paradigm foundations
│   ├── b-element.md                 # Custom elements API
│   ├── code-conventions.md          # Code style standards
│   ├── cross-island-communication.md # Communication patterns
│   ├── form-associated-elements.md  # Form integration
│   ├── lsp-verification.md          # LSP-based verification
│   ├── standards.md                 # Development standards
│   ├── stories.md                   # Testing patterns
│   ├── styling.md                   # Templates + CSS-in-JS
│   ├── verification-workflow.md     # Code generation workflow
│   ├── web-api-adaptation.md        # Framework-first adaptation
│   └── web-workers.md               # Performance optimization
└── examples/                         # Working code examples
    ├── bp-coordination/              # Tic-tac-toe game
    ├── decorator-pattern/            # DecoratedCheckbox
    ├── form-associated/              # ToggleInput
    ├── slot-styling/                 # InputAddon
    └── stateful-elements/            # Popover
```

## When to Add New Patterns

Add new pattern documentation when:

1. **New framework capability** - Core Plaited functionality is added (e.g., new BP idiom, new bElement feature)
2. **Common usage pattern** - A pattern emerges from multiple implementations (e.g., decorator pattern, slot styling)
3. **Integration pattern** - How Plaited integrates with web platform APIs (e.g., ElementInternals, Popover API)
4. **Architectural pattern** - High-level design patterns for islands (e.g., cross-island communication)
5. **Verification pattern** - Code quality and accuracy workflows (e.g., LSP verification, framework-first adaptation)

**Do NOT add:**
- Application-specific logic
- Project-specific conventions
- External library integrations (unless core to Plaited)
- Temporary workarounds

## Pattern Documentation Format

### Pattern File Template

```markdown
# Pattern Name

Brief description (1-2 sentences).

## Core Concept

Explain the fundamental idea and why it exists.

## When to Use

Clear criteria for when this pattern applies:
- Scenario 1
- Scenario 2
- Scenario 3

## When NOT to Use

Anti-patterns and alternative approaches.

## API Reference

Core APIs with TypeScript signatures and descriptions.

## Usage Patterns

### Pattern 1: Descriptive Name

```typescript
// Working code example
```

**Explanation:** What this does and why.

### Pattern 2: Descriptive Name

```typescript
// Another working example
```

**Explanation:** What this does and why.

## Common Pitfalls

Common mistakes and how to avoid them.

## Integration Points

How this pattern works with other Plaited patterns.

## Related Patterns

- Link to related pattern files
```

### Example Documentation

See existing patterns for reference:
- **behavioral-programs.md** - Comprehensive pattern with theory + practice
- **b-element.md** - API reference + usage patterns + examples
- **cross-island-communication.md** - Multiple patterns (A, B, C) with decision tree

## Working Examples Format

### Example Directory Structure

```
examples/pattern-name/
├── surfaces.tokens.ts              # Design tokens (if needed)
├── element-name.css.ts             # Styles + hostStyles
├── element-name.tsx                # bElement definition
└── element-name.stories.tsx        # Story tests
```

### Example Requirements

1. **Complete and runnable** - Must work with `bun plaited dev`
2. **Well-documented** - TSDoc comments explaining pattern usage
3. **Self-contained** - Minimal external dependencies
4. **Representative** - Shows real-world usage, not contrived demos
5. **Tested** - Includes at least one story with play function

### Example Template

```typescript
/**
 * Pattern Name Example
 *
 * Demonstrates [pattern concept] using [Plaited features].
 *
 * Key pattern elements:
 * - Feature 1: Description
 * - Feature 2: Description
 * - Feature 3: Description
 *
 * @see {@link ../plaited/pattern-file.md} for full pattern documentation
 */

import { bElement, createStyles, createHostStyles } from 'plaited'

// Implementation with inline comments explaining pattern usage
export const ExampleElement = bElement({
  tag: 'example-element',
  // ... implementation
})
```

## Updating SKILL.md

When adding new patterns, update the main SKILL.md file:

### 1. Add to Pattern Categories

```markdown
### New Category (if needed)
- **[pattern-name.md](plaited/pattern-name.md)** - Brief description
  - Use for: Scenario 1, Scenario 2, Scenario 3
  - Key capabilities: Feature 1, Feature 2, Feature 3
```

### 2. Update Decision Trees

```markdown
**Decision Tree Title:**
```
Is there a specific condition?
├─ YES → Use Pattern Name (See plaited/pattern-name.md)
│         - When to use details
└─ NO  → Alternative approach
```
```

### 3. Add Example Reference

```markdown
### Pattern Category
- **[ExampleName](examples/pattern-name/)** - Brief description
  - Shows pattern application in real-world scenario
  - Demonstrates key features: feature 1, feature 2, feature 3
  - Files: List key files and their purpose
```

### 4. Update Navigation Summary

```markdown
### Core Patterns (or appropriate section)
- [pattern-name.md](plaited/pattern-name.md) - Brief description
```

## Extraction Workflow

### Using document-plaited-pattern Skill

The `document-plaited-pattern` skill (from project settings) assists with extracting patterns:

1. **Identify pattern** - Find recurring pattern in codebase
2. **Invoke skill** - Claude will guide extraction process
3. **Review output** - Verify documentation accuracy
4. **Add examples** - Create working code examples
5. **Update SKILL.md** - Add to main skill file

### Using extract-web-pattern Skill

The `extract-web-pattern` skill (from project settings) assists with extracting Web API patterns:

1. **Find web API usage** - Identify Plaited integration with web APIs
2. **Extract pattern** - Document how Plaited adapts the API
3. **Create example** - Working code showing integration
4. **Document framework-first** - Show bElement features before web APIs

### Manual Extraction

For patterns not suited to skills:

1. **Analyze codebase** - Find recurring patterns using code-query skill
2. **Document pattern** - Write pattern file following template
3. **Create examples** - Extract or create working examples
4. **Test examples** - Ensure examples run with workshop CLI
5. **Update SKILL.md** - Add pattern to main skill
6. **Verify accuracy** - Use LSP and framework verification

## Pattern Quality Standards

### Documentation Quality

- **95% confidence threshold** - Only document verified patterns
- **Framework-first** - Check bElement features before web APIs
- **LSP-verified** - Use LSP to verify type signatures
- **Working examples** - All code examples must execute
- **Clear scope** - Each pattern addresses specific use case

### Code Example Quality

- **Follows code-conventions.md** - Consistent with Plaited style
- **Type-safe** - Uses TypeScript properly
- **Self-explanatory** - Code demonstrates pattern clearly
- **Minimal** - No unnecessary complexity
- **Tested** - Includes story with assertions

### SKILL.md Maintenance

- **Consistent structure** - Follow existing organization
- **Cross-references** - Link related patterns
- **Decision trees** - Help users choose patterns
- **Quick reference** - Essential info accessible quickly

## Pattern Categories

### Core Framework Patterns

Fundamental Plaited capabilities:
- Templates and styling (FT, JSX, CSS-in-JS)
- Behavioral programs (BP paradigm, threads, events)
- Custom elements (bElement, lifecycle, Shadow DOM)
- Form integration (ElementInternals, custom states)

### Integration Patterns

How Plaited works with web platform:
- Cross-island communication (trigger, emit, signals)
- Web workers (useWorker, bWorker)
- Form-associated elements (ElementInternals API)
- Native element decoration (Popover, Dialog, etc.)

### Quality & Verification Patterns

Ensuring code accuracy:
- LSP verification (type checking before generation)
- Framework-first adaptation (check bElement first)
- Verification workflow (systematic code generation)
- Testing patterns (stories, play functions, accessibility)

### Development Patterns

Best practices and conventions:
- Code conventions (type system, function style)
- Standards (95% confidence, Bun APIs, documentation)
- File organization (FT vs bElement structure)
- Naming conventions (exports, tokens, styles)

## Versioning and Updates

### When to Update Patterns

Update pattern documentation when:
- Framework API changes (breaking or non-breaking)
- New framework features added
- Pattern improvements discovered
- Errors or inaccuracies found
- Examples become outdated

### Deprecation Process

When deprecating patterns:
1. Mark pattern as deprecated in pattern file
2. Document replacement pattern
3. Update SKILL.md to remove from main sections
4. Move to "Deprecated Patterns" section
5. Keep documentation for historical reference

### Version Compatibility

Pattern documentation should:
- Specify minimum Plaited version if using new features
- Document breaking changes from previous patterns
- Provide migration guides when patterns change significantly

## Testing Pattern Documentation

### Verification Checklist

Before publishing pattern documentation:

- [ ] All code examples execute successfully
- [ ] Examples tested with `bun plaited dev` and `bun plaited test`
- [ ] LSP verification confirms type signatures
- [ ] Framework-first verification completed
- [ ] Cross-references to related patterns work
- [ ] Decision trees guide to correct patterns
- [ ] SKILL.md updated with new pattern
- [ ] Examples follow code-conventions.md
- [ ] TSDoc comments explain pattern usage
- [ ] 95% confidence in pattern accuracy

### Integration Testing

Test pattern integration:
- Pattern works with other documented patterns
- Decision trees lead to correct pattern choice
- Examples demonstrate realistic usage
- Integration points documented clearly

## Contributing Patterns

### Internal Contributors

1. Use `document-plaited-pattern` or `extract-web-pattern` skills
2. Follow pattern documentation format
3. Create working examples
4. Update SKILL.md
5. Clear plugin cache: `rm -rf ~/.claude/plugins-cache`
6. Restart Claude Code to test

### External Submission

This is an **open-source but not open-contribution** project. Pattern submissions are not accepted from external contributors. See CLAUDE.md for project constraints.

## Related Documentation

- **SKILL.md** - Main skill file with all patterns
- **PLANNING.md** - Workshop plugin planning and architecture
- **README.md** - Workshop plugin overview
- **.claude/rules/documentation/** - TSDoc standards for code
- **.claude/skills/code-documentation/** - TSDoc templates
