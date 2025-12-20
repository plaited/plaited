# Documentation Philosophy

## Core Principles

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

## Documentation Requirements

For detailed TSDoc templates and type documentation guidelines, see:
- @.claude/skills/code-documentation/SKILL.md
- @.claude/rules/documentation/tsdoc-overview.md
