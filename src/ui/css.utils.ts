import { hashString, isTypeOf, kebabCase } from '../utils.ts'
import type { DesignTokenReference, ElementStylesObject, HostStylesObject, StylesObject } from './css.types.ts'

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

export const getRule = (prop: string, value: string | number) => `${caseProp(prop)}:${value};`

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
 * - Used to distinguish element styles from host styles
 * - ElementStylesObject always has classNames array
 */
export const isElementStylesObject = (obj: unknown): obj is ElementStylesObject => {
  /**
   * @internal
   * Validates ElementStylesObject structure:
   * 1. isTypeOf confirms object type (not null/primitive)
   * 2. Object.hasOwn checks for classNames property (own property, not inherited)
   * 3. Array.isArray validates classNames is array
   * 4. Object.hasOwn checks for stylesheets property
   * 5. Array.isArray validates stylesheets is array
   * Using Object.hasOwn prevents prototype pollution false positives.
   */
  return (
    isTypeOf<{ [key: string]: unknown }>(obj, 'object') &&
    Object.hasOwn(obj, 'classNames') &&
    Array.isArray(obj.classNames) &&
    Object.hasOwn(obj, 'stylesheets') &&
    Array.isArray(obj.stylesheets)
  )
}

/**
 * Type guard to identify HostStylesObject (styles without class names).
 *
 * @param obj - Object to check
 * @returns True if object is a HostStylesObject
 *
 * @remarks
 * - Validates that classNames property is absent
 * - Used for host element styling (`:host` selector)
 * - Host styles never have classNames
 */
export const isHostStylesObject = (obj: unknown): obj is HostStylesObject => {
  /**
   * @internal
   * Validates HostStylesObject structure:
   * 1. isTypeOf confirms object type (not null/primitive)
   * 2. !Object.hasOwn ensures classNames is NOT present
   * 3. Object.hasOwn checks for stylesheets property
   * 4. Array.isArray validates stylesheets is array
   * The absence of classNames is the key discriminator from ElementStylesObject.
   */
  return (
    isTypeOf<{ [key: string]: unknown }>(obj, 'object') &&
    !Object.hasOwn(obj, 'classNames') &&
    Object.hasOwn(obj, 'stylesheets') &&
    Array.isArray(obj.stylesheets)
  )
}

/**
 * Type guard to identify any StylesObject (element or host styles).
 *
 * @param obj - Object to check
 * @returns True if object is a StylesObject (ElementStylesObject or HostStylesObject)
 *
 * @remarks
 * - Union type guard combining both element and host checks
 * - Useful when processing style objects of unknown type
 * - Delegates to specific guards for validation
 */
export const isStylesObject = (obj: unknown): obj is StylesObject => {
  /**
   * @internal
   * Union type guard implementation:
   * Combines isElementStylesObject and isHostStylesObject checks.
   * Returns true if obj matches either constituent type.
   * This approach is more maintainable than duplicating validation logic.
   */
  return isElementStylesObject(obj) || isHostStylesObject(obj)
}
