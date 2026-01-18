---
description: Search for TypeScript symbols across the workspace by name
allowed-tools: Bash
---

# LSP Find

Search for symbols (functions, types, classes, variables) across the TypeScript/JavaScript codebase.

**Arguments:** $ARGUMENTS

## Usage

```
/lsp-find <query> [context-file]
```

- `query`: Symbol name or partial name to search for
- `context-file`: Optional file to open for project context

## Instructions

### Step 1: Parse Arguments

Extract query and optional context file from `$ARGUMENTS`.

If query is missing, show usage:
```
Usage: /lsp-find <query> [context-file]

Examples:
  /lsp-find bElement
  /lsp-find useTemplate src/main/use-template.ts
```

### Step 2: Run LSP Find

Execute the development-skills CLI command:
```bash
bunx @plaited/development-skills lsp-find <query> [context-file]
```

### Step 3: Format Output

Parse the JSON output and present results as a table:

| Symbol | Kind | File | Line |
|--------|------|------|------|
| ... | ... | ... | ... |

Group results by file if there are many matches. Highlight the most relevant matches (exact name matches first).
