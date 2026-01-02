# Color Systems

Patterns for creating color tokens with `createTokens`.

## Brand Colors

Basic color palette tokens:

```typescript
import { createTokens } from 'plaited'

export const { colors } = createTokens('colors', {
  primary: { $value: '#007bff' },
  secondary: { $value: '#6c757d' },
  accent: { $value: '#ff6b6b' },
  success: { $value: '#28a745' },
  warning: { $value: '#ffc107' },
  error: { $value: '#dc3545' },
})
```

## Surface Color Scales

Surface tokens with light/dark variations using scales:

```typescript
import { createTokens } from 'plaited'

export const { surfaces } = createTokens('surfaces', {
  background: {
    light: { $value: '#ffffff' },
    dark: { $value: '#1a1a1a' },
  },
  foreground: {
    light: { $value: '#1a1a1a' },
    dark: { $value: '#ffffff' },
  },
})
```

**Usage with media queries in styles:**
```typescript
import { createHostStyles, joinStyles } from 'plaited'
import { surfaces } from './surfaces.tokens.ts'

export const hostStyles = joinStyles(
  surfaces.background.light,
  surfaces.background.dark,
  createHostStyles({
    backgroundColor: {
      $default: surfaces.background.light,
      '@media (prefers-color-scheme: dark)': surfaces.background.dark,
    },
  })
)
```

## Interactive State Colors

Fills with state-based variations using scales:

```typescript
import { createTokens } from 'plaited'

export const { fills } = createTokens('fills', {
  fill: {
    default: { $value: 'lightblue' },
    checked: { $value: 'blue' },
    disabled: { $value: 'gray' },
    hover: { $value: 'skyblue' },
  },
})
```

**Usage with state selectors in styles:**
```typescript
import { createStyles, createHostStyles, joinStyles } from 'plaited'
import { fills } from './fills.tokens.ts'

export const styles = createStyles({
  button: {
    backgroundColor: {
      $default: fills.fill.default,
      ':hover': fills.fill.hover,
      ':host(:state(checked))': fills.fill.checked,
      ':host(:state(disabled))': fills.fill.disabled,
    },
  }
})

export const hostStyles = joinStyles(
  fills.fill.default,
  fills.fill.checked,
  fills.fill.disabled,
  fills.fill.hover,
  createHostStyles({ display: 'inline-flex' })
)
```

## Stroke Color Scales

Border and outline tokens with state variations:

```typescript
import { createTokens } from 'plaited'

export const { strokes } = createTokens('strokes', {
  border: {
    default: { $value: '#e0e0e0' },
    focused: { $value: '#007bff' },
    error: { $value: '#dc3545' },
    disabled: { $value: '#cccccc' },
  },
})
```

## Color Scale (Shades)

For color palettes with numeric scales, use scale nesting:

```typescript
import { createTokens } from 'plaited'

export const { gray } = createTokens('gray', {
  shade: {
    50: { $value: '#fafafa' },
    100: { $value: '#f5f5f5' },
    200: { $value: '#eeeeee' },
    300: { $value: '#e0e0e0' },
    400: { $value: '#bdbdbd' },
    500: { $value: '#9e9e9e' },
    600: { $value: '#757575' },
    700: { $value: '#616161' },
    800: { $value: '#424242' },
    900: { $value: '#212121' },
  },
})
// Access: gray.shade[50], gray.shade[100], etc.
```

Or for simpler access, use flat tokens:

```typescript
export const { gray } = createTokens('gray', {
  50: { $value: '#fafafa' },
  100: { $value: '#f5f5f5' },
  200: { $value: '#eeeeee' },
  // ... etc
})
// Access: gray[50], gray[100], etc.
```
