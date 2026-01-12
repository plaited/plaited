# Tokens

> Design token systems for consistent design

## Overview

Design tokens are the single source of truth for design values. Plaited uses `createTokens` to generate CSS custom properties from a token definition.

Token organization follows [Mise en Mode](https://mode.place/) principles—scoping tokens by mode/context with semantic naming that describes purpose, not value.

## Core Pattern

```typescript
import { createTokens } from 'plaited/ui'

export const [tokens, tokenStyles] = createTokens({
  // Colors
  primary: '#3366ff',
  onPrimary: '#ffffff',
  surface: '#f5f5f5',
  onSurface: '#1a1a1a',

  // Spacing
  spacingSm: '4px',
  spacingMd: '8px',
  spacingLg: '16px',

  // Radius
  radiusSm: '2px',
  radiusMd: '4px',
  radiusLg: '8px',
})
```

## Using Tokens

Reference tokens in styles without invoking them:

```typescript
import { createStyles } from 'plaited/ui'
import { tokens } from './design.tokens.ts'

const styles = createStyles({
  card: {
    backgroundColor: tokens.surface,      // ✅ Correct
    color: tokens.onSurface,              // ✅ Correct
    padding: tokens.spacingMd,            // ✅ Correct
    // backgroundColor: tokens.surface(), // ❌ Wrong - don't invoke
    // backgroundColor: '#f5f5f5',        // ❌ Wrong - hardcoded
  },
})
```

## Static Analysis Rules

The world agent's Tier 1 static analysis checks:

| Rule | Catches |
|------|---------|
| Token reference syntax | `tokens.name()` invocations |
| Hardcoded colors | `#hexcode` values |
| Hardcoded pixels | `Npx` without token |

## Token Categories

Organize tokens by purpose:

```typescript
export const [tokens, tokenStyles] = createTokens({
  // Color palette
  colorPrimary: '#3366ff',
  colorSecondary: '#9933ff',
  colorError: '#ff3333',
  colorSuccess: '#33cc33',

  // Semantic colors
  surfaceDefault: '#ffffff',
  surfaceElevated: '#fafafa',
  textPrimary: '#1a1a1a',
  textSecondary: '#666666',

  // Spacing scale
  space1: '4px',
  space2: '8px',
  space3: '12px',
  space4: '16px',
  space6: '24px',
  space8: '32px',

  // Typography
  fontSizeXs: '12px',
  fontSizeSm: '14px',
  fontSizeMd: '16px',
  fontSizeLg: '20px',
  fontSizeXl: '24px',

  // Border radius
  radiusNone: '0',
  radiusSm: '2px',
  radiusMd: '4px',
  radiusLg: '8px',
  radiusFull: '9999px',

  // Shadows
  shadowSm: '0 1px 2px rgba(0,0,0,0.1)',
  shadowMd: '0 4px 6px rgba(0,0,0,0.1)',
  shadowLg: '0 10px 15px rgba(0,0,0,0.1)',

  // Transitions
  durationFast: '100ms',
  durationNormal: '200ms',
  durationSlow: '300ms',
})
```

## Injecting Token Styles

Include `tokenStyles` in your document to generate CSS custom properties:

```typescript
// In your app entry or story
const App = () => (
  <>
    {tokenStyles}
    <MyComponent />
  </>
)
```

## For Training

When generating tokens for training:

1. **Semantic naming** - Name by purpose, not value (`colorError` not `colorRed`)
2. **Complete scales** - Include full spacing/size scales
3. **Consistent prefixes** - Group related tokens (`space*`, `radius*`, `color*`)
4. **No magic numbers** - Every value should be a token

## Integration with Structural Vocabulary

Tokens map to structural concepts:

| Token Category | Structural Concept |
|---------------|-------------------|
| Colors | Channel bandwidth (visual) |
| Spacing | Object grouping |
| Typography | Channel type (text) |
| Transitions | Loop feedback timing |

See [styles.md](./styles.md) for using tokens in createStyles.
