---
name: typescript-lsp
description: Type-aware TypeScript/JavaScript codebase analysis. Provides hover info, references, definitions, symbols, exports, and workspace symbol search via a single unified LSP tool.
license: ISC
compatibility: Requires bun and typescript-language-server
allowed-tools: Bash
metadata:
  file-triggers: "*.ts,*.tsx,*.js,*.jsx"
---

# TypeScript LSP Skill

## Purpose

Type-aware codebase analysis for TypeScript/JavaScript files. Use over Grep/Glob when you need semantic understanding of symbols, types, imports, exports, and references.

## When to Use

| Task | Tool |
|------|------|
| Find all usages of a function/type | `typescript-lsp` with `references` |
| Get type signature + TSDoc | `typescript-lsp` with `hover` |
| Search for a symbol by name | `typescript-lsp` with `find` |
| List file exports | `typescript-lsp` with `exports` |
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
  "operations": [
    { "type": "hover", "line": 5, "character": 10 },
    { "type": "references", "line": 20, "character": 3 },
    { "type": "definition", "line": 15, "character": 8 },
    { "type": "symbols" },
    { "type": "exports" },
    { "type": "find", "query": "parseConfig" }
  ]
}
```

**Fields:**
- `file` — path to TypeScript/JavaScript file (absolute or relative to cwd)
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

## Exit Codes

- `0` — all operations succeeded
- `1` — one or more operations failed (partial results returned)
- `2` — bad input or tool error

## Related Skills

- **code-documentation** — TSDoc standards for documentation
