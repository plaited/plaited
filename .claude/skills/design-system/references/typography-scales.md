# Typography Scales

Patterns for creating typography tokens with `createTokens`.

## Modular Type Scale

Major third (1.25) type scale:

```typescript
import { createTokens } from 'plaited/ui'

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
import { createTokens } from 'plaited/ui'

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
import { createTokens } from 'plaited/ui'

export const { fontWeight } = createTokens('fontWeight', {
  normal: { $value: '400' },
  medium: { $value: '500' },
  semibold: { $value: '600' },
  bold: { $value: '700' },
})
```

## Font Families

```typescript
import { createTokens } from 'plaited/ui'

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

Use scales for breakpoint-based typography:

```typescript
import { createTokens } from 'plaited/ui'

export const { heading } = createTokens('heading', {
  h1: {
    base: { $value: '2rem' },
    md: { $value: '2.5rem' },
    lg: { $value: '3rem' },
  },
})
```

**Usage with media queries in styles:**
```typescript
import { createStyles, joinStyles } from 'plaited/ui'
import { heading } from './heading.tokens.ts'

export const styles = createStyles({
  title: {
    fontSize: {
      $default: heading.h1.base,
      '@media (min-width: 768px)': heading.h1.md,
      '@media (min-width: 1024px)': heading.h1.lg,
    },
  }
})
```

## Usage in Styles

```typescript
import { createStyles } from 'plaited/ui'
import { fontSize } from './font-size.tokens.ts'
import { fontWeight } from './font-weight.tokens.ts'

export const styles = createStyles({
  heading: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
  },
})
```
