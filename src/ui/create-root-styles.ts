import { isTypeOf } from '../utils.ts'
import { CSS_RESERVED_KEYS } from './css.constants.ts'
import type {
  CreateRootParams,
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
 * Recursively processes CSS properties to generate `:root` selector rules.
 * Handles nested statements, compound selectors, and design token references.
 */
const formatRootStatement = ({
  styles,
  prop,
  value,
  selectors = [],
}: {
  styles: string[]
  prop: string
  value: CSSProperties[keyof CSSProperties] | NestedStatements | DesignTokenReference
  selectors?: string[]
}) => {
  if (isTypeOf<NestedStatements>(value, 'object')) {
    for (const [key, val] of Object.entries(value)) {
      if (key === CSS_RESERVED_KEYS.$default) {
        formatRootStatement({
          styles,
          prop,
          value: val,
          selectors,
        })
        continue
      }
      formatRootStatement({
        styles,
        prop,
        value: val,
        selectors: [...selectors, key],
      })
    }
  } else {
    const isToken = isTokenReference(value)
    isToken && styles.push(...value.stylesheets)
    const arr = selectors.map((str) => `${str}{`)
    styles.push(`:root{${arr.join('')}${getRule(prop, isToken ? value() : value)}${'}'.repeat(arr.length)}}`)
  }
}

/**
 * Creates CSS styles scoped to the `:root` selector for the light DOM.
 * Supports nested rules, compound selectors, and design token references.
 * Unlike `createStyles` which generates class-based rules, this function
 * targets the document root for global properties like custom properties and resets.
 *
 * @param props - CSS properties to apply to `:root`
 * @returns Object containing only stylesheets (no classNames, as root styles don't use classes)
 *
 * @remarks
 * - Generates `:root{ ... }` rules for the light DOM
 * - Use `$compoundSelectors` to nest rules within media queries, pseudo-classes, etc.
 * - Design token references are automatically resolved and their stylesheets included
 * - Returns only `stylesheets` array (no `classNames` property)
 *
 * @see {@link CreateRootParams} for the input type structure
 * @see {@link HostStylesObject} for the return type
 * @see {@link createStyles} for class-based element styling
 * @see {@link createTokens} for design token creation
 *
 * @public
 */
export const createRootStyles = (props: CreateRootParams): HostStylesObject => {
  const styles: string[] = []
  for (const [prop, value] of Object.entries(props)) {
    if (isPrimitive(value) || isTokenReference(value)) {
      formatRootStatement({
        styles,
        prop,
        value,
      })
      continue
    }
    if (Object.keys(value).length) {
      formatRootStatement({
        styles,
        prop,
        value,
      })
    }
  }

  return {
    stylesheets: styles,
  }
}
