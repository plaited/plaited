import { hashString, isTypeOf, kebabCase } from '../utils.ts'
import type { DesignTokenReference } from './css.types.ts'

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
