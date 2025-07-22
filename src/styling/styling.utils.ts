import { kebabCase, hashString } from '../utils.js'
import { CSS_RESERVED_KEYS } from './styling.constants.js'
import type { CSSProperties, NestedStatements } from './styling.types.js'
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

/**
 * @internal
 * Type guard to check if a value is a primitive CSS value (string or number).
 *
 * @param val - The value to test
 * @returns True if the value is a string or number
 */
export const isPrimitive = (val: string | number | unknown): val is string | number =>
  typeof val === 'string' || typeof val === 'number'

/**
 * @internal
 * Converts a CSS property name to kebab-case unless it's already a CSS variable (--*).
 *
 * @param prop - The property name to convert
 * @returns The kebab-cased property or unchanged CSS variable
 */
export const caseProp = (prop: string) => (prop.startsWith('--') ? prop : kebabCase(prop))

export const getProp = (prop: string, value: string | number) => `${caseProp(prop)}:${value};`
/**
 * @internal
 * Format NestedRule
 */
export const formatNestedRule = ({
  selector,
  key,
  map,
  rule,
  selectors,
}: {
  selector: string
  key: string
  map: Map<string, string>
  rule: string
  selectors: string[]
}) => {
  const arr = selectors.map((str) => (str.startsWith('@') ? `${str}{` : `&${str}{`))
  return map.set(key, `${selector}{${arr.join('')}${rule}${'}'.repeat(arr.length)}}`)
}

/**
 * @internal
 * Recursively processes nested CSS rules (like media queries, pseudo-classes)
 * defined in a `CreateNestedCSS` object, generating hashed class names and CSS rules,
 * and populating the provided map.
 *
 * @param map - A Map to store generated class names and their corresponding CSS rules
 * @param value - The CSS property value, which can be a primitive or a nested object
 * @param prop - The CSS property name (e.g., 'color', 'backgroundColor')
 * @param selectors - An array accumulating nested selectors (e.g., [':hover', '@media (...)'])
 */
export const formatClasses = ({
  map,
  value,
  prop,
  selectors = [],
}: {
  map: Map<string, string>
  value: NestedStatements<typeof prop> | CSSProperties[typeof prop]
  prop: string
  selectors?: string[]
}) => {
  if (isPrimitive(value)) {
    const key = `cls${createHash(prop, value, ...selectors)}`
    const selector = `.${key}`
    const rule = getProp(prop, value)
    if (!selectors.length) return map.set(key, `${selector}{${rule}}`)
    return formatNestedRule({ key, selector, map, rule, selectors })
  }
  const arr = Object.entries(value)
  const length = arr.length
  for (let i = 0; i < length; i++) {
    const [context, val] = arr[i]
    if (context === CSS_RESERVED_KEYS.$default || /^(:|\[|@)/.test(context)) {
      const nextSelectors = [...selectors]
      context !== CSS_RESERVED_KEYS.$default && nextSelectors.push(context)
      formatClasses({ map, value: val, prop, selectors: nextSelectors })
    }
  }
}
