# Generation Workflow

Step-by-step process for generating new behavioral elements.

## Phase 1: Requirements Analysis

Before generating code:

1. **Understand the request** - What element is needed?
2. **Identify similar elements** - What existing elements are similar?
3. **List required features** - Form-associated? States? Events?
4. **Determine file structure** - Separate tokens? Styles?

## Phase 2: Pattern Discovery

Use code-query to find patterns:

```bash
# Find similar elements
bun query-stories.ts src/ | grep -i "toggle\|input\|button"

# Read existing implementations
cat src/components/toggle-input/toggle-input.ts
```

Document what you find:
- Token patterns used
- Style organization
- Event handling patterns
- State management approach

## Phase 3: Design Decisions

Before generating, decide:

| Decision | Options |
|----------|---------|
| File organization | Separate files vs single file |
| Token strategy | Reuse existing vs new tokens |
| Style approach | Extend existing vs new styles |
| Form association | formAssociated: true/false |
| States needed | checked, disabled, focused, etc. |

## Phase 4: File Generation

Generate files in order:

### 1. Tokens (if needed)

```typescript
// new-element.tokens.ts
import { createTokens } from 'plaited/ui'

export const { newElementTokens } = createTokens('newElementTokens', {
  fill: {
    default: { $value: 'lightblue' },
    active: { $value: 'blue' },
  },
})
```

### 2. Styles

```typescript
// new-element.css.ts
import { createStyles, createHostStyles, joinStyles } from 'plaited/ui'
import { newElementTokens } from './new-element.tokens.ts'

export const styles = createStyles({
  root: {
    backgroundColor: {
      $default: newElementTokens.fill.default,
      ':host(:state(active))': newElementTokens.fill.active,
    },
  }
})

export const hostStyles = joinStyles(
  newElementTokens.fill.default,
  newElementTokens.fill.active,
  createHostStyles({ display: 'inline-block' })
)
```

### 3. Element

```typescript
// new-element.ts
import { bElement } from 'plaited/ui'
import { styles, hostStyles } from './new-element.css.ts'

export const NewElement = bElement({
  tag: 'new-element',
  hostStyles,
  shadowDom: (
    <div p-target="root" {...styles.root}>
      <slot />
    </div>
  ),
  bProgram({ trigger }) {
    return {
      // Event handlers
    }
  }
})
```

### 4. Stories

```typescript
// new-element.stories.tsx
import { story } from 'plaited/testing'
import { NewElement } from './new-element.ts'

export const basicNewElement = story({
  description: 'Basic new element',
  render: () => <NewElement>Content</NewElement>,
  async play({ findByAttribute, assert }) {
    // Test assertions
  }
})
```

## Phase 5: Validation

After generating:

1. **Type check** - Run `bun run check`
2. **Visual test** - Run story with `bun plaited dev`
3. **Pattern consistency** - Compare with existing elements
4. **Accessibility** - Add axe-core tests in play function

## Checklist

Before completing generation:

- [ ] Tokens follow project namespace convention
- [ ] Styles use project patterns (separate files, joinStyles)
- [ ] Element tag is kebab-case
- [ ] Export name is PascalCase
- [ ] Story has description and play function
- [ ] Types pass validation
- [ ] Follows project file organization
