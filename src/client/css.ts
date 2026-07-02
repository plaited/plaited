import { isTypeOf, kebabCase } from '../utils.ts'
import { CSS_RESERVED_KEYS } from './css.constants.ts'
import { cssPropertyNameSchema, cssPropertySchema } from './css.schemas.ts'
import type {
  ClassNames,
  CreateParams,
  CSSKeyFrames,
  ElementStylesObject,
  NestedStatements,
  StyleFunctionKeyframe,
} from './css.types.ts'

// ── Inline error classes ─────────────────────────────────────────────

export class InvalidPropertyNameError extends Error {
  override name = 'invalid_property_name'
  constructor(prop: string) {
    super(`Unknown CSS property name: ${JSON.stringify(prop)}`)
  }
}

export class InvalidPropertyValueError extends Error {
  override name = 'invalid_property_value'
  constructor(prop: string, value: unknown) {
    const valStr = isTypeOf<{ toString: () => string }>(value, 'object') ? JSON.stringify(value) : `${value}`
    super(`Invalid value for CSS property ${JSON.stringify(prop)}: ${valStr}`)
  }
}

/**
 * Fast non-cryptographic string hashing using djb2 algorithm.
 * Returns consistent 32-bit hash for caching and comparison.
 *
 * @param str - String to hash
 * @returns 32-bit hash or null for empty string
 *
 * @remarks
 * - Uses djb2: `hash = ((hash << 5) + hash) + char`
 * - Seed value: 5381 (djb2 magic constant)
 * - Returns null for empty strings to differentiate from valid hashes
 * - Deterministic: same input always produces same output
 *
 * @internal
 */
const hashString = (str: string) => {
  const hash = [...str].reduce<number>((acc, cur) => (acc << 5) + acc + cur.charCodeAt(0), 5381)
  return hash === 5381 ? null : hash
}

/**
 * @internal
 * Creates deterministic hash for CSS class names from style properties and selectors.
 *
 * @param args - Strings and numbers to hash together
 * @returns Base36 hash string prefixed with underscore if negative
 */
export const createHash = (...args: (string | number)[]) => {
  const hash = hashString(args.join(' '))?.toString(36)?.replace(/^-/g, '_')
  return hash?.startsWith('_') ? hash : `_${hash}`
}

const caseProp = (prop: string) => (prop.startsWith('--') ? prop : kebabCase(prop))

/** @internal Formats a single CSS property-value pair as `prop:value;`. */
export const getRule = (prop: string, value: string | number) => `${caseProp(prop)}:${value};`

/**
 * @internal
 * Checks if a value is a primitive (string or number).
 */
const isPrimitive = (val: unknown): val is string | number => typeof val === 'string' || typeof val === 'number'

// --- Validation helpers ---

const assertPropertyName = (prop: string) => {
  if (prop.startsWith('--')) return
  if (prop.startsWith(':')) return
  if (prop.startsWith('@')) return
  if (prop.startsWith('[')) return
  if (prop === CSS_RESERVED_KEYS.$default || prop === CSS_RESERVED_KEYS.$compoundSelectors) return
  const result = cssPropertyNameSchema.safeParse(prop)
  if (!result.success) throw new InvalidPropertyNameError(prop)
}

const assertPropertyValue = (prop: string, value: unknown) => {
  if (typeof value === 'function') return
  if (prop.startsWith('--')) return
  if (prop.startsWith(':')) return
  if (prop.startsWith('@')) return
  if (prop.startsWith('[')) return
  const schema =
    prop in cssPropertySchema.shape ? cssPropertySchema.shape[prop as keyof typeof cssPropertySchema.shape] : undefined
  const result = (schema ?? cssPropertySchema).safeParse(value)
  if (!result.success) throw new InvalidPropertyValueError(prop, value)
}

// --- Style formatting helpers ---

const formatClassStatement = ({
  styles,
  value,
  prop,
  selectors = [],
}: {
  styles: string[]
  value: unknown
  prop: string
  selectors?: string[]
}) => {
  if (isTypeOf<NestedStatements>(value, 'object')) {
    const arr = Object.entries(value)
    for (let i = 0; i < arr.length; i++) {
      const [context, val] = arr[i]!
      if (context === CSS_RESERVED_KEYS.$default || /^(:|\[|@)/.test(context)) {
        const nextSelectors = [...selectors]
        context !== CSS_RESERVED_KEYS.$default && nextSelectors.push(context)
        formatClassStatement({ styles, value: val, prop, selectors: nextSelectors })
      }
    }
  } else {
    assertPropertyValue(prop, value)
    const rule = getRule(prop, value as string | number)
    const arr = selectors.map((str) => (str.startsWith('@') ? `${str}{` : `&${str}{`))
    styles.push(`{${arr.join('')}${rule}${'}'.repeat(arr.length)}}`)
  }
}

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
        formatHostProp({ prop, value: val, selectors: [...selectors, key], host })
      }
    } else {
      assertPropertyValue(prop, value)
      const arr = selectors.map((str) => `${str}{`)
      styles.push(`${host}{${arr.join('')}${getRule(prop, value as string | number)}${'}'.repeat(arr.length)}}`)
    }
  }

  for (const [prop, value] of Object.entries(props)) {
    assertPropertyName(prop)
    if (isPrimitive(value)) {
      formatHostProp({ prop, value })
      continue
    }
    if (!isTypeOf<Record<string, unknown>>(value, 'object')) continue
    const { [CSS_RESERVED_KEYS.$compoundSelectors]: compoundSelectors, ...rest } = value
    if (Object.keys(rest).length) formatHostProp({ prop, value: rest })
    if (compoundSelectors && isTypeOf<Record<string, unknown>>(compoundSelectors, 'object')) {
      for (const [selector, selValue] of Object.entries(compoundSelectors)) {
        const host = selector === CSS_RESERVED_KEYS.$default ? ':host' : `:host(${selector})`
        formatHostProp({ prop, value: selValue, host })
      }
    }
  }
  return styles
}

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
      assertPropertyValue(prop, value)
      const arr = selectors.map((s) => `${s}{`)
      styles.push(`:root{${arr.join('')}${getRule(prop, value as string | number)}${'}'.repeat(arr.length)}}`)
    }
  }

  for (const [prop, value] of Object.entries(props)) {
    assertPropertyName(prop)
    if (isPrimitive(value)) {
      walkRoot(prop, value, [])
    } else if (isTypeOf<Record<string, unknown>>(value, 'object')) {
      walkRoot(prop, value, [])
    }
  }
  return styles
}

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
        if (isPrimitive(val)) {
          body.push(getRule(prop, val))
        }
      }
      if (body.length) styles.push(`${atRule}{${body.join('')}}`)
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
 * All other keys produce hashed class-based rules.
 *
 * @param classNames - Object mapping logical class names to CSS property definitions
 * @returns Object mapping each logical name to generated class names and stylesheets
 */
export const createStyles = <T extends CreateParams>(classNames: T): ClassNames<T> =>
  Object.entries(classNames).reduce(
    (acc, [cls, props]) => {
      if (cls === CSS_RESERVED_KEYS.$host) {
        const hostProps = props as Record<string, unknown>
        if (isTypeOf<Record<string, unknown>>(hostProps, 'object')) {
          const stylesheets = formatHostRules(hostProps)
          acc[CSS_RESERVED_KEYS.$host as keyof T] = { classNames: [], stylesheets } as ElementStylesObject
          return acc
        }
      }

      if (cls === CSS_RESERVED_KEYS.$root) {
        const rootProps = props as Record<string, unknown>
        if (isTypeOf<Record<string, unknown>>(rootProps, 'object')) {
          const stylesheets = formatRootRules(rootProps)
          acc[CSS_RESERVED_KEYS.$root as keyof T] = { classNames: [], stylesheets } as ElementStylesObject
          return acc
        }
      }

      if (cls === CSS_RESERVED_KEYS.$top) {
        const topProps = props as Record<string, unknown>
        if (isTypeOf<Record<string, unknown>>(topProps, 'object')) {
          const stylesheets = formatTopRules(topProps)
          acc[CSS_RESERVED_KEYS.$top as keyof T] = { classNames: [], stylesheets } as ElementStylesObject
          return acc
        }
      }

      const styles: string[] = []
      const rules = props as Record<string, unknown>
      for (const [prop, value] of Object.entries(rules)) {
        assertPropertyName(prop)
        formatClassStatement({ styles, value, prop })
      }
      const classes: string[] = []
      const stylesheets: string[] = []
      for (const sheet of styles) {
        const c = `cls${createHash(sheet)}`
        classes.push(c)
        stylesheets.push(`.${c}${sheet}`)
      }
      acc[cls as keyof T] = { classNames: [cls, ...classes], stylesheets } as ElementStylesObject
      return acc
    },
    {} as ClassNames<T>,
  )

/**
 * Creates a CSS `@keyframes` animation with automatic hash-based identifier generation.
 *
 * @param ident - Base identifier for the animation (will be hashed for uniqueness)
 * @param frames - Object defining animation keyframes
 * @returns Object mapping the animation name to a StyleFunctionKeyframe
 */
export const createKeyframes = <I extends string, T extends CSSKeyFrames>(
  ident: I,
  frames: T,
): Record<I, StyleFunctionKeyframe> => {
  const stylesheets: string[] = []
  const arr: string[] = []
  for (const [value, props] of Object.entries(frames)) {
    const step: string[] = []
    for (const [prop, val] of Object.entries(props || {})) {
      assertPropertyValue(prop, val)
      step.push(getRule(prop, val as string | number))
    }
    arr.push(`${value}{${step.join('')}}`)
  }
  const hashedIdent = ident + createHash(...arr)
  stylesheets.push(`@keyframes ${hashedIdent}{${arr.join('')}}`)
  const getFrames = () => ({ stylesheets })
  getFrames.id = hashedIdent
  return {
    [ident]: getFrames,
  } as Record<I, StyleFunctionKeyframe>
}
