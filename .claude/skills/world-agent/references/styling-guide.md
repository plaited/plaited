# Styling Guide for Generated Templates

Guide for the World Agent to generate properly styled UI templates using Plaited's CSS-in-JS system.

## Core Principles

1. **Atomic CSS** - `createStyles` generates utility classes with deterministic hashes
2. **Host Styling** - `createHostStyles` for Shadow DOM custom element hosts
3. **Design Tokens** - `createTokens` for type-safe CSS custom properties
4. **CSS Logical Properties** - Always use logical properties (inline/block) instead of physical properties (left/right/top/bottom) for internationalization support (RTL, LTR, vertical writing modes). See exceptions section below.
5. **Style Hoisting** - Child styles bubble up to Shadow DOM boundary
6. **File Separation** - Styles in `*.css.ts`, tokens in `*.tokens.ts`

## File Organization

### For FunctionalTemplate (Simple Elements)

```
element/
  button.css.ts          # Styles (createStyles)
  button.tokens.ts       # Design tokens (optional)
  button.stories.tsx     # FT defined + stories
```

### For bElement (Complex Elements)

```
element/
  toggle-input.css.ts         # Styles + hostStyles
  fills.tokens.ts             # Tokens (optional)
  toggle-input.ts             # bElement definition
  toggle-input.stories.tsx    # Import bElement + stories
```

## createStyles - Atomic CSS

Generates atomic CSS where each property becomes a separate class.

**Always use CSS logical properties** (e.g., `paddingInline`, `marginBlock`, `inlineSize`) instead of physical properties (e.g., `paddingLeft`, `marginTop`, `width`) for proper internationalization support.

```typescript
import { createStyles } from 'plaited/ui'

export const buttonStyles = createStyles({
  btn: {
    paddingBlock: '10px',      // ✅ Logical - works in all writing modes
    paddingInline: '20px',     // ✅ Logical - adapts to RTL/LTR
    backgroundColor: 'blue',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  }
})
```

### Nested Selectors with $default

Use `$default` for base value, other keys for variants:

```typescript
const inputStyles = createStyles({
  field: {
    border: {
      $default: '1px solid gray',
      ':focus': '2px solid blue',
      '[disabled]': '1px solid red',
    },
    backgroundColor: {
      $default: 'white',
      '[disabled]': '#f5f5f5',
    },
    paddingBlock: '0.5rem',
    paddingInline: '0.75rem',
  }
})
```

### Media Queries

```typescript
const gridStyles = createStyles({
  container: {
    display: 'grid',
    gridTemplateColumns: {
      $default: '1fr',
      '@media (min-width: 768px)': 'repeat(2, 1fr)',
      '@media (min-width: 1024px)': 'repeat(3, 1fr)',
    },
  }
})
```

### Pseudo-Elements

```typescript
const decoratedStyles = createStyles({
  badge: {
    position: 'relative',
    '::before': {
      content: '""',
      position: 'absolute',
      insetBlockStart: '0',
      insetInlineStart: '0',
      inlineSize: '4px',
      blockSize: '100%',
      backgroundColor: 'blue',
    }
  }
})
```

## createHostStyles - Shadow DOM Hosts

For styling the custom element's `:host`:

```typescript
import { createHostStyles } from 'plaited/ui'

export const hostStyles = createHostStyles({
  display: 'block',
  paddingBlock: '1rem',
  paddingInline: '1rem',
})
```

### Host with Compound Selectors

```typescript
const hostStyles = createHostStyles({
  backgroundColor: {
    $default: 'white',
    $compoundSelectors: {
      ':hover': 'lightgrey',
      '[disabled]': '#eee',
      '.dark-theme': 'black',
    },
  },
})
// Generates: :host(:hover) { ... }, :host([disabled]) { ... }
```

### Styling Shadow DOM Children from Host State

```typescript
const hostStyles = createHostStyles({
  color: {
    $default: 'black',
    $compoundSelectors: {
      '[disabled]': {
        '.label': 'grey',  // :host([disabled]) .label { color: grey; }
      },
    }
  }
})
```

## Applying Styles

### Spread on Elements

```typescript
import { type FT } from 'plaited/ui'
import { buttonStyles } from './button.css.ts'

const Button: FT = ({ children }) => (
  <button {...buttonStyles.btn}>{children}</button>
)
```

### In bElement

```typescript
import { bElement } from 'plaited/ui'
import { styles, hostStyles } from './toggle-input.css.ts'

export const ToggleInput = bElement({
  tag: 'toggle-input',
  hostStyles,
  shadowDom: (
    <div {...styles.symbol} p-trigger={{ click: 'click' }} />
  ),
  bProgram({ $ }) {
    return {
      click() { /* handler */ }
    }
  }
})
```

## Dynamic Styling

### Use Attributes, Not Class Manipulation

Templates are static once rendered. Change styles via attributes:

```typescript
const styles = createStyles({
  button: {
    backgroundColor: {
      $default: 'gray',
      '[data-variant="primary"]': 'blue',
      '[data-variant="secondary"]': 'green',
    }
  }
})

// In bProgram, toggle attributes
bProgram({ $ }) {
  const btn = $('btn')[0]
  return {
    changeVariant() {
      btn?.attr('data-variant', 'primary')
    }
  }
}
```

## joinStyles - Combining Styles

```typescript
import { createStyles, joinStyles } from 'plaited/ui'

const base = createStyles({ btn: { fontFamily: 'sans-serif' } })
const sizes = createStyles({ 
  large: { 
    paddingBlock: '16px',
    paddingInline: '32px',
  } 
})

const largeButton = joinStyles(base.btn, sizes.large)

const Button = ({ children }) => (
  <button {...largeButton}>{children}</button>
)
```

## CSS Logical Properties

**Always use CSS logical properties for all generated templates.** They ensure proper internationalization support for RTL languages (Arabic, Hebrew) and vertical writing modes (Japanese, Chinese, Korean).

### Why Logical Properties?

- **Writing Direction Independence**: Logical properties adapt automatically to `dir="rtl"` and `dir="ltr"`
- **Vertical Writing Mode Support**: Works correctly in vertical writing modes (`writing-mode: vertical-rl`)
- **Future-Proof**: Aligns with modern CSS standards and internationalization best practices

### Property Usage

**Always use logical properties:**

```typescript
const styles = createStyles({
  container: {
    // ✅ CORRECT - Logical properties
    paddingInline: '1rem',        // Both left/right (LTR) or right/left (RTL)
    paddingBlock: '0.5rem',       // Both top/bottom
    marginInline: 'auto',         // Center horizontally (works in RTL)
    inlineSize: '100%',           // Width (adapts to writing direction)
    blockSize: 'auto',            // Height (adapts to writing mode)
  },
  positioned: {
    position: 'absolute',
    insetBlockStart: '0',         // Top (adapts to vertical mode)
    insetInlineEnd: '0',          // Right in LTR, left in RTL
    insetBlockEnd: '0',           // Bottom (adapts to vertical mode)
    insetInlineStart: '0',        // Left in LTR, right in RTL
  },
  border: {
    borderInlineStart: '2px solid black',  // Left border in LTR, right in RTL
    borderBlockStart: '1px solid gray',    // Top border (adapts to vertical mode)
  },
  radius: {
    borderStartStartRadius: '4px',  // Top-left in LTR, top-right in RTL
    borderStartEndRadius: '4px',    // Top-right in LTR, top-left in RTL
  }
})
```

**Never use physical properties:**

```typescript
// ❌ WRONG - Will break in RTL/vertical modes
const styles = createStyles({
  container: {
    paddingLeft: '1rem',      // Breaks in RTL
    paddingTop: '0.5rem',     // Doesn't adapt to vertical mode
    marginLeft: 'auto',       // Breaks in RTL
    width: '100%',            // Use inlineSize
    height: 'auto',           // Use blockSize
  },
  positioned: {
    position: 'absolute',
    top: '0',                 // Use insetBlockStart
    right: '0',               // Use insetInlineEnd
    bottom: '0',              // Use insetBlockEnd
    left: '0',                // Use insetInlineStart
  }
})
```

### Quick Reference

| Physical Property | Logical Property | Shorthand Option |
|------------------|------------------|------------------|
| `marginLeft` | `marginInlineStart` | `marginInline` (both sides) |
| `marginRight` | `marginInlineEnd` | `marginInline` (both sides) |
| `marginTop` | `marginBlockStart` | `marginBlock` (both sides) |
| `marginBottom` | `marginBlockEnd` | `marginBlock` (both sides) |
| `paddingLeft` | `paddingInlineStart` | `paddingInline` (both sides) |
| `paddingRight` | `paddingInlineEnd` | `paddingInline` (both sides) |
| `paddingTop` | `paddingBlockStart` | `paddingBlock` (both sides) |
| `paddingBottom` | `paddingBlockEnd` | `paddingBlock` (both sides) |
| `borderLeft` | `borderInlineStart` | `borderInline` (both sides) |
| `borderRight` | `borderInlineEnd` | `borderInline` (both sides) |
| `borderTop` | `borderBlockStart` | `borderBlock` (both sides) |
| `borderBottom` | `borderBlockEnd` | `borderBlock` (both sides) |
| `left` | `insetInlineStart` | `insetInline` (both sides) |
| `right` | `insetInlineEnd` | `insetInline` (both sides) |
| `top` | `insetBlockStart` | `insetBlock` (both sides) |
| `bottom` | `insetBlockEnd` | `insetBlock` (both sides) |
| `width` | `inlineSize` | - |
| `height` | `blockSize` | - |
| `minWidth` | `minInlineSize` | - |
| `maxWidth` | `maxInlineSize` | - |
| `minHeight` | `minBlockSize` | - |
| `maxHeight` | `maxBlockSize` | - |
| `borderTopLeftRadius` | `borderStartStartRadius` | - |
| `borderTopRightRadius` | `borderStartEndRadius` | - |
| `borderBottomLeftRadius` | `borderEndStartRadius` | - |
| `borderBottomRightRadius` | `borderEndEndRadius` | - |

**Note:** The `padding` and `margin` shorthand properties (e.g., `padding: 1rem 2rem`) are acceptable for symmetric values, but prefer logical shorthands (`paddingBlock`, `paddingInline`) when you need writing-direction independence.

### Exceptions

Physical properties may be acceptable in specific contexts:

- **Form inputs**: `width: 100%` is acceptable for form inputs that need to fill container width
- **Legacy compatibility**: Physical properties when maintaining legacy code temporarily
- **Non-directional properties**: Properties like `width` and `height` in contexts where writing direction doesn't matter (e.g., fixed-size icons, images)

**General rule**: Use logical properties unless there's a specific reason not to. When in doubt, prefer logical properties.

See [CSS Logical Properties Pattern](../../plaited-web-patterns/references/css-logical-properties-pattern.md) for complete documentation.

## Common Patterns

### Dark Mode

```typescript
const cardStyles = createStyles({
  card: {
    backgroundColor: {
      $default: 'white',
      '@media (prefers-color-scheme: dark)': '#1a1a1a',
    },
    color: {
      $default: 'black',
      '@media (prefers-color-scheme: dark)': 'white',
    }
  }
})
```

### Container Queries

```typescript
const typography = createStyles({
  heading: {
    fontSize: {
      $default: '1.5rem',
      '@container (min-width: 400px)': '2rem',
      '@container (min-width: 600px)': '2.5rem',
    },
  }
})
```

### State-Based Styling with Custom States

For form-associated elements using ElementInternals:

```typescript
const styles = createStyles({
  symbol: {
    backgroundColor: {
      $default: fills.fill.default,
      ':host(:state(checked))': fills.fill.checked,
      ':host(:state(disabled))': fills.fill.disabled,
    },
  }
})
```

## Common Pitfalls

### 1. Nested Selectors Modify SAME Property

```typescript
// WRONG - creates separate property
const styles = createStyles({
  input: {
    border: '1px solid gray',
    '[disabled]': {
      opacity: '0.5',  // This won't work as expected
    }
  }
})

// CORRECT - each property has its own variants
const styles = createStyles({
  input: {
    border: {
      $default: '1px solid gray',
      '[disabled]': '1px solid red',
    },
    opacity: {
      $default: '1',
      '[disabled]': '0.5',
    }
  }
})
```

### 2. Custom Attributes Need data- Prefix

```typescript
// WRONG
<button variant="primary">Click</button>

// CORRECT
<button data-variant="primary">Click</button>
```

### 3. Don't Use String CSS Variables

```typescript
// WRONG - raw CSS variable string
backgroundColor: 'var(--fill)'

// CORRECT - use createTokens
backgroundColor: fills.fill.default  // Token reference
```

### 4. Using Physical Properties Instead of Logical Properties

**Always use CSS logical properties** for generated templates. Physical properties (left/right/top/bottom) break in RTL languages and vertical writing modes. See [Exceptions](#exceptions) above for rare cases where physical properties may be acceptable.

```typescript
// ❌ WRONG - Physical properties don't work in RTL
const styles = createStyles({
  button: {
    marginLeft: '1rem',      // Breaks in RTL
    paddingRight: '0.5rem',   // Breaks in RTL
    borderTop: '1px solid',   // Doesn't adapt to vertical writing
    width: '100px',           // Use inlineSize instead
    height: '50px',           // Use blockSize instead
  }
})

// ✅ CORRECT - Logical properties work everywhere
const styles = createStyles({
  button: {
    marginInlineStart: '1rem',   // Adapts to writing direction
    paddingInlineEnd: '0.5rem',  // Adapts to writing direction
    borderBlockStart: '1px solid', // Adapts to writing mode
    inlineSize: '100px',         // Adapts to writing direction
    blockSize: '50px',           // Adapts to writing mode
  }
})

// ✅ BETTER - Use shorthand when possible
const styles = createStyles({
  button: {
    marginInline: '1rem',        // Both inline sides (start + end)
    paddingBlock: '0.5rem',      // Both block sides (start + end)
    inlineSize: '100px',
    blockSize: '50px',
  }
})
```

**Property Mapping Reference:**

| ❌ Physical (Avoid) | ✅ Logical (Use) |
|------------------------|----------------------|
| `marginLeft` | `marginInlineStart` |
| `marginRight` | `marginInlineEnd` |
| `marginTop` | `marginBlockStart` |
| `marginBottom` | `marginBlockEnd` |
| `paddingLeft` | `paddingInlineStart` |
| `paddingRight` | `paddingInlineEnd` |
| `paddingTop` | `paddingBlockStart` |
| `paddingBottom` | `paddingBlockEnd` |
| `borderLeft` | `borderInlineStart` |
| `borderRight` | `borderInlineEnd` |
| `borderTop` | `borderBlockStart` |
| `borderBottom` | `borderBlockEnd` |
| `left`, `right` (position) | `insetInlineStart`, `insetInlineEnd` |
| `top`, `bottom` (position) | `insetBlockStart`, `insetBlockEnd` |
| `width` | `inlineSize` |
| `height` | `blockSize` |
| `minWidth`, `maxWidth` | `minInlineSize`, `maxInlineSize` |
| `minHeight`, `maxHeight` | `minBlockSize`, `maxBlockSize` |
| `borderTopLeftRadius` | `borderStartStartRadius` |
| `borderTopRightRadius` | `borderStartEndRadius` |
| `borderBottomLeftRadius` | `borderEndStartRadius` |
| `borderBottomRightRadius` | `borderEndEndRadius` |

**Shorthand Options:**

- `marginInline: value` = both inline sides (equivalent to `marginLeft` + `marginRight` in LTR)
- `marginBlock: value` = both block sides (equivalent to `marginTop` + `marginBottom`)
- `paddingInline: value` = both inline sides
- `paddingBlock: value` = both block sides
- `inset: value` = all sides (equivalent to `top: value; right: value; bottom: value; left: value`)
- `insetInline: value` = both inline sides
- `insetBlock: value` = both block sides

## Generation Guidelines

When generating styled templates:

1. **Always create separate `*.css.ts` file** for styles
2. **Use atomic `createStyles`** for template children
3. **Use `createHostStyles`** for bElement host styling
4. **Use `$default` + selectors** for state variations
5. **Use `data-*` attributes** for dynamic styling
6. **Never use string CSS variables** - use `createTokens`
7. **Spread styles with `{...styles.className}`**
8. **Always use CSS logical properties** - Use `paddingInline`/`paddingBlock`, `marginInline`/`marginBlock`, `inlineSize`/`blockSize`, `insetInline`/`insetBlock`, etc. instead of physical properties (`paddingLeft`/`marginTop`/`width`/`left`) for internationalization support (RTL, LTR, vertical writing modes). See exceptions section above.
9. **Prefer logical shorthand** - Use `paddingBlock`, `paddingInline`, `marginBlock`, `marginInline`, `inset` when setting both sides
10. **Use `inlineSize` and `blockSize`** instead of `width` and `height` for sizing
11. **Never use physical direction properties** - Avoid `left`, `right`, `top`, `bottom`, `marginLeft`, `marginRight`, `paddingLeft`, `paddingRight`, `width`, `height`, etc.
