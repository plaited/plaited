---
description: Search for TypeScript symbols across the workspace by name
allowed-tools: Bash, Glob
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

### Step 2: Locate typescript-lsp Skill

Find the typescript-lsp skill directory. Use Glob to locate it:
```glob
**/typescript-lsp/SKILL.md
```

The skill directory is the parent of SKILL.md.

### Step 3: Run LSP Find

From the skill directory, run:
```bash
bun <skill-dir>/scripts/lsp-find.ts <query> [context-file]
```

### Step 4: Format Output

Parse the JSON output and present results as a table:

| Symbol | Kind | File | Line |
|--------|------|------|------|
| ... | ... | ... | ... |

Group results by file if there are many matches. Highlight the most relevant matches (exact name matches first).
