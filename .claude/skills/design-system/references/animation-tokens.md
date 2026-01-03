# Animation Tokens

Patterns for creating animation tokens with `createTokens` and `createKeyframes`.

## Duration Tokens

```typescript
import { createTokens } from 'plaited/ui'

export const { duration } = createTokens('duration', {
  fast: { $value: '100ms' },
  normal: { $value: '200ms' },
  slow: { $value: '300ms' },
})
```

## Easing Tokens

```typescript
import { createTokens } from 'plaited/ui'

export const { easing } = createTokens('easing', {
  linear: { $value: 'linear' },
  ease: { $value: 'ease' },
  easeIn: { $value: 'ease-in' },
  easeOut: { $value: 'ease-out' },
  smooth: { $value: 'cubic-bezier(0.4, 0, 0.2, 1)' },
})
```

## Keyframe Animations

```typescript
import { createKeyframes, createHostStyles, joinStyles } from 'plaited/ui'

export const { fadeIn } = createKeyframes('fadeIn', {
  from: { opacity: '0' },
  to: { opacity: '1' },
})

export const { pulse } = createKeyframes('pulse', {
  '0%': { transform: 'scale(1)' },
  '50%': { transform: 'scale(1.05)' },
  '100%': { transform: 'scale(1)' },
})

// Use in hostStyles
export const hostStyles = joinStyles(
  createHostStyles({
    animation: `${fadeIn.id} 0.3s ease-in`,
  }),
  fadeIn()  // Include keyframe CSS
)
```

## Reduced Motion Support

Use scales for motion preferences:

```typescript
import { createTokens } from 'plaited/ui'

export const { motion } = createTokens('motion', {
  duration: {
    normal: { $value: '200ms' },
    reduced: { $value: '0ms' },
  },
})
```

**Usage with media queries in styles:**
```typescript
import { createStyles, joinStyles } from 'plaited/ui'
import { motion } from './motion.tokens.ts'

export const styles = createStyles({
  animated: {
    transitionDuration: {
      $default: motion.duration.normal,
      '@media (prefers-reduced-motion: reduce)': motion.duration.reduced,
    },
  }
})
```

## Usage in Styles

```typescript
import { createStyles } from 'plaited/ui'
import { duration } from './duration.tokens.ts'
import { easing } from './easing.tokens.ts'

export const styles = createStyles({
  button: {
    transition: `all ${duration.normal()} ${easing.smooth()}`,
  },
})
```
