---
name: design-system-scaffolding
description: Generate Plaited design system assets including bElements, stories, tokens, and styles. Use when scaffolding new templates or design system files.
allowed-tools: Write, Read, Glob
---

# Design System Scaffolding

Scripts for generating Plaited design system assets.

## Purpose

This skill provides scaffold scripts to generate:
- Design tokens (`*.tokens.ts`)
- Styles (`*.css.ts`)
- Stories (`*.stories.tsx`)
- Behavioral templates (`bElement` files)

## Scripts

### scaffold-tokens.ts

Generate a tokens file with createTokens patterns.

```bash
bun scaffold-tokens.ts <name> <namespace> [--output <path>]
```

**Arguments:**
- `name`: Token file name (e.g., `fills`, `spacing`)
- `namespace`: Token namespace for CSS variables
- `--output`: Output directory (default: current directory)

**Example:**
```bash
bun scaffold-tokens.ts fills fills --output src/tokens/
# Creates: src/tokens/fills.tokens.ts
```

### scaffold-styles.ts

Generate a styles file with createStyles and createHostStyles.

```bash
bun scaffold-styles.ts <name> [--host] [--output <path>]
```

**Arguments:**
- `name`: Style file name (e.g., `button`, `card`)
- `--host`: Include hostStyles for bElement
- `--output`: Output directory (default: current directory)

**Example:**
```bash
bun scaffold-styles.ts toggle-input --host --output src/components/
# Creates: src/components/toggle-input.css.ts
```

### scaffold-story.ts

Generate a story file for testing templates.

```bash
bun scaffold-story.ts <name> [--element <tag>] [--output <path>]
```

**Arguments:**
- `name`: Story file name
- `--element`: Custom element tag to import (for bElement stories)
- `--output`: Output directory (default: current directory)

**Example:**
```bash
bun scaffold-story.ts toggle-input --element toggle-input --output src/components/
# Creates: src/components/toggle-input.stories.tsx
```

### scaffold-behavioral-template.ts

Generate a complete bElement with associated files.

```bash
bun scaffold-behavioral-template.ts <name> [--form-associated] [--output <path>]
```

**Arguments:**
- `name`: Element name (kebab-case, e.g., `toggle-input`)
- `--form-associated`: Include formAssociated: true
- `--output`: Output directory (default: current directory)

**Example:**
```bash
bun scaffold-behavioral-template.ts toggle-input --form-associated --output src/components/
# Creates:
#   src/components/toggle-input.tokens.ts
#   src/components/toggle-input.css.ts
#   src/components/toggle-input.ts
#   src/components/toggle-input.stories.tsx
```

## File Organization

Generated files follow Plaited conventions:

```
component/
  [name].tokens.ts      # Design tokens (createTokens)
  [name].css.ts         # Styles (createStyles, createHostStyles)
  [name].ts             # bElement definition
  [name].stories.tsx    # Story tests
```

## Usage Patterns

### Simple FunctionalTemplate

For simple presentational elements, generate only styles and story:

```bash
bun scaffold-styles.ts button --output src/components/button/
bun scaffold-story.ts button --output src/components/button/
```

### Complex bElement

For interactive elements, generate the full set:

```bash
bun scaffold-behavioral-template.ts toggle-input --form-associated --output src/components/toggle-input/
```

## Related Skills

- **design-tokens-library** - Token pattern reference
- **plaited-framework-patterns** - Complete styling documentation
- **generative-templates** - Generate from project patterns
