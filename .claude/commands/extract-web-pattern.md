---
description: Extract Web API patterns from URLs or pasted content into your project's pattern skill
allowed-tools: WebFetch, Write, Read, Glob, AskUserQuestion, Bash
---

# Extract Web Pattern

Extract modern HTML and Web API patterns from external sources and save them to your project's pattern skill.

**Pattern Name:** $ARGUMENTS (optional - e.g., `dialog-element`, `view-transitions`)

## Instructions

### Step 1: Find or Create Pattern Skill

Search for an existing web patterns skill in the user's project:

1. Use Glob to find `**/SKILL.md` files (exclude node_modules)
2. Look for skills with "pattern" or "web-pattern" in the name/description
3. **If found**: Use that skill's references directory
4. **If not found**: Create one (see "Creating Pattern Skill" below)

### Step 2: Get Source Content

If pattern name provided in $ARGUMENTS, proceed to extraction.

Use AskUserQuestion to ask:

**Question:** "How would you like to provide the pattern source?"

**Options:**
1. **Fetch from URL** - Provide a URL to fetch (web.dev, MDN, blog post, etc.)
2. **Paste content** - Paste article content directly

**If URL:** Use WebFetch to retrieve the content
**If Paste:** Ask user to paste the content in their next message

### Step 3: Extract Pattern

From the source content, extract:
1. **Overview** - What the pattern does
2. **Use cases** - When to use it
3. **Implementation** - Code examples (vanilla + Plaited adaptation)
4. **Browser compatibility** - Support table
5. **Accessibility** - ARIA and keyboard considerations

### Step 4: Apply Plaited Adaptation

Transform vanilla JavaScript examples to Plaited patterns:

**Check bElement built-ins first:**
| Need | bElement Provides | Don't Use |
|------|-------------------|-----------|
| Query Shadow DOM | `$` with p-target | root.querySelector() |
| Event listening | p-trigger attribute | addEventListener() |
| DOM manipulation | Helper methods | Direct DOM APIs |
| Shadow root | `root` in BProgramArgs | this.shadowRoot |
| Element instance | `host` in BProgramArgs | this |
| ElementInternals | `internals` in BProgramArgs | this.attachInternals() |

**Web API cleanup pattern:**
```typescript
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
```

### Step 5: Save Pattern

Write the extracted pattern using the output template below to:
```
[skill-path]/references/[pattern-name].md
```

### Step 6: Confirm

Tell the user:
1. Pattern saved to `[path]/references/[pattern-name].md`
2. Run `/validate-skill` to verify skill structure
3. Re-read the skill to include the new pattern in context

---

## Creating Pattern Skill

If no pattern skill exists, create one:

### 1. Ask for skill name

Use AskUserQuestion:
- "What should your pattern skill be named?"
- Options: `web-patterns` (default), `my-patterns`, custom name

### 2. Create skill structure

Create the following files:

**`[project]/.claude/skills/[skill-name]/SKILL.md`:**
```markdown
---
name: [skill-name]
description: Web API patterns adapted for Plaited bElement architecture. Use when implementing modern HTML features, Web APIs, or accessibility patterns.
license: ISC
compatibility: Requires bun
allowed-tools: WebFetch, Write, Read, Glob
---

# [Skill Name]

Extract and document modern HTML and Web API patterns with Plaited integration.

## Purpose

This skill activates when:
- Implementing modern HTML features (dialog, popover, invokers)
- Using Web APIs (Intersection Observer, View Transitions)
- Applying performance optimizations
- Building accessible patterns

## Pattern Library

Patterns are stored in the `references/` directory. Each pattern includes:
- Vanilla JavaScript implementation
- Plaited bElement adaptation
- Browser compatibility
- Accessibility considerations

## Adding Patterns

Use the `/extract-web-pattern` command to add new patterns:
```
/extract-web-pattern [pattern-name]
```

Or ask Claude to fetch a URL and extract patterns.

## Related Skills
- plaited-ui-patterns - bElement patterns and styling
- plaited-standards - Code conventions
- typescript-lsp@plaited_development-skills - Type verification
```

**`[project]/.claude/skills/[skill-name]/references/.gitkeep`:** Empty file

### 3. Validate

Run `/validate-skill` to verify the skill structure.

### 4. Inform user

Tell the user:
1. Skill created at `[path]`
2. **Restart Claude Code** to activate: close and reopen, or `claude -r`
3. Then run `/extract-web-pattern [pattern-name]` to add patterns

---

## Output Template

```markdown
# [Pattern Name]

## Overview
Brief description of what this pattern does.

## Use Cases
- When to use this pattern
- Common scenarios

## Implementation

### Vanilla JavaScript
```javascript
// Standard web API usage from source
```

### Plaited Adaptation
```typescript
import { bElement } from 'plaited/ui'

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
```

## Plaited Integration
- Works with Shadow DOM: [yes/no]
- Uses bElement built-ins: [list what's used]
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
- Source: [Article URL or "User provided"]
- MDN: [MDN link if applicable]
```

## Related Skills
- plaited-ui-patterns - bElement patterns and styling
- plaited-standards - Code conventions
- typescript-lsp@plaited_development-skills - Type verification
- validate-skill@plaited_development-skills - Skill validation
