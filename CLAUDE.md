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

- **Development**: @.claude/rules/development/ - Testing commands, plugin development workflow
- **Documentation**: @.claude/rules/documentation/ - TSDoc generation workflow
- **Standards**: @.claude/rules/standards/ - Terminology, code review guidelines, accuracy standards

For comprehensive Plaited patterns, code conventions, and standards, see the **studio plugin** (`plugins/studio/skills/plaited-patterns/`).

For detailed TSDoc templates, see the code-documentation skill.

## Quick Reference

### Testing Overview

Plaited uses Bun's test runner for unit/integration tests (`*.spec.{ts,tsx}`) and a custom workshop CLI for browser-based template tests (`*.stories.tsx`).

See @.claude/rules/development/testing.md for complete testing guide.

### Architecture Highlights

Plaited is a behavioral programming framework for reactive custom elements. Key pillars:
1. Behavioral Programming (BP) Paradigm
2. Custom Elements with Shadow DOM
3. CSS-in-JS System

For architectural patterns and implementation details, see the studio plugin:
- `plugins/studio/skills/plaited-patterns/plaited/behavioral-programs.md`
- `plugins/studio/skills/plaited-patterns/plaited/b-element.md`
- `plugins/studio/skills/plaited-patterns/plaited/styling.md`

### Code Style Essentials

- Prefer arrow functions and `type` over `interface`
- Use package imports in tests (`'plaited'`, `'plaited/testing'`, `'plaited/utils'`)
- Use `test` instead of `it` in test files
- Prefer Bun native APIs over Node.js equivalents
- JSX syntax only (not `h()` or `createTemplate()`)
- Object parameters for functions with 2+ parameters

For complete conventions, see the studio plugin: `plugins/studio/skills/plaited-patterns/plaited/code-conventions.md`

### Plugin Development

When working on plugins in `plugins/`:
- Clear cache after changes: `rm -rf ~/.claude/plugins-cache`
- Restart Claude Code to see updates
- Skills are auto-invoked (won't show in `/plugins` UI)

See @.claude/rules/development/plugin-development.md for complete guide.

### Documentation

- Public APIs require comprehensive TSDoc documentation
- No `@example` sections - tests/stories are living examples
- Use `@internal` marker for non-public APIs
- Always use `type` over `interface`
- Use Mermaid diagrams only (not ASCII art)

See the studio plugin (`plugins/studio/skills/plaited-patterns/plaited/standards.md`) and the code-documentation skill for complete guidelines.

## Important Constraints

1. **No Open Contribution**: This is open-source but not open-contribution
2. **Bun Required**: Development requires bun >= v1.2.9
3. **ES2024 Features**: Uses Promise.withResolvers() and other modern APIs
4. **Shadow DOM Focus**: Framework assumes Shadow DOM usage

## Additional Resources

**Studio Plugin** (`plugins/studio/skills/plaited-patterns/`):
- Comprehensive Plaited patterns, examples, and best practices
- Code conventions and standards
- Verification workflows for accurate code generation
- Self-contained and publishable to marketplace

**Project-Specific Rules** (`.claude/rules/`):
- Testing commands and workflow
- Plugin development guidelines
- TSDoc generation workflow
- Code review standards
- Project terminology

Use the code-documentation skill for TSDoc template reference.

## Specialized Agents

- **architecture-reviewer**: Validates BP patterns, signal usage, and framework alignment
- **documentation-cleanup**: Enforces TSDoc standards, removes comment pollution, syncs docs with code
