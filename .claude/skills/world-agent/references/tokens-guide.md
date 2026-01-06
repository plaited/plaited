# Design Tokens Guide for Generated Templates

Guide for the World Agent to generate properly tokenized UI templates using Plaited's design token system.

## Core Concepts

Design tokens are CSS custom properties with type-safe references:

```typescript
import { createTokens } from 'plaited/ui'

export const { theme } = createTokens('theme', {
  primary: { $value: '#007bff' },
  spacing: { $value: '16px' },
})
// Generates: --theme-primary: #007bff; --theme-spacing: 16px;
```

## File Organization

**Always create separate `*.tokens.ts` files:**

```
element/
  theme.tokens.ts         # Global design tokens
  fills.tokens.ts         # Color fills for states
  spacing.tokens.ts       # Spacing scale
  toggle-input.css.ts     # Imports tokens
  toggle-input.ts         # bElement
```

## Token Types

### Simple Tokens

```typescript
export const { theme } = createTokens('theme', {
  primary: { $value: '#007bff' },
  secondary: { $value: '#6c757d' },
  spacing: { $value: '16px' },
  fontSize: { $value: '1rem' },
  borderRadius: { $value: '4px' },
})
```

### Token Scales (State Variations)

Use nested objects for related values (one level deep):

```typescript
export const { fills } = createTokens('fills', {
  fill: {
    default: { $value: 'lightblue' },
    checked: { $value: 'blue' },
    disabled: { $value: 'gray' },
    hover: { $value: 'darkblue' },
  },
})
// Access: fills.fill.default, fills.fill.checked, etc.
```

### Array Values

```typescript
export const { shadows } = createTokens('shadows', {
  box: {
    $value: ['0 2px 4px', 'rgba(0,0,0,0.1)'],
    $csv: false,  // Space-separated (default)
  },
  gradient: {
    $value: ['linear-gradient(to right', 'red', 'blue)'],
    $csv: true,   // Comma-separated
  },
})
```

### Function Values

```typescript
export const { transforms } = createTokens('transforms', {
  scale: {
    $value: {
      $function: 'scale',
      $arguments: [1.1],
    },
  },
  translate: {
    $value: {
      $function: 'translateX',
      $arguments: ['10px'],
    },
  },
})
```

### Token References

Tokens can reference other tokens:

```typescript
const { base } = createTokens('base', {
  blue: { $value: '#007bff' },
})

const { semantic } = createTokens('semantic', {
  primary: { $value: base.blue },  // References base.blue
  action: { $value: base.blue },
})
```

## Using Tokens in Styles

### In createStyles

**Pass token reference directly (don't invoke):**

```typescript
import { createStyles } from 'plaited/ui'
import { theme } from './theme.tokens.ts'
import { fills } from './fills.tokens.ts'

export const buttonStyles = createStyles({
  btn: {
    backgroundColor: theme.primary,     // Correct - reference
    padding: theme.spacing,
    fontSize: theme.fontSize,
  }
})

// With state variations
export const toggleStyles = createStyles({
  symbol: {
    backgroundColor: {
      $default: fills.fill.default,
      ':host(:state(checked))': fills.fill.checked,
      ':host(:state(disabled))': fills.fill.disabled,
    },
  }
})
```

### In createHostStyles with joinStyles

When using tokens in hostStyles, use `joinStyles` to include token CSS variable definitions:

```typescript
import { createHostStyles, joinStyles } from 'plaited/ui'
import { fills } from './fills.tokens.ts'
import { theme } from './theme.tokens.ts'

export const hostStyles = joinStyles(
  // Include each token reference you use
  fills.fill.default,
  fills.fill.checked,
  fills.fill.disabled,
  // Then add host styles
  createHostStyles({
    display: 'inline-grid',
    padding: theme.spacing,
  })
)
```

### Getting CSS Variable String

Only invoke `token()` when you need the raw CSS variable string:

```typescript
// For programmatic access
console.log(theme.primary())  // 'var(--theme-primary)'

// For inline styles (rare)
element.style.setProperty('color', theme.primary())
```

## Common Token Patterns

### Color System

```typescript
// colors.tokens.ts
export const { colors } = createTokens('colors', {
  // Primitives
  blue: {
    100: { $value: '#e6f0ff' },
    500: { $value: '#007bff' },
    900: { $value: '#003366' },
  },
  gray: {
    100: { $value: '#f5f5f5' },
    500: { $value: '#808080' },
    900: { $value: '#1a1a1a' },
  },
})

// semantic.tokens.ts
import { colors } from './colors.tokens.ts'

export const { semantic } = createTokens('semantic', {
  primary: { $value: colors.blue[500] },
  background: { $value: colors.gray[100] },
  text: { $value: colors.gray[900] },
})
```

### Spacing Scale

```typescript
// spacing.tokens.ts
export const { spacing } = createTokens('spacing', {
  xs: { $value: '4px' },
  sm: { $value: '8px' },
  md: { $value: '16px' },
  lg: { $value: '24px' },
  xl: { $value: '32px' },
  '2xl': { $value: '48px' },
})
```

### Typography

```typescript
// typography.tokens.ts
export const { typography } = createTokens('typography', {
  fontFamily: {
    sans: { $value: 'system-ui, sans-serif' },
    mono: { $value: 'ui-monospace, monospace' },
  },
  fontSize: {
    sm: { $value: '0.875rem' },
    base: { $value: '1rem' },
    lg: { $value: '1.125rem' },
    xl: { $value: '1.5rem' },
  },
  lineHeight: {
    tight: { $value: '1.25' },
    normal: { $value: '1.5' },
    relaxed: { $value: '1.75' },
  },
})
```

### Animation Tokens

```typescript
// animation.tokens.ts
export const { animation } = createTokens('animation', {
  duration: {
    fast: { $value: '150ms' },
    normal: { $value: '300ms' },
    slow: { $value: '500ms' },
  },
  easing: {
    ease: { $value: 'ease' },
    easeIn: { $value: 'ease-in' },
    easeOut: { $value: 'ease-out' },
    easeInOut: { $value: 'ease-in-out' },
  },
})
```

### State Colors for Form Elements

```typescript
// fills.tokens.ts
export const { fills } = createTokens('fills', {
  fill: {
    default: { $value: '#e0e0e0' },
    hover: { $value: '#d0d0d0' },
    active: { $value: '#c0c0c0' },
    checked: { $value: '#007bff' },
    disabled: { $value: '#f5f5f5' },
    error: { $value: '#dc3545' },
  },
  border: {
    default: { $value: '#cccccc' },
    focus: { $value: '#007bff' },
    error: { $value: '#dc3545' },
  },
})
```

## Using with Keyframes

```typescript
import { createKeyframes, createHostStyles, joinStyles } from 'plaited/ui'
import { colors } from './colors.tokens.ts'

const { pulse } = createKeyframes('pulse', {
  '0%': {
    transform: 'scale(1)',
    backgroundColor: colors.blue[500],  // Token reference
  },
  '50%': {
    transform: 'scale(1.05)',
    backgroundColor: colors.blue[900],
  },
  '100%': {
    transform: 'scale(1)',
    backgroundColor: colors.blue[500],
  },
})

export const hostStyles = joinStyles(
  createHostStyles({
    animation: `${pulse.id} 2s infinite`,
  }),
  pulse()  // Include keyframe styles
)
```

## Complete Example

### File: fills.tokens.ts

```typescript
import { createTokens } from 'plaited/ui'

export const { fills } = createTokens('fills', {
  fill: {
    default: { $value: 'lightblue' },
    checked: { $value: 'blue' },
    disabled: { $value: 'gray' },
  },
})
```

### File: toggle-input.css.ts

```typescript
import { createStyles, createHostStyles, joinStyles } from 'plaited/ui'
import { fills } from './fills.tokens.ts'

export const styles = createStyles({
  symbol: {
    height: '16px',
    width: '16px',
    borderRadius: '50%',
    backgroundColor: {
      $default: fills.fill.default,
      ':host(:state(checked))': fills.fill.checked,
      ':host(:state(disabled))': fills.fill.disabled,
    },
  }
})

export const hostStyles = joinStyles(
  fills.fill.default,
  fills.fill.checked,
  fills.fill.disabled,
  createHostStyles({
    display: 'inline-grid',
    cursor: 'pointer',
  })
)
```

### File: toggle-input.ts

```typescript
import { bElement } from 'plaited/ui'
import { styles, hostStyles } from './toggle-input.css.ts'

export const ToggleInput = bElement({
  tag: 'toggle-input',
  formAssociated: true,
  hostStyles,
  shadowDom: (
    <div
      p-target="symbol"
      {...styles.symbol}
      p-trigger={{ click: 'click' }}
    />
  ),
  bProgram({ trigger, internals }) {
    return {
      click() {
        const checked = !internals.states.has('checked')
        trigger({ type: 'checked', detail: checked })
      },
      checked(isChecked: boolean) {
        if (isChecked) {
          internals.states.add('checked')
        } else {
          internals.states.delete('checked')
        }
      }
    }
  },
})
```

## Common Pitfalls

### 1. Don't Invoke Tokens as CSS Values

```typescript
// WRONG
backgroundColor: theme.primary()  // Don't invoke

// CORRECT
backgroundColor: theme.primary    // Pass reference
```

### 2. Never Use Raw CSS Variable Strings

```typescript
// WRONG
backgroundColor: 'var(--theme-primary)'

// CORRECT
backgroundColor: theme.primary
```

### 3. Include Token References in joinStyles

```typescript
// WRONG - tokens won't be defined
export const hostStyles = createHostStyles({
  backgroundColor: fills.fill.default,
})

// CORRECT - include token references
export const hostStyles = joinStyles(
  fills.fill.default,  // Includes CSS variable definition
  createHostStyles({
    backgroundColor: fills.fill.default,
  })
)
```

### 4. Scales Are One Level Deep

```typescript
// WRONG - too deeply nested
const { deep } = createTokens('deep', {
  colors: {
    primary: {
      light: { $value: '#...' },  // Too deep
    }
  }
})

// CORRECT - one level of nesting
const { colors } = createTokens('colors', {
  primary: {
    light: { $value: '#...' },
    dark: { $value: '#...' },
  }
})
```

## Generation Guidelines

When generating tokenized templates:

1. **Create `*.tokens.ts` files** for design tokens
2. **Use scales** for related values (states, sizes)
3. **Pass token references directly** - don't invoke
4. **Use `joinStyles`** when tokens are used in hostStyles
5. **Reference other tokens** for semantic relationships
6. **Never use raw CSS variable strings**
7. **Keep scales one level deep**
