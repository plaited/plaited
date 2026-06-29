/**
 * @module resolve-template-refs
 *
 * Resolver layer for Plaited component catalog references.
 * Takes raw component attrs (with `$styleRef`, `$bind` references) and an
 * `HtmlRegistry`, and returns fully resolved attrs suitable for `h()`.
 *
 * @remarks
 * This module owns:
 * - `$styleRef` → `StylesObject` resolution (style[] → styles[])
 * - `$bind` resolution in attr values and children/text
 * - Position constraint validation ($styleRef only in style[], $bind only in text/attrs)
 *
 * `h()` in template.ts receives only resolved values — it never sees refs.
 *
 * @see {@link https://git/UI-GENERATION-PATTERNS.md#33-the-four-kinded-refs}
 */

import type { StylesObject } from './css.types.ts'
import type { Bind, StyleRef } from './template.schemas.ts'

// ============================================================================
// Error classes
// ============================================================================

/**
 * Error thrown when a `$styleRef` / `$bind` is encountered without a registry.
 *
 * @public
 */
export class MissingRegistryError extends Error {
  override name = 'missing_registry'
}

/**
 * Error thrown when a `$styleRef` cannot be found in the registry.
 *
 * @public
 */
export class UnresolvedStyleRefError extends Error {
  override name = 'unresolved_style_ref'
}

/**
 * Error thrown when a `$bind` path cannot be resolved from registry.data.
 *
 * @public
 */
export class UnresolvedBindError extends Error {
  override name = 'unresolved_bind'
}

/**
 * Error thrown when a `$bind` appears in an invalid position.
 *
 * @public
 */
export class InvalidBindPositionError extends Error {
  override name = 'invalid_bind_position'
}

/**
 * Error thrown when a `$styleRef` appears outside the `style[]` array.
 *
 * @public
 */
export class InvalidStyleRefPositionError extends Error {
  override name = 'invalid_style_ref_position'
}

// ============================================================================
// Types
// ============================================================================

/**
 * Registry of saved styles and data context for resolving `$styleRef` / `$bind`
 * references at template materialization time.
 *
 * @remarks
 * - `styles` maps catalog-style ids to their resolved `ElementStylesObject`
 *   (class names + stylesheets) from `createStyles`.
 * - `data` supplies runtime values for `$bind` path resolution
 *   (e.g. `{ 'customer.id': '123' }`).
 *
 * The registry is OPTIONAL — when absent and a `$styleRef` / `$bind` is
 * encountered, `resolveTemplateRefs` throws `MissingRegistryError`. The
 * literal-only flow (no refs, no registry) works unchanged.
 *
 * @public
 */
export type HtmlRegistry = {
  styles?: Map<string, { classNames: string[]; stylesheets: string[] }>
  data?: Record<string, unknown>
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Resolve a dotted path from a data context (e.g. 'customer.id' → data.customer.id).
 * Returns `undefined` if the path does not exist.
 *
 * @internal
 */
const resolveDataPath = (data: Record<string, unknown>, path: string): unknown => {
  let current: unknown = data
  for (const segment of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

// ============================================================================
// Main resolver
// ============================================================================

/**
 * Resolve template refs (`$styleRef`, `$bind`) in raw component attrs,
 * returning attrs ready for `h()`.
 *
 * @param attrs - Raw component attrs (may contain `style: StyleRef[]`,
 *   `$bind` in values/children, etc.)
 * @param registry - Registry mapping style ids and data paths
 * @returns Resolved attrs where `style: StyleRef[]` is converted to
 *   `styles: StylesObject[]`, `$bind` refs are resolved to literals,
 *   and position constraints are enforced.
 *
 * @throws {MissingRegistryError} When a ref is encountered without a registry
 * @throws {UnresolvedStyleRefError} When a $styleRef cannot be found
 * @throws {UnresolvedBindError} When a $bind path cannot be resolved
 * @throws {InvalidStyleRefPositionError} When $styleRef appears outside style[]
 * @throws {InvalidBindPositionError} When $bind appears inside style[]
 *
 * @public
 */
export const resolveTemplateRefs = (
  attrs: Record<string, unknown>,
  registry: HtmlRegistry,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {}

  // ── Resolve style / styles ──────────────────────────────────────
  const style = attrs.style
  if (Array.isArray(style)) {
    // style is StyleRef[] → first validate position constraint
    for (const ref of style) {
      if (ref && typeof ref === 'object') {
        const refObj = ref as Record<string, unknown>
        if ('$bind' in refObj) {
          throw new InvalidBindPositionError('`$bind` is not legal in the `style[]` array')
        }
      }
    }
    if (!registry.styles) throw new MissingRegistryError('$styleRef encountered without registry.styles')
    const resolvedStyles: StylesObject[] = []
    for (const ref of style) {
      const styleRef = ref as StyleRef
      const resolved = registry.styles.get(styleRef.$styleRef)
      if (!resolved) throw new UnresolvedStyleRefError(`Unresolved style ref: ${styleRef.$styleRef}`)
      resolvedStyles.push(resolved)
    }
    out.styles = resolvedStyles
  } else if (style && typeof style === 'object') {
    // style is CSSProperties — pass through
    out.style = style
  }

  // ── Resolve $bind in values ─────────────────────────────────────
  const resolveValue = (val: unknown, attrKey: string): unknown => {
    if (val && typeof val === 'object') {
      const obj = val as Record<string, unknown>
      // $styleRef is only legal in the style[] array
      if ('$styleRef' in obj) {
        throw new InvalidStyleRefPositionError(
          `\`$styleRef\` is only legal in the \`style[]\` array, found as \`${attrKey}\``,
        )
      }
      if ('$bind' in obj) {
        if (!registry.data) throw new MissingRegistryError('$bind encountered without a registry')
        const bindVal = val as Bind
        const resolved = resolveDataPath(registry.data, bindVal.$bind)
        if (resolved === undefined) {
          throw new UnresolvedBindError(`Unresolved bind path: ${bindVal.$bind}`)
        }
        return resolved
      }
    }
    return val
  }

  // ── Handle children $bind ───────────────────────────────────────
  const children = attrs.children
  if (children && typeof children === 'object' && '$bind' in (children as Record<string, unknown>)) {
    out.children = resolveValue(children, 'children')
  } else {
    out.children = children
  }

  // ── Handle remaining attrs ──────────────────────────────────────
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'style' || key === 'children') continue
    out[key] = resolveValue(value, key)
  }

  return out
}
