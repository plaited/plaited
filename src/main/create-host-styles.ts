import { isTypeOf } from '../utils.ts'
import { CSS_RESERVED_KEYS } from './css.constants.ts'
import type {
  CreateHostParams,
  CSSProperties,
  DesignTokenReference,
  HostStylesObject,
  NestedStatements,
} from './css.types.ts'
import { getRule, isTokenReference } from './css.utils.ts'

/**
 * @internal
 * Type guard for primitive CSS values (string or number).
 */
const isPrimitive = (val: string | number | unknown): val is string | number =>
  typeof val === 'string' || typeof val === 'number'

/**
 * @internal
 * Recursively processes host element CSS properties to generate :host selector rules.
 * Handles nested statements, compound selectors, and design token references.
 */
const formatHostStatement = ({
  styles,
  prop,
  value,
  selectors = [],
  host,
}: {
  styles: string[]
  prop: string
  value: CSSProperties[keyof CSSProperties] | NestedStatements | DesignTokenReference
  selectors?: string[]
  host: string
}) => {
  if (isTypeOf<NestedStatements>(value, 'object')) {
    for (const [key, val] of Object.entries(value)) {
      if (key === CSS_RESERVED_KEYS.$default) {
        formatHostStatement({
          styles,
          prop,
          value: val,
          selectors,
          host,
        })
        continue
      }
      formatHostStatement({
        styles,
        prop,
        value: val,
        selectors: [...selectors, key],
        host,
      })
    }
  } else {
    const isToken = isTokenReference(value)
    isToken && styles.push(...value.styles)
    const arr = selectors.map((str) => `${str}{`)
    styles.push(`${host}{${arr.join('')}${getRule(prop, isToken ? value() : value)}${'}'.repeat(arr.length)}}`)
  }
}

/**
 * Creates CSS styles for the Shadow DOM host element using the `:host` selector.
 * Supports nested rules, compound selectors, and design token references.
 * Unlike `createStyles`, this function generates styles for the host element itself rather than children.
 *
 * @param props - CSS properties to apply to the host element
 * @returns Object containing only stylesheets (no classNames, as host styles don't use classes)
 *
 * @remarks
 * - Host styles apply to the custom element itself, not its Shadow DOM children
 * - Use `$compoundSelectors` to apply styles based on host element classes or attributes
 * - Supports all nested statement features (media queries, pseudo-classes, etc.)
 * - Design token references are automatically resolved
 * - Returns only `stylesheets` array (no `classNames` property)
 *
 * @see {@link CreateHostParams} for the input type structure
 * @see {@link HostStylesObject} for the return type
 * @see {@link createStyles} for styling Shadow DOM children
 * @see {@link createTokens} for design token creation
 */
export const createHostStyles = (props: CreateHostParams): HostStylesObject => {
  const styles: string[] = []
  for (const [prop, value] of Object.entries(props)) {
    if (isPrimitive(value) || isTokenReference(value)) {
      formatHostStatement({
        styles,
        prop,
        value,
        host: ':host',
      })
      continue
    }

    // Check if value is an object and has $compoundSelectors property
    const { $compoundSelectors, ...rest } = value
    if (Object.keys(rest).length) {
      formatHostStatement({
        styles,
        prop,
        value: rest,
        host: ':host',
      })
    }

    if ($compoundSelectors) {
      for (const [selector, value] of Object.entries($compoundSelectors)) {
        formatHostStatement({
          styles,
          prop,
          value,
          host: `:host(${selector})`,
        })
      }
    }
  }

  return {
    stylesheets: styles,
  }
}
