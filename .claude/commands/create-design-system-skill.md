---
description: Create a new design system extraction skill for documenting design tokens and patterns
allowed-tools: Write, Bash, AskUserQuestion
---

# Create Design System Skill

Create a new skill for extracting and documenting design system tokens and patterns with Plaited's createTokens integration.

**Skill Name:** $ARGUMENTS (default: `design-system`)

## Instructions

### Step 1: Get Skill Name
If no skill name provided in $ARGUMENTS, use `design-system` as default.

### Step 2: Ask About Tool Restrictions
Use AskUserQuestion to ask:

**Question 1:** "What tool access should this skill have?"
**Options:**
1. **Restricted (Recommended)** - Limit to specific tools
2. **Unrestricted** - No `allowed-tools` field, skill can use any available tools

**If user chose Restricted, ask Question 2:**
"Which tools should this skill have access to?"
**Options:**
1. **Default** - `WebFetch, Write, Read, Glob` (essential for pattern extraction)
2. **With Chrome DevTools** - Default plus `mcp__chrome-devtools__*` (for visual inspection with browser)
3. **Add tools** - Default plus additional tools (user provides comma-separated list)

### Step 3: Create Skill Files
1. Create the skill directory: `.claude/skills/[skill-name]/`
2. Create the `SKILL.md` file with the template below (include `allowed-tools` if user chose Restricted)
3. Create the `references/` directory with a `.gitkeep` placeholder

### Step 4: Confirm Creation
Tell the user:
1. Skill created at `.claude/skills/[skill-name]/`
2. Tool access: [restricted/unrestricted]
3. **Restart Claude Code** to activate the new skill
4. Resume this session with: `claude -r`
5. Extract tokens by:
   - Asking Claude to fetch design system URLs
   - Using Chrome DevTools to visually inspect pages (if enabled)
   - Describing tokens in conversation for refinement
6. Patterns will be saved to `references/` directory
7. After adding patterns, ask Claude to re-read the skill to update context

## Skill Template

Create `.claude/skills/[skill-name]/SKILL.md` with this content:

**Frontmatter (if Restricted):**
```yaml
---
name: [skill-name]
description: Extract design system tokens and patterns for Plaited's createTokens. Use when extracting color palettes, spacing scales, typography, or design patterns from URLs or visual inspection.
allowed-tools: [tool-list]
---
```
Where `[tool-list]` is:
- Default: `WebFetch, Write, Read, Glob`
- With Chrome DevTools: `WebFetch, Write, Read, Glob, mcp__chrome-devtools__*`
- Add tools: `WebFetch, Write, Read, Glob, [user-provided-tools]`

**Frontmatter (if Unrestricted):**
```yaml
---
name: [skill-name]
description: Extract design system tokens and patterns for Plaited's createTokens. Use when extracting color palettes, spacing scales, typography, or design patterns from URLs or visual inspection.
---
```

**Then the skill content:**
```markdown
# [Skill Name Title]

Extract design system tokens from external sources and generate Plaited createTokens patterns.

## Purpose

This skill activates when:
- Extracting design tokens from design system documentation
- Analyzing color palettes, spacing, typography from websites
- Converting design specifications to createTokens format
- Creating project-specific token documentation

## Token Extraction

### Target Patterns

- **Colors** - Palettes, semantic colors, state variations
- **Spacing** - Scales, layout patterns
- **Typography** - Font families, scales, line heights
- **Animation** - Durations, easings, keyframes
- **Shadows** - Elevation systems
- **Border Radius** - Shape systems

### Extraction Methods

#### From URLs (WebFetch)
Fetch design system documentation and extract token values:
- Color palette pages
- Typography specifications
- Spacing guidelines
- Component documentation

#### From Visual Inspection (Chrome DevTools - if enabled)
Use browser automation to inspect live pages:
- Take screenshots for visual reference
- Use `take_snapshot` for a11y tree structure
- Extract computed styles via `evaluate_script`

#### From Conversation
Describe tokens in natural language for refinement:
- "The primary color should be a deep blue"
- "Use an 8px spacing scale"
- "Typography based on Inter font"

## createTokens Patterns

### Color System
\`\`\`typescript
import { createTokens } from 'plaited'

export const [colorTokens, colorVars] = createTokens({
  // Primitives with light/dark defaults
  blue: {
    500: {
      $value: '#3B82F6',
      $default: 'light',
    },
    600: {
      $value: '#2563EB',
      $default: 'dark',
    },
  },
  // Semantic aliases
  primary: {
    $value: '{blue.500}',
    $default: 'light',
  },
})
\`\`\`

### Spacing Scale
\`\`\`typescript
export const [spacingTokens, spacingVars] = createTokens({
  space: {
    1: { $value: '0.25rem' },
    2: { $value: '0.5rem' },
    4: { $value: '1rem' },
    8: { $value: '2rem' },
  },
})
\`\`\`

### Typography Scale
\`\`\`typescript
export const [typeTokens, typeVars] = createTokens({
  fontSize: {
    sm: { $value: '0.875rem' },
    base: { $value: '1rem' },
    lg: { $value: '1.125rem' },
  },
  fontFamily: {
    sans: { $value: 'Inter, system-ui, sans-serif' },
    mono: { $value: 'JetBrains Mono, monospace' },
  },
})
\`\`\`

### State Variations
\`\`\`typescript
export const [buttonTokens, buttonVars] = createTokens({
  button: {
    bg: {
      $value: '{blue.500}',
      $compoundSelectors: {
        ':host(:hover)': { $value: '{blue.600}' },
        ':host(:active)': { $value: '{blue.700}' },
        ':host(:disabled)': { $value: '{gray.300}' },
      },
    },
  },
})
\`\`\`

## Output Location

Save extracted patterns to:
\`\`\`
.claude/skills/[skill-name]/references/[pattern-name].md
\`\`\`

## Token Output Template

\`\`\`markdown
# [Token Category Name]

## Overview
Brief description of these tokens.

## Source
- URL: [Source URL if applicable]
- Extracted: [Date]

## Token Definitions

### [Group Name]
\`\`\`typescript
import { createTokens } from 'plaited'

export const [tokenName, varName] = createTokens({
  // Token definitions
})
\`\`\`

## Usage

### In Styles
\`\`\`typescript
import { css } from 'plaited'
import { varName } from './tokens'

const styles = css`
  .element {
    color: ${varName.colorName};
  }
`
\`\`\`

### In Templates
\`\`\`tsx
import { tokenName } from './tokens'

<div stylesheet={tokenName}>
  Content styled with tokens
</div>
\`\`\`

## Notes
- Design decisions
- Accessibility considerations
- Browser compatibility notes
\`\`\`

## Adding New Patterns

When you add a new pattern to the \`references/\` directory, tell Claude to re-read the skill:
- "Re-read the [skill-name] skill to see the new pattern"
- Claude will use the Read tool to load the updated content

## Related Skills

- **design-tokens-library** - Reference patterns for createTokens
- **plaited-framework-patterns** - Framework patterns and conventions
- **design-iteration** - Visual feedback workflows
```
