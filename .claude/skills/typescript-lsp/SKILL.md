---
name: typescript-lsp
description: TypeScript Language Server integration for type verification, symbol discovery, and code navigation. Use before reading, editing, or writing TypeScript/JavaScript code to understand types, find references, and verify signatures. Includes Plaited framework verification workflows. (project)
license: ISC
compatibility: Requires bun
allowed-tools: Bash
---

# TypeScript LSP Skill

## Purpose

This skill provides TypeScript Language Server Protocol integration for enhanced code understanding. Use these tools to:
- Verify type signatures before writing code
- Find all references before modifying or deleting exports
- Understand file structure and exports
- Navigate to definitions
- Search for symbols across the workspace

## When to Use

**Before reading code:**
- Run `lsp-symbols` to get an overview of file structure
- Run `lsp-analyze --exports` to see what a module provides

**Before editing code:**
- Run `lsp-references` to find all usages of a symbol you plan to modify
- Run `lsp-hover` to verify current type signatures

**Before writing code:**
- Run `lsp-find` to search for similar patterns or related symbols
- Run `lsp-hover` on APIs you plan to use

## Path Resolution

All scripts accept three types of file paths:
- **Absolute paths**: `/Users/name/project/src/file.ts`
- **Relative paths**: `./src/file.ts` or `../other/file.ts`
- **Package export paths**: `plaited/main/b-element.ts` (resolved via `Bun.resolve()`)

Package export paths are recommended for portability and consistency with the package's exports field.

## Scripts

### Individual Scripts

#### lsp-hover
Get type information at a specific position.

```bash
bun scripts/lsp-hover.ts <file> <line> <char>
```

**Arguments:**
- `file`: Path to TypeScript/JavaScript file
- `line`: Line number (0-indexed)
- `char`: Character position (0-indexed)

**Example:**
```bash
bun scripts/lsp-hover.ts plaited/main/b-element.ts 139 13
```

#### lsp-symbols
List all symbols in a file.

```bash
bun scripts/lsp-symbols.ts <file>
```

**Example:**
```bash
bun scripts/lsp-symbols.ts plaited/main/b-element.ts
```

#### lsp-references
Find all references to a symbol.

```bash
bun scripts/lsp-references.ts <file> <line> <char>
```

**Example:**
```bash
bun scripts/lsp-references.ts plaited/main/b-element.ts 139 13
```

#### lsp-find
Search for symbols across the workspace.

```bash
bun scripts/lsp-find.ts <query> [context-file]
```

**Arguments:**
- `query`: Symbol name or partial name
- `context-file`: Optional file to open for project context

**Example:**
```bash
bun scripts/lsp-find.ts bElement
bun scripts/lsp-find.ts useTemplate plaited/main/use-template.ts
```

### Batch Script

#### lsp-analyze
Perform multiple analyses in a single session for efficiency.

```bash
bun scripts/lsp-analyze.ts <file> [options]
```

**Options:**
- `--symbols, -s`: List all symbols
- `--exports, -e`: List only exported symbols
- `--hover <line:char>`: Get type info (repeatable)
- `--refs <line:char>`: Find references (repeatable)
- `--all`: Run symbols + exports analysis

**Examples:**
```bash
# Get file overview
bun scripts/lsp-analyze.ts plaited/main/b-element.ts --all

# Check multiple positions
bun scripts/lsp-analyze.ts plaited/main/b-element.ts --hover 50:10 --hover 139:13

# Before refactoring: find all references
bun scripts/lsp-analyze.ts plaited/main/b-element.ts --refs 139:13
```

## Common Workflows

### Understanding a File

```bash
# 1. Get exports overview
bun scripts/lsp-analyze.ts path/to/file.ts --exports

# 2. For specific type info, hover on interesting symbols
bun scripts/lsp-hover.ts path/to/file.ts <line> <char>
```

### Before Modifying an Export

```bash
# 1. Find all references first
bun scripts/lsp-references.ts path/to/file.ts <line> <char>

# 2. Check what depends on it
# Review the output to understand impact
```

### Finding Patterns

```bash
# Search for similar implementations
bun scripts/lsp-find.ts createStyles
bun scripts/lsp-find.ts bElement
```

### Pre-Implementation Verification

```bash
# Before writing code that uses an API, verify its signature
bun scripts/lsp-hover.ts path/to/api.ts <line> <char>
```

## Output Format

All scripts output JSON to stdout. Errors go to stderr.

**Hover output:**
```json
{
  "contents": {
    "kind": "markdown",
    "value": "```typescript\nconst bElement: ...\n```"
  },
  "range": { "start": {...}, "end": {...} }
}
```

**Symbols output:**
```json
[
  {
    "name": "symbolName",
    "kind": 13,
    "range": { "start": {...}, "end": {...} }
  }
]
```

**Analyze output:**
```json
{
  "file": "path/to/file.ts",
  "exports": [
    { "name": "exportName", "kind": "Constant", "line": 139 }
  ]
}
```

## Performance

Each script invocation:
1. Starts TypeScript Language Server (~300-500ms)
2. Initializes LSP connection
3. Opens document
4. Performs query
5. Closes and stops

For multiple queries on the same file, use `lsp-analyze` to batch operations in a single session.

## Plaited-Specific Verification

See [lsp-verification.md](references/lsp-verification.md) for Plaited framework type verification patterns:
- When to use LSP for Plaited APIs (bElement, createStyles, bProgram)
- Example workflow for verifying BProgramArgs, callbacks, and helper methods
- Critical files to verify (b-element.types.ts, css.types.ts, behavioral.types.ts)
- Integration with code generation workflow

## Related Skills

- **plaited-framework-patterns**: Plaited framework patterns and best practices
- **code-documentation**: TSDoc standards for documentation
