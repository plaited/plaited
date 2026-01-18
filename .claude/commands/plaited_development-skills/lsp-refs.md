---
description: Find all references to a TypeScript symbol across the codebase
allowed-tools: Bash
---

# LSP References

Find all references to a symbol at a specific position. Use this before modifying or deleting exports to understand impact.

**Arguments:** $ARGUMENTS

## Usage

```
/lsp-refs <file> <line> <char>
```

- `file`: Path to TypeScript/JavaScript file
- `line`: Line number (0-indexed)
- `char`: Character position (0-indexed)

## Instructions

### Step 1: Parse Arguments

Extract file path, line, and character from `$ARGUMENTS`.

If arguments are missing, show usage:
```
Usage: /lsp-refs <file> <line> <char>

Example: /lsp-refs src/utils/parser.ts 42 10
```

### Step 2: Run LSP References

Execute the development-skills CLI command:
```bash
bunx @plaited/development-skills lsp-refs <file> <line> <char>
```

### Step 3: Format Output

Parse the JSON output and present references grouped by file:

**Found X references:**

`src/file1.ts`
- Line 42: `const x = targetSymbol()`
- Line 58: `import { targetSymbol } from...`

`src/file2.ts`
- Line 15: `targetSymbol.method()`

If no references found, indicate that the symbol may be unused or only defined.
