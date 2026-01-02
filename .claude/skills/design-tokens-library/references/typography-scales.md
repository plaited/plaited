# Typography Scales

Patterns for creating typography tokens with `createTokens`.

## Modular Type Scale

Major third (1.25) type scale:

```typescript
import { createTokens } from 'plaited'

export const { fontSize } = createTokens('fontSize', {
  xs: { $value: '0.64rem' },
  sm: { $value: '0.8rem' },
  base: { $value: '1rem' },
  lg: { $value: '1.25rem' },
  xl: { $value: '1.563rem' },
  '2xl': { $value: '1.953rem' },
  '3xl': { $value: '2.441rem' },
})
```

## Line Heights

```typescript
import { createTokens } from 'plaited'

export const { lineHeight } = createTokens('lineHeight', {
  none: { $value: '1' },
  tight: { $value: '1.25' },
  normal: { $value: '1.5' },
  relaxed: { $value: '1.625' },
  loose: { $value: '2' },
})
```

## Font Weights

```typescript
import { createTokens } from 'plaited'

export const { fontWeight } = createTokens('fontWeight', {
  normal: { $value: '400' },
  medium: { $value: '500' },
  semibold: { $value: '600' },
  bold: { $value: '700' },
})
```

## Font Families

```typescript
import { createTokens } from 'plaited'

export const { fontFamily } = createTokens('fontFamily', {
  sans: {
    $value: {
      $function: 'font-family',
      $arguments: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      $csv: true,
    },
  },
  mono: {
    $value: {
      $function: 'font-family',
      $arguments: ['ui-monospace', 'monospace'],
      $csv: true,
    },
  },
})
```

## Responsive Typography

```typescript
import { createTokens } from 'plaited'

export const { heading } = createTokens('heading', {
  h1: {
    $default: { $value: '2rem' },
    $compoundSelectors: {
      '@media (min-width: 768px)': { $value: '3rem' },
    },
  },
})
```

## Usage in Styles

```typescript
import { createStyles } from 'plaited'
import { fontSize } from './font-size.tokens.ts'
import { fontWeight } from './font-weight.tokens.ts'

export const styles = createStyles({
  heading: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
  },
})
```
