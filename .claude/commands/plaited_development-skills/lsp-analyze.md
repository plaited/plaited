---
description: Analyze a TypeScript file structure, exports, and symbols
allowed-tools: Bash
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
  /lsp-analyze src/utils/parser.ts --exports
  /lsp-analyze src/lib/config.ts --all
  /lsp-analyze src/index.ts --hover 50:10 --refs 60:5
```

Default to `--exports` if no options provided.

### Step 2: Run LSP Analyze

Execute the development-skills CLI command:
```bash
bunx @plaited/development-skills lsp-analyze <file> [options]
```

### Step 3: Format Output

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
