import { isTypeOf } from '../utils.ts'
import { CSS_RESERVED_KEYS } from './css.constants.ts'
import {
  InvalidKeyframeRefPositionError,
  InvalidPropertyNameError,
  InvalidPropertyValueError,
  MissingRegistryError,
  UnresolvedKeyframeRefError,
  UnresolvedTokenRefError,
} from './css.errors.ts'
import { cssPropertyNameSchema, cssPropertyValueSchema } from './css.schemas.ts'
import type {
  ClassNames,
  CreateParams,
  CssRegistry,
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
  if (isTypeOf<() => unknown>(value, 'function')) return
  const schema = cssPropertyValueSchema(prop)
  const result = schema.safeParse(value)
  if (!result.success) throw new InvalidPropertyValueError(prop, value)
}

/**
 * @internal
 * Heuristic check: does a value look like a `{$tokenRef: "..."}` or `{$keyframeRef: "..."}` object?
 */
const isRefObject = (val: unknown): val is Record<string, string> =>
  isTypeOf<Record<string, string>>(val, 'object') &&
  !isTokenReference(val) &&
  (Object.hasOwn(val, '$tokenRef') || Object.hasOwn(val, '$keyframeRef'))

/**
 * @internal
 * Resolve a `{$tokenRef}` or `{$keyframeRef}` value. Returns the resolved
 * literal string and the stylesheets the ref contributes. Throws if registry
 * is missing, ref is not found, or keyframe ref is in wrong position.
 */
const resolveRef = (
  value: Record<string, string>,
  prop: string,
  registry?: CssRegistry,
): { resolved: string | number; stylesheets: string[] } => {
  const keyframeNames = new Set([
    'animation',
    'animation-name',
    'animationName',
    '-webkit-animation',
    'WebkitAnimation',
    'webkitAnimation',
    '-webkit-animation-name',
    'WebkitAnimationName',
    'webkitAnimationName',
  ])

  if ('$keyframeRef' in value) {
    if (!keyframeNames.has(prop)) throw new InvalidKeyframeRefPositionError(prop)
    if (!registry) throw new MissingRegistryError('keyframeRef', value.$keyframeRef)
    const entry = registry.keyframes?.get(value.$keyframeRef)
    if (!entry) throw new UnresolvedKeyframeRefError(value.$keyframeRef)
    return { resolved: entry.id, stylesheets: entry.stylesheets }
  }

  if ('$tokenRef' in value) {
    if (!registry) throw new MissingRegistryError('tokenRef', value.$tokenRef)
    const entry = registry.tokens?.get(value.$tokenRef)
    if (!entry) throw new UnresolvedTokenRefError(value.$tokenRef)
    return { resolved: entry.cssVar, stylesheets: entry.stylesheets }
  }

  return { resolved: '', stylesheets: [] }
}

// --- Style formatting helpers (unchanged structure, but now resolve refs) ---

const formatClassStatement = ({
  styles,
  tokenStyles,
  value,
  prop,
  selectors = [],
  registry,
}: {
  styles: string[]
  tokenStyles: string[]
  value: unknown
  prop: string
  selectors?: string[]
  registry?: CssRegistry
}) => {
  // Handle $ref objects before NestedStatements check
  if (isRefObject(value)) {
    const { resolved, stylesheets: refStyles } = resolveRef(value, prop, registry)
    tokenStyles.push(...refStyles)
    assertPropertyValue(prop, resolved)
    const arr = selectors.map((str) => (str.startsWith('@') ? `${str}{` : `&${str}{`))
    styles.push(`{${arr.join('')}${getRule(prop, resolved)}${'}'.repeat(arr.length)}}`)
    return
  }

  if (isTypeOf<NestedStatements>(value, 'object')) {
    const arr = Object.entries(value)
    for (let i = 0; i < arr.length; i++) {
      const [context, val] = arr[i]!
      if (context === CSS_RESERVED_KEYS.$default || /^(:|\[|@)/.test(context)) {
        const nextSelectors = [...selectors]
        context !== CSS_RESERVED_KEYS.$default && nextSelectors.push(context)
        formatClassStatement({ styles, value: val, prop, selectors: nextSelectors, tokenStyles, registry })
      }
    }
  } else {
    if (!isTokenReference(value)) assertPropertyValue(prop, value)
    const isToken = isTokenReference(value)
    isToken && tokenStyles.push(...(value as DesignTokenReference).stylesheets)
    const rule = getRule(prop, isToken ? (value as DesignTokenReference)() : (value as string | number))
    const arr = selectors.map((str) => (str.startsWith('@') ? `${str}{` : `&${str}{`))
    styles.push(`{${arr.join('')}${rule}${'}'.repeat(arr.length)}}`)
  }
}

const formatHostRules = (props: Record<string, unknown>, registry?: CssRegistry): string[] => {
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
    if (isRefObject(value)) {
      const { resolved, stylesheets: refStyles } = resolveRef(value, prop, registry)
      styles.push(...refStyles)
      assertPropertyValue(prop, resolved)
      const arr = selectors.map((str) => `${str}{`)
      styles.push(`${host}{${arr.join('')}${getRule(prop, resolved)}${'}'.repeat(arr.length)}}`)
      return
    }

    if (isTypeOf<Record<string, unknown>>(value, 'object')) {
      for (const [key, val] of Object.entries(value)) {
        if (key === CSS_RESERVED_KEYS.$default) {
          formatHostProp({ prop, value: val, selectors, host })
          continue
        }
        formatHostProp({ prop, value: val, selectors: [...selectors, key], host })
      }
    } else {
      if (!isTokenReference(value)) assertPropertyValue(prop, value)
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
    if (isPrimitive(value) || isTokenReference(value) || isRefObject(value)) {
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

const formatRootRules = (props: Record<string, unknown>, registry?: CssRegistry): string[] => {
  const styles: string[] = []

  const walkRoot = (prop: string, value: unknown, selectors: string[]) => {
    if (isRefObject(value)) {
      const { resolved, stylesheets: refStyles } = resolveRef(value, prop, registry)
      styles.push(...refStyles)
      assertPropertyValue(prop, resolved)
      const arr = selectors.map((s) => `${s}{`)
      styles.push(`:root{${arr.join('')}${getRule(prop, resolved)}${'}'.repeat(arr.length)}}`)
      return
    }

    if (isTypeOf<Record<string, unknown>>(value, 'object')) {
      for (const [key, val] of Object.entries(value)) {
        if (key === CSS_RESERVED_KEYS.$default) {
          walkRoot(prop, val, selectors)
          continue
        }
        walkRoot(prop, val, [...selectors, key])
      }
    } else {
      if (!isTokenReference(value)) assertPropertyValue(prop, value)
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
    if (isPrimitive(value) || isTokenReference(value) || isRefObject(value)) {
      walkRoot(prop, value, [])
    } else if (isTypeOf<Record<string, unknown>>(value, 'object')) {
      walkRoot(prop, value, [])
    }
  }
  return styles
}

const formatTopRules = (props: Record<string, unknown>, registry?: CssRegistry): string[] => {
  const styles: string[] = []

  for (const [atRule, value] of Object.entries(props)) {
    if (!atRule.startsWith('@')) continue
    if (isPrimitive(value)) {
      styles.push(`${atRule}{${value}}`)
    } else if (isTypeOf<Record<string, unknown>>(value, 'object')) {
      const body: string[] = []
      for (const [prop, val] of Object.entries(value)) {
        assertPropertyName(prop)
        if (isRefObject(val)) {
          const { resolved, stylesheets: refStyles } = resolveRef(val, prop, registry)
          styles.push(...refStyles)
          assertPropertyValue(prop, resolved)
          body.push(getRule(prop, resolved))
        } else if (isPrimitive(val) || isTokenReference(val)) {
          const isToken = isTokenReference(val)
          isToken && styles.push(...val.stylesheets)
          body.push(getRule(prop, isToken ? val() : val))
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
 * @param registry - Optional registry for resolving $tokenRef and $keyframeRef refs
 * @returns Object mapping each logical name to generated class names and stylesheets
 */
export const createStyles = <T extends CreateParams>(classNames: T, registry?: CssRegistry): ClassNames<T> =>
  Object.entries(classNames).reduce(
    (acc, [cls, props]) => {
      if (cls === CSS_RESERVED_KEYS.$host) {
        const hostProps = props as Record<string, unknown>
        if (isTypeOf<Record<string, unknown>>(hostProps, 'object') && !isTokenReference(hostProps)) {
          const stylesheets = formatHostRules(hostProps, registry)
          acc[CSS_RESERVED_KEYS.$host as keyof T] = { classNames: [], stylesheets } as ElementStylesObject
          return acc
        }
      }

      if (cls === CSS_RESERVED_KEYS.$root) {
        const rootProps = props as Record<string, unknown>
        if (isTypeOf<Record<string, unknown>>(rootProps, 'object') && !isTokenReference(rootProps)) {
          const stylesheets = formatRootRules(rootProps, registry)
          acc[CSS_RESERVED_KEYS.$root as keyof T] = { classNames: [], stylesheets } as ElementStylesObject
          return acc
        }
      }

      if (cls === CSS_RESERVED_KEYS.$top) {
        const topProps = props as Record<string, unknown>
        if (isTypeOf<Record<string, unknown>>(topProps, 'object') && !isTokenReference(topProps)) {
          const stylesheets = formatTopRules(topProps, registry)
          acc[CSS_RESERVED_KEYS.$top as keyof T] = { classNames: [], stylesheets } as ElementStylesObject
          return acc
        }
      }

      const styles: string[] = []
      const tokenStyles: string[] = []
      const rules = props as Record<string, unknown>
      for (const [prop, value] of Object.entries(rules)) {
        assertPropertyName(prop)
        formatClassStatement({ styles, value, prop, tokenStyles, registry })
      }
      const classes: string[] = []
      const stylesheets: string[] = tokenStyles
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
