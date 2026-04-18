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

Use host styles with `decorateElements` when styling declarative Shadow DOM
hosts. Controller hosts should set their own layout style, commonly
`display: contents`, when they should not introduce an extra layout box.

### `createKeyframes`

Generates hashed `@keyframes` names for deduped animation rules.

### `joinStyles`

Composes multiple stylesheet-bearing values into one collection.

Use it when a component needs to merge host styles, slot styles, and other
generated CSS surfaces.

## Controller Interactions

Controller `render` messages may include HTML produced by `createSSR()`.
Stylesheets are still deduplicated by the server-side renderer before the HTML
is sent. Do not make the browser controller responsible for CSS deduplication.

When a pushed render introduces new `p-trigger` elements, the controller island
binds those triggers after parsing the HTML fragment. Styling and trigger
binding are separate concerns: styles travel in rendered HTML, while trigger
behavior is derived from the serialized `p-trigger` attribute.
