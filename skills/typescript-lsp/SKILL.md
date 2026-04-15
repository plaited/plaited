---
name: typescript-lsp
description: Type-aware TypeScript/JavaScript codebase analysis. Provides hover info, references, definitions, symbols, exports, workspace symbol search, and workspace audit operations via a single unified CLI.
license: ISC
compatibility: Requires bun and typescript-language-server
allowed-tools: Bash
metadata:
  file-triggers: "*.ts,*.tsx,*.js,*.jsx"
---

# TypeScript LSP Skill

## Purpose

Type-aware codebase analysis for TypeScript/JavaScript files. Use over Grep/Glob when you need semantic understanding of symbols, types, imports, exports, references, or a reusable workspace export audit.

## When to Use

| Task | Tool |
|------|------|
| Find all usages of a function/type | `typescript-lsp` with `references` |
| Get type signature + TSDoc | `typescript-lsp` with `hover` |
| Search for a symbol by name | `typescript-lsp` with `find` |
| List file exports | `typescript-lsp` with `exports` |
| Scan imports/exports across many files | `typescript-lsp` with `workspace_scan` |
| Inventory public exports across many files | `typescript-lsp` with `public_exports` |
| Audit candidate export consumers | `typescript-lsp` with `export_consumers` |
| Find verified candidate unused exports | `typescript-lsp` with `candidate_unused_exports` |
| Find files by pattern | Glob |
| Search text content | Grep |

## Usage

Single command with JSON input. All operations share one LSP session (one server start).

```bash
bun skills/typescript-lsp/scripts/run.ts '<json>'
echo '<json>' | bun skills/typescript-lsp/scripts/run.ts
bun skills/typescript-lsp/scripts/run.ts --schema input    # JSON Schema for input
bun skills/typescript-lsp/scripts/run.ts --schema output   # JSON Schema for output
```

## Input Format

```json
{
  "file": "src/app.ts",
  "targets": ["src/**/*.ts", "src/**/*.tsx"],
  "operations": [
    { "type": "hover", "line": 5, "character": 10 },
    { "type": "references", "line": 20, "character": 3 },
    { "type": "definition", "line": 15, "character": 8 },
    { "type": "symbols" },
    { "type": "exports" },
    { "type": "find", "query": "parseConfig" },
    { "type": "workspace_scan", "includeTests": false },
    { "type": "public_exports", "includeTests": false },
    { "type": "export_consumers", "query": "parseConfig", "includeTests": true },
    { "type": "candidate_unused_exports", "includeTests": true }
  ]
}
```

**Fields:**
- `file` — path to TypeScript/JavaScript file (absolute or relative to cwd)
- `files` — explicit file list for workspace audit operations
- `targets` — glob patterns for workspace audit operations
- `operations` — array of operations to perform in a single session

**Operation types:**

| Type | Required fields | Description |
|------|----------------|-------------|
| `hover` | `line`, `character` | Type info + TSDoc at position |
| `references` | `line`, `character` | All references to symbol at position |
| `definition` | `line`, `character` | Go to definition |
| `symbols` | — | All symbols in the file |
| `exports` | — | Exported symbols only |
| `find` | `query` | Search workspace symbols by name |
| `scan` | — | Fast import/export extraction for one file using `Bun.Transpiler.scan()` |
| `workspace_scan` | `includeTests?` | Fast import/export extraction across `files` or `targets` |
| `public_exports` | `includeTests?` | Compiler-backed export inventory across `files` or `targets` |
| `export_consumers` | `query?`, `includeTests?` | Candidate consumer audit for exported symbols across `files` or `targets` |
| `candidate_unused_exports` | `query?`, `includeTests?` | TypeScript-verified unused export audit with `unused` vs `test_only` status |

Positions are 0-indexed.

## Output Format

JSON to stdout. Each result corresponds to the input operation at the same index.

```json
{
  "file": "src/app.ts",
  "results": [
    {
      "type": "hover",
      "data": {
        "contents": { "kind": "markdown", "value": "```typescript\nconst x: number\n```" },
        "range": { "start": { "line": 5, "character": 6 }, "end": { "line": 5, "character": 7 } }
      }
    },
    {
      "type": "exports",
      "data": [
        { "name": "parseConfig", "kind": "Function", "line": 10 },
        { "name": "Config", "kind": "Variable", "line": 3 }
      ]
    },
    {
      "type": "hover",
      "error": "hover requires line and character"
    }
  ]
}
```

Failed operations include an `error` field instead of `data`. Other operations still run.

## Common Workflows

### Understand a file

```bash
bun skills/typescript-lsp/scripts/run.ts '{"file": "src/utils/parser.ts", "operations": [{"type": "exports"}]}'
```

### Check type before using an API

```bash
bun skills/typescript-lsp/scripts/run.ts '{"file": "src/utils/parser.ts", "operations": [{"type": "hover", "line": 42, "character": 10}]}'
```

### Find all references before refactoring

```bash
bun skills/typescript-lsp/scripts/run.ts '{"file": "src/utils/parser.ts", "operations": [{"type": "references", "line": 42, "character": 10}]}'
```

### Batch: exports + hover + references in one session

```bash
bun skills/typescript-lsp/scripts/run.ts '{"file": "src/utils/parser.ts", "operations": [{"type": "exports"}, {"type": "hover", "line": 10, "character": 13}, {"type": "references", "line": 10, "character": 13}]}'
```

### Search workspace for a symbol

```bash
bun skills/typescript-lsp/scripts/run.ts '{"file": "src/app.ts", "operations": [{"type": "find", "query": "parseConfig"}]}'
```

### Scan imports and runtime exports across many files

```bash
bun skills/typescript-lsp/scripts/run.ts '{"file": "src/main.ts", "targets": ["src/**/*.ts", "src/**/*.tsx"], "operations": [{"type": "workspace_scan", "includeTests": false}]}'
```

### Inventory public exports across many files

```bash
bun skills/typescript-lsp/scripts/run.ts '{"file": "src/main.ts", "targets": ["src/**/*.ts", "src/**/*.tsx"], "operations": [{"type": "public_exports", "includeTests": false}]}'
```

### Audit candidate export consumers

```bash
bun skills/typescript-lsp/scripts/run.ts '{"file": "src/main.ts", "targets": ["src/agent/**/*.ts"], "operations": [{"type": "export_consumers", "query": "Module", "includeTests": true}]}'
```

### Find verified candidate unused exports

```bash
bun skills/typescript-lsp/scripts/run.ts '{"file": "src/main.ts", "targets": ["src/agent/**/*.ts"], "operations": [{"type": "candidate_unused_exports", "includeTests": true}]}'
```

## Notes

- `workspace_scan` is fast and uses `Bun.Transpiler.scan()`. It is best for import/export indexing, not semantic reference truth.
- `public_exports` uses the TypeScript compiler API, so it includes type-only exports that `scan()` does not report.
- `export_consumers` is a candidate audit. It classifies matching symbol mentions into production and test files, but it is not a full LSP find-references replacement.
- `candidate_unused_exports` stays JSON-first for agent consumers. It verifies references over the provided `files` or `targets` set and does not add `summary` or `table` output modes.

## Exit Codes

- `0` — all operations succeeded
- `1` — one or more operations failed (partial results returned)
- `2` — bad input or tool error

## Related Skills

- **code-documentation** — TSDoc standards for documentation
