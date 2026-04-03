# CSS System

## Overview

`src/ui/css/` provides atomic CSS-in-JS helpers that generate stylesheet text at
template creation time. Those stylesheets are then deduplicated by `createSSR()`.

## Utilities

### `createStyles`

Generates hashed classes from style objects.

Supports:

- plain declarations
- media queries
- pseudo-classes
- attribute selectors

### `createTokens`

Generates CSS custom-property token groups such as:

- `--color-primary`
- `--spacing-md`

The token helpers return `var(--...)` references for use inside style objects.

### `createHostStyles`

Generates `:host{}` rules for custom elements and shadow-DOM-oriented styling.

In SSR output those selectors are rewritten to `:root{}` and later restored by
the element/shadow pipeline where needed.

### `createKeyframes`

Generates hashed `@keyframes` names for deduped animation rules.

### `joinStyles`

Composes multiple stylesheet-bearing values into one collection.

Use it when a component needs to merge host styles, slot styles, and other
generated CSS surfaces.
