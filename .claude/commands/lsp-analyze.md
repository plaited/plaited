---
description: Analyze a TypeScript file structure, exports, and symbols
allowed-tools: Bash, Glob
---

# LSP Analyze

Batch analysis of a TypeScript/JavaScript file. Get an overview of exports, symbols, and optionally type info at specific positions.

**Arguments:** $ARGUMENTS

## Usage

```
/lsp-analyze <file> [options]
```

Options:
- `--symbols` or `-s`: List all symbols
- `--exports` or `-e`: List only exported symbols (default if no options)
- `--hover <line:char>`: Get type info at position (repeatable)
- `--refs <line:char>`: Find references at position (repeatable)
- `--all`: Run symbols + exports analysis

## Instructions

### Step 1: Parse Arguments

Extract file path and options from `$ARGUMENTS`.

If file is missing, show usage:
```
Usage: /lsp-analyze <file> [options]

Examples:
  /lsp-analyze src/main/b-element.ts --exports
  /lsp-analyze src/utils/css.ts --all
  /lsp-analyze src/main/index.ts --hover 50:10 --refs 60:5
```

Default to `--exports` if no options provided.

### Step 2: Locate typescript-lsp Skill

Find the typescript-lsp skill directory. Use Glob to locate it:
```glob
**/typescript-lsp/SKILL.md
```

The skill directory is the parent of SKILL.md.

### Step 3: Run LSP Analyze

From the skill directory, run:
```bash
bun <skill-dir>/scripts/lsp-analyze.ts <file> [options]
```

### Step 4: Format Output

Parse the JSON output and present in a structured format:

**File:** `<file>`

**Exports:**
| Name | Kind | Line |
|------|------|------|
| ... | ... | ... |

**Symbols:** (if requested)
| Name | Kind | Line |
|------|------|------|
| ... | ... | ... |

For hover/refs results, format as described in the individual commands.
