# Composition Patterns

How to compose new elements from existing design system pieces.

## Reusing Tokens

Import and use existing project tokens:

```typescript
// Import existing tokens
import { fills } from '../shared/fills.tokens.ts'
import { spacing } from '../shared/spacing.tokens.ts'

// Use in new styles
export const styles = createStyles({
  newElement: {
    backgroundColor: fills.fill,
    padding: spacing.md,
  }
})
```

## Extending Styles

Build on existing style patterns:

```typescript
import { createStyles, joinStyles } from 'plaited/ui'
import { baseButtonStyles } from '../shared/button.css.ts'

// Create variant-specific additions
const variantStyles = createStyles({
  primary: {
    backgroundColor: 'blue',
    color: 'white',
  }
})

// Compose in template
const PrimaryButton: FT = ({ children }) => (
  <button {...joinStyles(baseButtonStyles.btn, variantStyles.primary)}>
    {children}
  </button>
)
```

## Composing bElements

### Pattern: Wrapper Element

Wrap existing elements with additional behavior:

```typescript
import { bElement } from 'plaited/ui'
import { ExistingElement } from '../existing-element.ts'

export const EnhancedElement = bElement({
  tag: 'enhanced-element',
  shadowDom: (
    <div p-target="wrapper">
      <ExistingElement p-target="inner" />
    </div>
  ),
  bProgram({ $ }) {
    const inner = $('inner')[0]
    return {
      enhance() {
        // Add behavior to wrapped element
      }
    }
  }
})
```

### Pattern: Slot Composition

Use slots to accept content from existing elements:

```typescript
export const Container = bElement({
  tag: 'custom-container',
  shadowDom: (
    <div {...styles.container}>
      <slot name="header" />
      <slot />
      <slot name="footer" />
    </div>
  ),
})
```

## Sharing Tokens Across Elements

Create shared token files:

```
src/tokens/
  fills.tokens.ts      # Shared fill colors
  strokes.tokens.ts    # Shared border colors
  spacing.tokens.ts    # Shared spacing scale
  typography.tokens.ts # Shared font tokens
```

Import in element-specific styles:

```typescript
import { fills } from '../../tokens/fills.tokens.ts'
import { spacing } from '../../tokens/spacing.tokens.ts'

export const styles = createStyles({
  element: {
    backgroundColor: fills.surface,
    padding: spacing.md,
  }
})
```

## Convention Matching

When composing new elements, match existing conventions:

| Aspect | Check Existing |
|--------|----------------|
| Tag naming | `toggle-input`, `custom-button` |
| File naming | `*.tokens.ts`, `*.css.ts` |
| Export naming | `styles`, `hostStyles`, `PascalCase` |
| Token namespaces | Consistent naming like `fills`, `strokes` |
| State names | `:state(checked)`, `:state(disabled)` |
