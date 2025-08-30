import type { DesignTokenReference } from './css.types.js'
import { kebabCase, hashString, isTypeOf } from '../utils.js'

// Utility functions (previously in css.utils.ts)
/**
 * @internal
 * Helper function to create a deterministic hash for class names based on style properties and selectors.
 *
 * @param args - The strings and numbers to hash together
 * @returns A base36 hash string prefixed with underscore if negative
 */
export const createHash = (...args: (string | number)[]) => {
  const hash = hashString(args.join(' '))?.toString(36)!.replace(/^-/g, '_')
  return hash?.startsWith('_') ? hash : `_${hash}`
}

const caseProp = (prop: string) => (prop.startsWith('--') ? prop : kebabCase(prop))

export const getRule = (prop: string, value: string | number) => `${caseProp(prop)}:${value};`

export const isTokenReference = (ref: unknown): ref is DesignTokenReference =>
  isTypeOf<DesignTokenReference>(ref, 'function')
