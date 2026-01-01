---
description: Create a new web pattern extraction skill for documenting Web API patterns
allowed-tools: Write, Bash, AskUserQuestion
---

# Create Web Pattern Skill

Create a new skill for extracting and documenting Web API patterns with Plaited integration.

**Skill Name:** $ARGUMENTS (default: `web-patterns`)

## Instructions

### Step 1: Get Skill Name
If no skill name provided in $ARGUMENTS, use `web-patterns` as default.

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
2. **Add tools** - Default plus additional tools (user provides comma-separated list, e.g., `mcp__playwright__*`)

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
5. Extract patterns by asking Claude to fetch URLs
6. Patterns will be saved to `references/` directory
7. After adding patterns, ask Claude to re-read the skill to update context

## Skill Template

Create `.claude/skills/[skill-name]/SKILL.md` with this content:

**Frontmatter (if Restricted):**
```yaml
---
name: [skill-name]
description: Extract Web API patterns from articles and adapt them for Plaited. Use when extracting patterns from URLs, analyzing web API documentation, or adapting web APIs to bElement patterns.
allowed-tools: [tool-list]
---
```
Where `[tool-list]` is:
- Default: `WebFetch, Write, Read, Glob`
- Add tools: `WebFetch, Write, Read, Glob, [user-provided-tools]`

**Frontmatter (if Unrestricted):**
```yaml
---
name: [skill-name]
description: Extract Web API patterns from articles and adapt them for Plaited. Use when extracting patterns from URLs, analyzing web API documentation, or adapting web APIs to bElement patterns.
---
```

**Then the skill content:**
```markdown
# [Skill Name Title]

Extract modern HTML and Web API patterns from external sources and adapt them for Plaited's bElement architecture.

## Purpose

This skill activates when:
- Extracting patterns from web articles (web.dev, MDN, etc.)
- Analyzing Web API documentation for Plaited integration
- Adapting web APIs to work with bElement
- Creating new web pattern documentation

## Pattern Extraction

### Target Patterns

- Modern HTML features (dialog, popover, invokers, command pattern)
- Web APIs (Intersection Observer, Resize Observer, View Transitions)
- Performance optimizations (preconnect, fetchpriority, priority hints)
- Accessibility improvements (ARIA patterns, semantic HTML)
- Shadow DOM compatible patterns

### Extraction Workflow

1. Fetch URL with WebFetch tool
2. Identify patterns matching target criteria
3. Apply framework-first adaptation (see below)
4. Format using output template
5. Save to references/ directory

## Framework-First Adaptation

**CRITICAL**: Check what bElement already provides BEFORE reaching for web APIs.

### What bElement Provides

**BProgramArgs** (available in bProgram callback):
- \`$\` - Shadow DOM query selector with p-target matching
- \`root\` - ShadowRoot reference
- \`host\` - Custom element instance
- \`internals\` - ElementInternals API
- \`trigger\` - Internal event dispatcher
- \`emit\` - Cross-element event dispatcher

**Automatic Systems**:
- **p-trigger**: Declarative event binding with automatic delegation
- **p-target**: Helper methods (render, insert, replace, attr)
- **Shadow DOM**: Automatic via shadowDom parameter
- **Lifecycle**: Callback handlers (onConnected, onDisconnected, etc.)
- **Form Association**: formAssociated: true enables ElementInternals

**Before using ANY web API, ask:**
1. Does BProgramArgs already provide this?
2. Can p-trigger handle this event?
3. Can p-target + helper methods do this?
4. Is this a lifecycle event?

### Adaptation Reference

| Need | bElement Provides | Don't Use |
|------|-------------------|-----------|
| Query Shadow DOM | \`$\` with p-target | root.querySelector() |
| Event listening | p-trigger attribute | addEventListener() |
| DOM manipulation | Helper methods | Direct DOM APIs |
| Shadow root | \`root\` in BProgramArgs | this.shadowRoot |
| Element instance | \`host\` in BProgramArgs | this |
| ElementInternals | \`internals\` in BProgramArgs | this.attachInternals() |
| Lifecycle | Callback handlers | Raw Custom Element methods |

### Web API Integration (when not in bElement)

\`\`\`typescript
// Always cleanup web APIs in onDisconnected
bProgram({ host }) {
  let observer: IntersectionObserver | undefined

  return {
    onConnected() {
      observer = new IntersectionObserver((entries) => {
        // Handle intersection
      })
      observer.observe(host)
    },
    onDisconnected() {
      observer?.disconnect()  // Required cleanup
      observer = undefined
    }
  }
}
\`\`\`

## Output Location

Save extracted patterns to:
\`\`\`
.claude/skills/[skill-name]/references/[pattern-name].md
\`\`\`

## Pattern Output Template

\`\`\`markdown
# [Pattern Name]

## Overview
Brief description of what this pattern does.

## Use Cases
- When to use this pattern
- Common scenarios

## Implementation

### Vanilla JavaScript
// Standard web API usage

### Plaited Adaptation
import { bElement } from 'plaited'

export const Example = bElement({
  tag: 'example-element',
  shadowDom: (
    // Template with p-trigger and p-target
  ),
  bProgram({ $, host }) {
    return {
      onConnected() {
        // Setup if web API needed
      },
      onDisconnected() {
        // Cleanup required for web APIs
      }
    }
  }
})

## Plaited Integration
- Works with Shadow DOM: [yes/no]
- Uses bElement built-ins: [list]
- Requires external web API: [yes/no]
- Cleanup required: [yes/no]

## Browser Compatibility
| Browser | Support |
|---------|---------|
| Chrome | X.X+ |
| Firefox | X.X+ |
| Safari | X.X+ |

## Accessibility
- ARIA considerations
- Keyboard navigation
- Screen reader support

## References
- Source: [Article URL]
- MDN: [MDN link]
\`\`\`

## Adding New Patterns

When you add a new pattern to the `references/` directory, tell Claude to re-read the skill:
- "Re-read the [skill-name] skill to see the new pattern"
- Claude will use the Read tool to load the updated content

## Related Skills
- plaited-framework-patterns - Framework patterns and conventions
- typescript-lsp - Type verification for bElement APIs
```
