# CSS System

## Overview

`src/ui/css/` provides atomic CSS-in-JS utilities that generate stylesheets at template creation time. Styles are collected into `TemplateObject.stylesheets[]` and deduplicated per connection by `createSSR()`.

## Utilities

### `createStyles` — Atomic CSS

Generates hashed class names from style objects. Each CSS property produces a unique class for deduplication and reuse across components.

```typescript
const styles = createStyles({
  card: { padding: '16px', borderRadius: '8px' },
  title: { fontSize: '1.25rem', fontWeight: 'bold' },
})

// Usage: <div {...styles.card}>
// Output: <div class="card_abc">
// Stylesheet: .card_abc{padding:16px;border-radius:8px}
```

Supports nested selectors:
- **Media queries** — `'@media (min-width: 768px)': { ... }`
- **Pseudo-classes** — `':hover': { ... }`, `':focus': { ... }`
- **Attribute selectors** — `'[aria-expanded="true"]': { ... }`

### `createTokens` — Design Tokens

Design token system using CSS custom properties. Token names are kebab-cased into `--ident-prop` variables.

```typescript
const { color, spacing } = createTokens({
  color: { primary: '#0066cc', surface: '#ffffff' },
  spacing: { sm: '4px', md: '8px', lg: '16px' },
})

// Each token is a function returning var(--...) references:
color.primary()    // → 'var(--color-primary)'
spacing.md()       // → 'var(--spacing-md)'

// Token group has a `stylesheets` property with :root{} declarations:
// :root{--color-primary:#0066cc;--color-surface:#ffffff}
```

Tokens integrate with the rendering pipeline — their `stylesheets` property is collected and deduplicated like any other stylesheet.

### `createHostStyles` — Host Element Styles

Scoped styles for Shadow DOM custom elements. Generates `:host{}` rules that apply to the element itself.

```typescript
const hostStyles = createHostStyles({
  display: 'block',
  ':hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
})
```

**`:host` ↔ `:root` round-trip:**
- `createHostStyles` generates `:host{}` selectors
- `createSSR.render()` converts `:host{}` → `:root{}` for light DOM SSR
- `decorateElements` converts `:root{}` → `:host{}` for shadow DOM contexts

### `createKeyframes` — Animation Keyframes

Generates `@keyframes` rules with hashed names for deduplication.

```typescript
const fadeIn = createKeyframes({
  from: { opacity: '0' },
  to: { opacity: '1' },
})
// Produces: @keyframes fadeIn_xyz{from{opacity:0}to{opacity:1}}
```

### `joinStyles` — Style Composition

Combines host styles with stylesheet arrays into a single stylesheets collection. Used internally by `decorateElements` to merge host-level and slot-level styles.

```typescript
const combined = joinStyles(hostStyles, ...componentStylesheets)
```
