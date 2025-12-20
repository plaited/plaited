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

# Lint and format (auto-fix issues)
bun run check:write
```

## Project Organization

This project uses `.claude/rules/` for modular guidance:

- **Architecture**: @.claude/rules/architecture/ - Core concepts, patterns, implementation details
- **Development**: @.claude/rules/development/ - Code style, testing, imports, null handling, signals
- **Documentation**: @.claude/rules/documentation/ - TSDoc philosophy and workflow
- **Platform**: @.claude/rules/platform/ - Bun APIs
- **Standards**: @.claude/rules/standards/ - Terminology, code review guidelines, accuracy standards

For detailed TSDoc templates, see the code-documentation skill.

## Quick Reference

### Testing Overview

Plaited uses Bun's test runner for unit/integration tests (`*.spec.{ts,tsx}`) and a custom workshop CLI for browser-based template tests (`*.stories.tsx`).

See @.claude/rules/development/testing.md for complete testing guide.

### Architecture Highlights

Plaited is a behavioral programming framework for reactive web components. Key pillars:
1. Behavioral Programming (BP) Paradigm
2. Web Components with Shadow DOM
3. CSS-in-JS System

See @.claude/rules/architecture/ for detailed architectural documentation.

### Code Style Essentials

- Prefer arrow functions and `type` over `interface`
- Use package imports in tests (`'plaited'`, `'plaited/testing'`, `'plaited/utils'`)
- Use `test` instead of `it` in test files
- Prefer Bun native APIs over Node.js equivalents

See @.claude/rules/development/code-style.md for complete style guide.

### Documentation

- Public APIs require comprehensive TSDoc documentation
- No `@example` sections - tests/stories are living examples
- Use `@internal` marker for non-public APIs
- Always use `type` over `interface`

See @.claude/rules/documentation/ and the code-documentation skill for complete guidelines.

## Important Constraints

1. **No Open Contribution**: This is open-source but not open-contribution
2. **Bun Required**: Development requires bun >= v1.2.9
3. **ES2024 Features**: Uses Promise.withResolvers() and other modern APIs
4. **Shadow DOM Focus**: Framework assumes Shadow DOM usage

## Additional Resources

All detailed guidance is organized in `.claude/rules/` by topic. Files are automatically loaded and provide comprehensive context for:

- Architecture patterns and implementation details
- Development standards and best practices
- Platform-specific guidelines (Bun)
- Code review and documentation standards

Use the code-documentation skill for TSDoc template reference.

## Specialized Agents

- **architecture-reviewer**: Validates BP patterns, signal usage, and framework alignment
- **documentation-cleanup**: Enforces TSDoc standards, removes comment pollution, syncs docs with code
