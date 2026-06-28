import { isTypeOf } from '../utils.ts'
import { CSS_RESERVED_KEYS } from './css.constants.ts'
import { cssPropertyNameSchema, cssPropertyValueSchema } from './css.schemas.ts'
import type {
  ClassNames,
  CreateParams,
  CSSProperties,
  DesignTokenReference,
  ElementStylesObject,
  NestedStatements,
} from './css.types.ts'
import { createHash, getRule, isTokenReference } from './css.utils.ts'

/**
 * @internal
 * Checks if a value is a primitive (string or number).
 */
const isPrimitive = (val: unknown): val is string | number => typeof val === 'string' || typeof val === 'number'

/**
 * @internal
 * Error thrown when an unknown CSS property name is encountered.
 */
export class InvalidPropertyNameError extends Error {
  override name = 'invalid_property_name'

  constructor(prop: string) {
    super(`Unknown CSS property name: ${JSON.stringify(prop)}`)
  }
}

/**
 * @internal
 * Error thrown when a CSS property value fails validation.
 */
export class InvalidPropertyValueError extends Error {
  override name = 'invalid_property_value'

  constructor(prop: string, value: unknown) {
    const valStr = isTypeOf<{ toString: () => string }>(value, 'object') ? JSON.stringify(value) : `${value}`
    super(`Invalid value for CSS property ${JSON.stringify(prop)}: ${valStr}`)
  }
}

/**
 * @internal
 * Validates a CSS property name against the schema. Unknown names throw.
 * `--*` custom properties bypass the name check (they match at runtime via index signature).
 */
const assertPropertyName = (prop: string) => {
  if (prop.startsWith('--')) return // CSS custom properties are open-ended
  if (prop.startsWith(':')) return // pseudo-classes/elements (structural NestedStatements key)
  if (prop.startsWith('@')) return // at-rules (structural NestedStatements key)
  if (prop.startsWith('[')) return // attribute selectors (structural NestedStatements key)
  if (prop === CSS_RESERVED_KEYS.$default || prop === CSS_RESERVED_KEYS.$compoundSelectors) return
  const result = cssPropertyNameSchema.safeParse(prop)
  if (!result.success) {
    throw new InvalidPropertyNameError(prop)
  }
}

/**
 * @internal
 * Validates a CSS property value against the per-property schema.
 */
const assertPropertyValue = (prop: string, value: unknown) => {
  // Skip validation for DesignTokenReference callables (in-memory, post-materialization)
  if (isTypeOf<() => unknown>(value, 'function')) return
  const schema = cssPropertyValueSchema(prop)
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new InvalidPropertyValueError(prop, value)
  }
}

/**
 * @internal
 * Recursively processes CSS property values to generate atomic CSS class rules.
 * Handles nested statements (media queries, pseudo-classes, attribute selectors) and design token references.
 * Accumulates styles into flat arrays for stylesheet generation.
 */
const formatClassStatement = ({
  styles,
  tokenStyles,
  value,
  prop,
  selectors = [],
}: {
  styles: string[]
  tokenStyles: string[]
  value: NestedStatements | CSSProperties[keyof CSSProperties] | DesignTokenReference
  prop: string
  selectors?: string[]
}) => {
  if (isTypeOf<NestedStatements>(value, 'object')) {
    const arr = Object.entries(value)
    const length = arr.length
    for (let i = 0; i < length; i++) {
      const [context, val] = arr[i]!
      if (context === CSS_RESERVED_KEYS.$default || /^(:|\[|@)/.test(context)) {
        const nextSelectors = [...selectors]
        context !== CSS_RESERVED_KEYS.$default && nextSelectors.push(context)
        formatClassStatement({
          styles,
          value: val,
          prop,
          selectors: nextSelectors,
          tokenStyles,
        })
      }
    }
  } else {
    // Validate terminal values (skip DesignTokenReference callables)
    if (!isTokenReference(value)) {
      assertPropertyValue(prop, value)
    }
    const isToken = isTokenReference(value)
    isToken && tokenStyles.push(...(value as DesignTokenReference).stylesheets)
    const rule = getRule(prop, isToken ? (value as DesignTokenReference)() : (value as string | number))
    const arr = selectors.map((str) => (str.startsWith('@') ? `${str}{` : `&${str}{`))
    styles.push(`{${arr.join('')}${rule}${'}'.repeat(arr.length)}}`)
  }
}

/**
 * @internal
 * Handler for `$host` reserved key — generates `:host{...}` rules (no hashing).
 * Supports `$compoundSelectors` for `:host(selector)` compound selectors.
 */
const formatHostRules = (props: Record<string, unknown>): string[] => {
  const styles: string[] = []

  const formatHostProp = ({
    prop,
    value,
    selectors = [],
    host = ':host',
  }: {
    prop: string
    value: unknown
    selectors?: string[]
    host?: string
  }) => {
    if (isTypeOf<Record<string, unknown>>(value, 'object')) {
      for (const [key, val] of Object.entries(value)) {
        if (key === CSS_RESERVED_KEYS.$default) {
          formatHostProp({ prop, value: val, selectors, host })
          continue
        }
        formatHostProp({
          prop,
          value: val,
          selectors: [...selectors, key],
          host,
        })
      }
    } else {
      if (!isTokenReference(value)) {
        assertPropertyValue(prop, value)
      }
      const isToken = isTokenReference(value)
      isToken && styles.push(...value.stylesheets)
      const arr = selectors.map((str) => `${str}{`)
      styles.push(
        `${host}{${arr.join('')}${getRule(prop, isToken ? (value as DesignTokenReference)() : (value as string | number))}${'}'.repeat(arr.length)}}`,
      )
    }
  }

  for (const [prop, value] of Object.entries(props)) {
    assertPropertyName(prop)
    if (isPrimitive(value) || isTokenReference(value)) {
      formatHostProp({ prop, value })
      continue
    }

    if (!isTypeOf<Record<string, unknown>>(value, 'object')) continue

    const { [CSS_RESERVED_KEYS.$compoundSelectors]: compoundSelectors, ...rest } = value

    if (Object.keys(rest).length) {
      formatHostProp({ prop, value: rest })
    }

    if (compoundSelectors && isTypeOf<Record<string, unknown>>(compoundSelectors, 'object')) {
      for (const [selector, selValue] of Object.entries(compoundSelectors)) {
        const host = selector === CSS_RESERVED_KEYS.$default ? ':host' : `:host(${selector})`
        formatHostProp({ prop, value: selValue, host })
      }
    }
  }

  return styles
}

/**
 * @internal
 * Handler for `$root` reserved key — generates `:root{...}` rules (no hashing).
 */
const formatRootRules = (props: Record<string, unknown>): string[] => {
  const styles: string[] = []

  const walkRoot = (prop: string, value: unknown, selectors: string[]) => {
    if (isTypeOf<Record<string, unknown>>(value, 'object')) {
      for (const [key, val] of Object.entries(value)) {
        if (key === CSS_RESERVED_KEYS.$default) {
          walkRoot(prop, val, selectors)
          continue
        }
        walkRoot(prop, val, [...selectors, key])
      }
    } else {
      if (!isTokenReference(value)) {
        assertPropertyValue(prop, value)
      }
      const isToken = isTokenReference(value)
      isToken && styles.push(...value.stylesheets)
      const arr = selectors.map((s) => `${s}{`)
      styles.push(
        `:root{${arr.join('')}${getRule(prop, isToken ? (value as DesignTokenReference)() : (value as string | number))}${'}'.repeat(arr.length)}}`,
      )
    }
  }

  for (const [prop, value] of Object.entries(props)) {
    assertPropertyName(prop)
    if (isPrimitive(value) || isTokenReference(value)) {
      walkRoot(prop, value, [])
    } else if (isTypeOf<Record<string, unknown>>(value, 'object')) {
      walkRoot(prop, value, [])
    }
  }

  return styles
}

/**
 * @internal
 * Handler for `$top` reserved key — generates unwrapped top-level at-rules (no hashing).
 */
const formatTopRules = (props: Record<string, unknown>): string[] => {
  const styles: string[] = []

  for (const [atRule, value] of Object.entries(props)) {
    if (!atRule.startsWith('@')) continue
    if (isPrimitive(value)) {
      styles.push(`${atRule}{${value}}`)
    } else if (isTypeOf<Record<string, unknown>>(value, 'object')) {
      const body: string[] = []
      for (const [prop, val] of Object.entries(value)) {
        assertPropertyName(prop)
        if (isPrimitive(val) || isTokenReference(val)) {
          const isToken = isTokenReference(val)
          isToken && styles.push(...val.stylesheets)
          body.push(getRule(prop, isToken ? val() : val))
        }
      }
      if (body.length) {
        styles.push(`${atRule}{${body.join('')}}`)
      }
    }
  }

  return styles
}

/**
 * Creates atomic CSS classes or scoped rules from style definitions.
 *
 * Three reserved keys at the top level select special scoping:
 * - `$host` → `:host{...}` rules (no hashed class names)
 * - `$root` → `:root{...}` rules (no hashed class names)
 * - `$top` → top-level at-rules, unwrapped (no hashed class names)
 *
 * All other keys produce hashed class-based rules (existing behavior).
 *
 * @template T - The type of the class definitions object
 * @param classNames - Object mapping logical class names to CSS property definitions
 * @returns Object mapping each logical name to generated class names and stylesheets
 *
 * @remarks
 * - For ordinary keys, class names are automatically hashed based on CSS content
 * - Design token references are resolved and their styles are included
 * - Supports Shadow DOM adoption via the `stylesheets` array
 *
 * @see {@link CreateParams} for the input type structure
 * @see {@link ClassNames} for the return type structure
 * @see {@link createTokens} for design token creation
 * @see {@link joinStyles} for combining multiple style objects
 */
export const createStyles = <T extends CreateParams>(classNames: T): ClassNames<T> =>
  Object.entries(classNames).reduce(
    (acc, [cls, props]) => {
      // Handle reserved keys: $host, $root, $top
      if (cls === CSS_RESERVED_KEYS.$host) {
        const hostProps = props as Record<string, unknown>
        if (isTypeOf<Record<string, unknown>>(hostProps, 'object') && !isTokenReference(hostProps)) {
          const stylesheets = formatHostRules(hostProps)
          acc[CSS_RESERVED_KEYS.$host as keyof T] = { classNames: [], stylesheets } as ElementStylesObject
          return acc
        }
      }

      if (cls === CSS_RESERVED_KEYS.$root) {
        const rootProps = props as Record<string, unknown>
        if (isTypeOf<Record<string, unknown>>(rootProps, 'object') && !isTokenReference(rootProps)) {
          const stylesheets = formatRootRules(rootProps)
          acc[CSS_RESERVED_KEYS.$root as keyof T] = { classNames: [], stylesheets } as ElementStylesObject
          return acc
        }
      }

      if (cls === CSS_RESERVED_KEYS.$top) {
        const topProps = props as Record<string, unknown>
        if (isTypeOf<Record<string, unknown>>(topProps, 'object') && !isTokenReference(topProps)) {
          const stylesheets = formatTopRules(topProps)
          acc[CSS_RESERVED_KEYS.$top as keyof T] = { classNames: [], stylesheets } as ElementStylesObject
          return acc
        }
      }

      // Ordinary keys: produce hashed class-based rules
      const styles: string[] = []
      const tokenStyles: string[] = []
      const rules = props as Record<
        string,
        CSSProperties[keyof CSSProperties] | DesignTokenReference | NestedStatements
      >
      for (const [prop, value] of Object.entries(rules)) {
        assertPropertyName(prop)
        formatClassStatement({
          styles,
          value: value as CSSProperties[keyof CSSProperties] | DesignTokenReference | NestedStatements,
          prop,
          tokenStyles,
        })
      }
      const classes: string[] = []
      const stylesheets: string[] = tokenStyles
      for (const sheet of styles) {
        const c = `cls${createHash(sheet)}`
        classes.push(c)
        stylesheets.push(`.${c}${sheet}`)
      }
      acc[cls as keyof T] = {
        classNames: [cls, ...classes],
        stylesheets,
      } as ElementStylesObject
      return acc
    },
    {} as ClassNames<T>,
  )
