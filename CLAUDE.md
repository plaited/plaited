# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development Setup
```bash
# Install dependencies (requires bun >= v1.2.9)
bun install

# Install playwright browser
bunx playwright install chromium

# Type, lint, and format check (check only, no fixes)
bun run check

# Lint and format fix (auto-fix issues)
bun run check:write
```

## Project Organization

This project uses `.claude/rules/` for project-specific guidance:

- **Testing**: @.claude/rules/testing.md - Test commands and workflow
- **Code Review**: @.claude/rules/code-review.md - Review standards
- **Accuracy**: @.claude/rules/accuracy.md - Confidence thresholds

For Plaited patterns, see these skills in `.claude/skills/`:
- **plaited-standards** - Code conventions, development standards, verification workflow
- **plaited-behavioral-core** - Behavioral programming patterns, neuro-symbolic reasoning
- **plaited-ui-patterns** - Templates, bElements, styling, forms, stories

For TSDoc workflow and templates, see the **code-documentation** skill.

## Quick Reference

### Testing Overview

Plaited uses Bun's test runner for unit/integration tests (`*.spec.{ts,tsx}`) and a custom workshop CLI for browser-based template tests (`*.stories.tsx`).

See @.claude/rules/testing.md for complete testing guide.

### Architecture Highlights

Plaited is a behavioral programming framework for reactive custom elements. Key pillars:
1. Behavioral Programming (BP) Paradigm
2. Custom Elements with Shadow DOM
3. CSS-in-JS System

For architectural patterns and implementation details:
- **plaited-behavioral-core** - `.claude/skills/plaited-behavioral-core/references/behavioral-programs.md`
- **plaited-ui-patterns** - `.claude/skills/plaited-ui-patterns/references/b-element.md`, `styling.md`

### Code Style Essentials

- Prefer arrow functions and `type` over `interface`
- Use package imports in tests (`'plaited'`, `'plaited/ui'`, `'plaited/testing'`, `'plaited/utils'`)
- Use `test` instead of `it` in test files
- Prefer Bun native APIs over Node.js equivalents
- JSX syntax only (not `h()` or `createTemplate()`)
- Object parameters for functions with 2+ parameters

For complete conventions, see the **plaited-standards** skill: `.claude/skills/plaited-standards/references/code-conventions.md`

### Plugin Development

When working on plugins in `.claude/`:
- Clear cache after changes: `rm -rf ~/.claude/plugins-cache`
- Restart Claude Code to see updates
- Skills are auto-invoked (won't show in `/plugins` UI)

### Documentation

- Public APIs require comprehensive TSDoc documentation
- No `@example` sections - tests/stories are living examples
- Use `@internal` marker for non-public APIs
- Always use `type` over `interface`
- Use Mermaid diagrams only (not ASCII art)
- In SKILL.md files, use markdown links `[name](path)` not `@path` references

See the **plaited-standards** skill (`.claude/skills/plaited-standards/references/standards.md`) and the **code-documentation** skill for complete guidelines.

## Important Constraints

1. **No Open Contribution**: This is open-source but not open-contribution
2. **Bun Required**: Development requires bun >= v1.2.9
3. **ES2024 Features**: Uses Promise.withResolvers() and other modern APIs
4. **Shadow DOM Focus**: Framework assumes Shadow DOM usage
5. **Template Terminology**: Never use "component" or "components" - Plaited is a template-driven framework. Use "template", "templates", "elements", "elements", "behavioral element", or "behavioral elements" in all documents, examples, and comments

## Additional Resources

**Skills** (`.claude/skills/`):
- **plaited-standards**: Code conventions, development standards, verification workflow
- **plaited-behavioral-core**: Behavioral programming patterns, neuro-symbolic reasoning
- **plaited-ui-patterns**: Templates, bElements, styling, forms, stories
- **code-documentation**: TSDoc workflow and templates
- **typescript-lsp**: Type verification and symbol discovery
- **workbench**: Story discovery and preview
- **design-system**: Design tokens and scaffolding scripts

**Project-Specific Rules** (`.claude/rules/`):
- Testing commands and workflow
- Code review standards
- Accuracy and confidence thresholds

## Specialized Agents

- **architecture-reviewer**: Validates BP patterns, signal usage, and framework alignment
- **documentation-cleanup**: Enforces TSDoc standards, removes comment pollution, syncs docs with code
