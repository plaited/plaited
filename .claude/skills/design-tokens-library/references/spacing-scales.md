# Spacing Scales

Patterns for creating spacing and sizing tokens with `createTokens`.

## Base Unit Scale (4px)

```typescript
import { createTokens } from 'plaited'

export const spacing = createTokens('spacing', {
  px: { $value: '1px' },
  '0': { $value: '0' },
  '1': { $value: '4px' },
  '2': { $value: '8px' },
  '3': { $value: '12px' },
  '4': { $value: '16px' },
  '6': { $value: '24px' },
  '8': { $value: '32px' },
  '12': { $value: '48px' },
  '16': { $value: '64px' },
})
```

## Semantic Spacing

```typescript
import { createTokens } from 'plaited'

export const space = createTokens('space', {
  none: { $value: '0' },
  xs: { $value: '4px' },
  sm: { $value: '8px' },
  md: { $value: '16px' },
  lg: { $value: '24px' },
  xl: { $value: '32px' },
  '2xl': { $value: '48px' },
})
```

## Component Sizing

```typescript
import { createTokens } from 'plaited'

export const sizes = createTokens('sizes', {
  icon: {
    sm: { $value: '16px' },
    md: { $value: '24px' },
    lg: { $value: '32px' },
  },
  button: {
    sm: { $value: '32px' },
    md: { $value: '40px' },
    lg: { $value: '48px' },
  },
})
```

## Border Radius

```typescript
import { createTokens } from 'plaited'

export const radii = createTokens('radii', {
  none: { $value: '0' },
  sm: { $value: '2px' },
  md: { $value: '4px' },
  lg: { $value: '8px' },
  full: { $value: '9999px' },
})
```

## Usage in Styles

```typescript
import { createStyles } from 'plaited'
import { space } from './spacing.tokens.ts'
import { radii } from './radii.tokens.ts'

export const styles = createStyles({
  card: {
    padding: space.md,
    borderRadius: radii.lg,
    gap: space.sm,
  }
})
```
