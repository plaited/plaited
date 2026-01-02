---
name: design-tokens-library
description: Reference documentation for createTokens patterns including color systems, spacing scales, typography, and animations. Automatically invoked when designing design tokens or working with Plaited's CSS-in-JS token system.
license: ISC
compatibility: Requires bun
---

# Design Tokens Library

Reference documentation for creating design tokens with Plaited's `createTokens` utility.

## Purpose

This skill provides structural patterns for design tokens. Use this when:
- Creating color systems (palettes, semantic colors, state-based colors)
- Defining spacing scales (4px/8px grids, sizing tokens)
- Building typography scales (type scales, font stacks)
- Creating animation tokens (timing, easing, keyframes)

## Quick Reference

**Token Structure:**
```typescript
import { createTokens } from 'plaited'

export const { namespace } = createTokens('namespace', {
  tokenName: {
    $default: { $value: 'defaultValue' },
    $compoundSelectors: {
      ':state(checked)': { $value: 'checkedValue' },
      ':hover': { $value: 'hoverValue' },
    },
  },
})
```

**Key Patterns:**
- `$value` - The token value (string, number, array, or function)
- `$default` - Base value when using compound selectors
- `$compoundSelectors` - State-based variations (`:state()`, `:hover`, `[disabled]`)
- Token references - Pass tokens directly (not invoked) as CSS values

## References

### Color Systems
- **[color-systems.md](references/color-systems.md)** - Palettes, semantic colors, state-based colors
  - Use for: Primary/secondary colors, semantic naming, interactive states
  - Patterns: Brand colors, surface tokens, state-based fills

### Spacing Scales
- **[spacing-scales.md](references/spacing-scales.md)** - Grid systems, spacing tokens, sizing
  - Use for: 4px/8px base grids, component sizing, layout spacing
  - Patterns: Base unit scales, semantic spacing, responsive sizing

### Typography Scales
- **[typography-scales.md](references/typography-scales.md)** - Type scales, font stacks
  - Use for: Font size hierarchies, line heights, font families
  - Patterns: Modular scales, responsive typography, font tokens

### Animation Tokens
- **[animation-tokens.md](references/animation-tokens.md)** - Timing, easing, keyframes
  - Use for: Duration tokens, easing functions, motion patterns
  - Patterns: Timing scales, easing presets, reduced motion

## Usage with Styles

Tokens integrate with `createStyles`, `createHostStyles`, and `joinStyles`:

```typescript
import { createStyles, createHostStyles, joinStyles } from 'plaited'
import { fills } from './fills.tokens.ts'
import { spacing } from './spacing.tokens.ts'

// In createStyles - pass token reference directly
export const styles = createStyles({
  element: {
    backgroundColor: fills.surface,  // NOT fills.surface()
    padding: spacing.md,
  }
})

// In hostStyles - use joinStyles to include token CSS variables
export const hostStyles = joinStyles(
  fills,  // Includes all token CSS variable definitions
  createHostStyles({
    display: 'block',
    padding: spacing.lg,
  })
)
```

## Best Practices

1. **Namespace tokens** - Use descriptive namespaces (`fills`, `strokes`, `spacing`)
2. **Separate token files** - Use `*.tokens.ts` extension
3. **Pass references directly** - Never invoke tokens when using as CSS values
4. **Use joinStyles for hostStyles** - Include token definitions in host styles
5. **State-based variations** - Use `$compoundSelectors` for interactive states

## Related Skills

- **plaited-framework-patterns** - Complete styling documentation
- **design-system-scaffolding** - Generate token files from templates
