---
description: Find all references to a TypeScript symbol across the codebase
allowed-tools: Bash, Glob
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

Example: /lsp-refs src/main/b-element.ts 139 13
```

### Step 2: Locate typescript-lsp Skill

Find the typescript-lsp skill directory. Use Glob to locate it:
```glob
**/typescript-lsp/SKILL.md
```

The skill directory is the parent of SKILL.md.

### Step 3: Run LSP References

From the skill directory, run:
```bash
bun <skill-dir>/scripts/lsp-references.ts <file> <line> <char>
```

### Step 4: Format Output

Parse the JSON output and present references grouped by file:

**Found X references:**

`src/file1.ts`
- Line 42: `const x = targetSymbol()`
- Line 58: `import { targetSymbol } from...`

`src/file2.ts`
- Line 15: `targetSymbol.method()`

If no references found, indicate that the symbol may be unused or only defined.
