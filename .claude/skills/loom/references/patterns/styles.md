# Styles

> createStyles and CSS-in-JS patterns for AI-assisted design

## Overview

Plaited uses `createStyles` for atomic CSS-in-JS styling. Styles are defined once and spread into templates, enabling consistent design and efficient CSS generation.

## Core Pattern

```typescript
import { createStyles } from 'plaited/ui'

const styles = createStyles({
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 16px',
    borderRadius: '4px',
  },
  primary: {
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-on-primary)',
  },
})

// Usage in template
const Button = ({ variant = 'primary' }) => (
  <button {...styles.btn} {...styles[variant]}>
    Click me
  </button>
)
```

## Static Analysis Rules

The world agent's Tier 1 static analysis checks these patterns:

| Rule | Valid | Invalid |
|------|-------|---------|
| Use createStyles | `{...styles.btn}` | `style={{ padding: '8px' }}` |
| Token references | `tokens.primary` | `tokens.primary()` (don't invoke) |
| Host styles | `createHostStyles` for `:host` | `:host` in createStyles |
| No hardcoded colors | `var(--color-primary)` | `#3366ff` |

## Host Styles

For custom element host styling, use `createHostStyles`:

```typescript
import { createHostStyles } from 'plaited/ui'

const hostStyles = createHostStyles({
  ':host': {
    display: 'block',
    position: 'relative',
  },
  ':host([hidden])': {
    display: 'none',
  },
})
```

## Composing Styles

Spread multiple style rules for composition:

```typescript
// Base + variant + state
<button {...styles.btn} {...styles.primary} {...styles.loading}>
```

## Integration with Tokens

Always use tokens for design values:

```typescript
import { tokens } from './design.tokens.ts'

const styles = createStyles({
  card: {
    backgroundColor: tokens.surface,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacingMd,
  },
})
```

## For Training

When generating styles for training:

1. **Always use createStyles** - Never inline styles
2. **Reference tokens** - No hardcoded values
3. **Spread syntax** - `{...styles.name}` pattern
4. **Semantic names** - Describe purpose, not appearance

See [tokens.md](./tokens.md) for token system patterns.
