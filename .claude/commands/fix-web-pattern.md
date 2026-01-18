---
description: Fix incorrect Plaited adaptations in web pattern reference files
allowed-tools: Read, Edit, Glob, Grep
---

# Fix Web Pattern

Systematically fix incorrect Plaited adaptations in web pattern reference files.

**Target File:** $ARGUMENTS (e.g., `aria-button-pattern.md`, or `all` for batch processing)

## Instructions

### Step 1: Identify Files

If `$ARGUMENTS` is a specific file:
- Read `.claude/skills/web-patterns/references/$ARGUMENTS`

If `$ARGUMENTS` is `all` or empty:
- Use Glob to list all `*.md` files in `.claude/skills/web-patterns/references/`
- Process each file sequentially

### Step 2: Apply Fixes

For each pattern file, check and fix the following issues:

#### Issue 1: Incorrect `createStyles` Usage

**Wrong:**
```typescript
{...joinStyles(buttonStyles.btn, buttonStyles.primary)}
import { joinStyles } from 'plaited/ui'
```

**Correct:**
```typescript
{...styles.btn}
{...styles.primary}
import { styles } from './button.css.ts'
```

**Rules:**
- Replace `joinStyles(a, b, c)` with multiple spreads: `{...a} {...b} {...c}`
- Styles always imported from separate `*.css.ts` file
- Use `styles` as the import name (not `buttonStyles`)

#### Issue 2: Exported bElements/FunctionalTemplates

**Wrong:**
```typescript
// Defined at top level, implied export
const PrimaryButton: FT<...> = ({ ... }) => (...)

// Or explicit export
export const Accordion = bElement({...})
```

**Correct:**
```typescript
// accordion.stories.tsx
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles } from './accordion.css.ts'

// bElement - defined locally, NOT exported
const Accordion = bElement({
  tag: 'pattern-accordion',
  // ...
})

// Stories - EXPORTED (required for testing/training)
export const defaultAccordion = story({
  intent: 'Describes what this story demonstrates',
  template: () => <Accordion />,
})
```

**Rules:**
- bElements and FunctionalTemplates are defined locally in `*.stories.tsx`
- Only stories are exported
- Show complete file structure in examples

#### Issue 3: Missing `intent` Property

**Wrong:**
```typescript
export const toggleButtonStory = story({
  template: () => <ToggleButton />,
})
```

**Correct:**
```typescript
export const toggleButtonStory = story({
  intent: 'Toggle button with aria-pressed state management',
  template: () => <ToggleButton aria-pressed='false' aria-label='Mute'>Mute</ToggleButton>,
})
```

**Rules:**
- Every story MUST have an `intent: string` property
- Intent describes what the story demonstrates
- This is a hard requirement

#### Issue 4: Missing File Structure

**Wrong:** Showing code snippets without context

**Correct:** Show the complete file structure:

```
pattern/
  accordion.css.ts        # Styles (createStyles) - ALWAYS separate
  accordion.tokens.ts     # Design tokens (optional)
  accordion.stories.tsx   # bElement/FT + stories (imports from css.ts)
```

Then show each file:

```typescript
// accordion.css.ts
import { createStyles } from 'plaited'

export const styles = createStyles({
  accordion: { /* ... */ },
  header: { /* ... */ },
  content: { /* ... */ },
})
```

```typescript
// accordion.stories.tsx
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles } from './accordion.css.ts'

// bElement - defined locally, NOT exported
const Accordion = bElement({
  tag: 'pattern-accordion',
  shadowDom: (
    <div p-target="accordion" {...styles.accordion}>
      {/* ... */}
    </div>
  ),
  bProgram({ $ }) {
    return { /* handlers */ }
  },
})

// Stories - EXPORTED
export const defaultAccordion = story({
  intent: 'Demonstrates basic accordion behavior',
  template: () => <Accordion />,
  play: async ({ findByAttribute, assert, fireEvent }) => {
    // Test assertions
  },
})
```

#### Issue 5: Anti-Patterns

Check for and fix these anti-patterns:

| Anti-Pattern | Fix |
|--------------|-----|
| Dynamically adding `p-trigger` | Use static `p-trigger` in template |
| Reaching into child shadowRoot | Use `emit()` for child→parent communication |
| Redundant keydown for native buttons | Remove - native `<button>` handles Enter/Space |
| Using `.attr()` on non-p-target elements | Add `p-target` attribute first |
| Manual `addEventListener` | Use `p-trigger` attribute |
| `root.querySelector()` | Use `$` with `p-target` |

#### Issue 6: Cross-Skill Links

**Wrong:**
```markdown
See [Form-Associated Elements](../ui-patterns/references/form-associated-elements.md)
```

**Correct:**
```markdown
See **ui-patterns** skill for Form-Associated Elements documentation
```

**Rules:**
- Skills are isolated - no cross-skill path references
- Use skill name references instead

### Step 3: Verify Plaited Integration Section

Ensure the "Plaited Integration" section uses this format:

```markdown
## Plaited Integration

- **Works with Shadow DOM**: [yes/no]
- **Uses bElement built-ins**: [list what's used: $, p-trigger, p-target, emit, trigger, attr]
- **Requires external web API**: [yes/no - if yes, list which APIs]
- **Cleanup required**: [yes/no - if yes for Web APIs like IntersectionObserver]
```

### Step 4: Update Pattern Philosophy Header

If not present, add after the ## Use Cases section:

```markdown
## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles
```

### Step 5: Confirm Changes

After fixing, summarize:
1. Which issues were found and fixed
2. Any issues that couldn't be automatically fixed (need manual review)

## Checklist Summary

Use this checklist for each file:

- [ ] Replace `joinStyles()` with spread syntax `{...styles.x}`
- [ ] Styles imported from `*.css.ts` file
- [ ] bElements/FTs defined locally in stories (not exported)
- [ ] Only stories are exported
- [ ] Every story has `intent` property
- [ ] File structure shown (css.ts, tokens.ts, stories.tsx)
- [ ] No cross-skill path links
- [ ] Anti-patterns removed
- [ ] Plaited Integration section correct
- [ ] Pattern Philosophy section present

## Related Skills

- **web-patterns** - Pattern philosophy and output template
- **ui-patterns** - bElement patterns, CSS-in-JS API
- **standards** - Code conventions
