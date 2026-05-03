---
name: code-documentation
description: TSDoc standards for TypeScript/JavaScript code. Automatically invoked when writing, reviewing, or editing any TSDoc comments, code documentation, or API documentation. (project)
license: ISC
compatibility: Requires bun
---

# Code Documentation Skill

## Purpose

This skill provides both TSDoc policy guidance and an executable audit tool for ongoing maintenance. Use this when:
- Writing or editing TSDoc comments for any function, type, or module
- Reviewing documentation quality
- Creating comprehensive API documentation
- Documenting complex type structures
- Cleaning up non-compliant comments (performance notes, timestamps, inline explanations)
- Synchronizing out-of-sync TSDoc with code changes
- Removing orphaned documentation for deleted code

**Key Standard**: No `@example` sections - tests and stories serve as living examples.

## Quick Reference

- **Audit current coverage**:
  `bun skills/code-documentation/scripts/run.ts '{"targets":["src/**/*.ts"]}'`
- **Print JSON schema**:
  `bun skills/code-documentation/scripts/run.ts --schema input`
- **Creating TSDoc**: See [workflow.md](references/workflow.md) for the generation workflow
- **Maintaining TSDoc**: See [maintenance.md](references/maintenance.md) for cleanup and sync guidelines

## CLI

The skill now includes an AST-based audit tool:

```bash
bun skills/code-documentation/scripts/run.ts '{"targets":["src/**/*.ts","src/**/*.tsx"]}'
echo '{"targets":["src/agent/agent.ts"]}' | bun skills/code-documentation/scripts/run.ts
```

The CLI reports:
- `missing-docs` — exported top-level declarations without attached JSDoc/TSDoc
- `public-exports` — exported declarations with line/kind/documented status
- `orphaned-docs` — JSDoc blocks not attached to an AST node
- `doc-coverage` — per-file exported declaration coverage summary

Use the CLI first for inventory, then use `typescript-lsp` plus the reference templates to write or repair the actual comments.

This skill contains detailed templates for:
- Public API Functions
- Internal Module Documentation
- Public and Internal Types
- Helper Functions
- Behavioral Programming Functions
- Special Annotations (Security, Performance, Deprecated)
- Type Documentation (Complex Objects, Unions, Functions, Utilities, Branded Types, etc.)

## Navigation

- [workflow.md](references/workflow.md) - TSDoc generation workflow (4 phases)
- [maintenance.md](references/maintenance.md) - Comment policy, sync tasks, orphaned doc handling
- [public-api-templates.md](references/public-api-templates.md) - Templates for public-facing APIs
- [internal-templates.md](references/internal-templates.md) - Templates for internal code and modules
- [type-documentation.md](references/type-documentation.md) - Comprehensive type documentation templates

## Related Skills

- **typescript-lsp**: Use for type verification and discovery during documentation workflow. Essential for Phase 1 (type analysis) and Phase 2 (usage discovery) of the TSDoc generation process. Run `lsp` with `hover` to verify signatures, `references` to find usages, and `symbols` to understand file structure.
