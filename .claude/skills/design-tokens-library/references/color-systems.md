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

## Semantic Surface Colors

Surface tokens with state-based variations:

```typescript
import { createTokens } from 'plaited'

export const { surfaces } = createTokens('surfaces', {
  background: {
    $default: { $value: '#ffffff' },
    $compoundSelectors: {
      '@media (prefers-color-scheme: dark)': { $value: '#1a1a1a' },
    },
  },
  foreground: {
    $default: { $value: '#1a1a1a' },
    $compoundSelectors: {
      '@media (prefers-color-scheme: dark)': { $value: '#ffffff' },
    },
  },
})
```

## Interactive State Colors

Fills with custom element states (`:state()`):

```typescript
import { createTokens } from 'plaited'

export const { fills } = createTokens('fills', {
  fill: {
    $default: { $value: 'lightblue' },
    $compoundSelectors: {
      ':state(checked)': { $value: 'blue' },
      ':state(disabled)': { $value: 'gray' },
      ':hover': { $value: 'skyblue' },
    },
  },
})
```

## Stroke Colors

Border and outline tokens:

```typescript
import { createTokens } from 'plaited'

export const { strokes } = createTokens('strokes', {
  border: {
    $default: { $value: '#e0e0e0' },
    $compoundSelectors: {
      ':state(focused)': { $value: '#007bff' },
      ':state(error)': { $value: '#dc3545' },
      '[disabled]': { $value: '#cccccc' },
    },
  },
})
```

## Color Scale (Shades)

```typescript
import { createTokens } from 'plaited'

export const { gray } = createTokens('gray', {
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
})
```

## Usage in Styles

```typescript
import { createStyles, createHostStyles, joinStyles } from 'plaited'
import { fills } from './fills.tokens.ts'

export const styles = createStyles({
  button: {
    backgroundColor: fills.fill,  // Pass reference directly
  }
})

export const hostStyles = joinStyles(
  fills,  // Include token CSS variables
  createHostStyles({ display: 'inline-flex' })
)
```
