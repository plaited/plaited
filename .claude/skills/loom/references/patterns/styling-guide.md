# Styling Guide for Generated Templates

Guide for the World Agent to generate properly styled UI templates using Plaited's CSS-in-JS system.

## Core Principles

1. **Atomic CSS** - `createStyles` generates utility classes with deterministic hashes
2. **Host Styling** - `createHostStyles` for Shadow DOM custom element hosts
3. **Design Tokens** - `createTokens` for type-safe CSS custom properties
4. **Style Hoisting** - Child styles bubble up to Shadow DOM boundary
5. **File Separation** - Styles in `*.css.ts`, tokens in `*.tokens.ts`

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

Generates atomic CSS where each property becomes a separate class:

```typescript
import { createStyles } from 'plaited/ui'

export const buttonStyles = createStyles({
  btn: {
    padding: '10px 20px',
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
    }
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
      top: '0',
      left: '0',
      width: '4px',
      height: '100%',
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
  padding: '1rem',
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
const sizes = createStyles({ large: { padding: '16px 32px' } })

const largeButton = joinStyles(base.btn, sizes.large)

const Button = ({ children }) => (
  <button {...largeButton}>{children}</button>
)
```

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

## Generation Guidelines

When generating styled templates:

1. **Always create separate `*.css.ts` file** for styles
2. **Use atomic `createStyles`** for template children
3. **Use `createHostStyles`** for bElement host styling
4. **Use `$default` + selectors** for state variations
5. **Use `data-*` attributes** for dynamic styling
6. **Never use string CSS variables** - use `createTokens`
7. **Spread styles with `{...styles.className}`**
