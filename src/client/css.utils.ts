import { isTypeOf, kebabCase } from '../utils.ts'
import type { DesignTokenReference, ElementStylesObject, StylesObject } from './css.types.ts'

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

/** @internal Type guard: returns true if `ref` is a `DesignTokenReference` function. */
export const isTokenReference = (ref: unknown): ref is DesignTokenReference =>
  isTypeOf<DesignTokenReference>(ref, 'function')

/**
 * Type guard to identify ElementStylesObject (styles with class names).
 *
 * @param obj - Object to check
 * @returns True if object is an ElementStylesObject
 *
 * @remarks
 * - Validates both structure and property types
 * - ElementStylesObject always has classNames array
 *
 * @internal
 */
export const isElementStylesObject = (obj: unknown): obj is ElementStylesObject => {
  return (
    isTypeOf<{ [key: string]: unknown }>(obj, 'object') &&
    Object.hasOwn(obj, 'classNames') &&
    Array.isArray(obj.classNames) &&
    Object.hasOwn(obj, 'stylesheets') &&
    Array.isArray(obj.stylesheets)
  )
}

/**
 * Type guard to identify any StylesObject.
 *
 * @param obj - Object to check
 * @returns True if object is an ElementStylesObject
 *
 * @internal
 */
export const isStylesObject = (obj: unknown): obj is StylesObject => {
  return isElementStylesObject(obj)
}
