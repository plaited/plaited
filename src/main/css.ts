import type {
  CSSProperties,
  CSSHostProperties,
  CSSKeyFrames,
  CSSClasses,
  CreateNestedCSS,
  StyleObjects,
  StylesObject,
} from './css.types.js'
import { kebabCase, hashString } from '../utils.js'

/**
 * @internal
 * Helper function to create a deterministic hash for class names based on style properties and selectors.
 *
 * @param args - The strings and numbers to hash together
 * @returns A base36 hash string prefixed with underscore if negative
 */
const createClassHash = (...args: (string | number)[]) =>
  hashString(args.join(' '))?.toString(36).replace(/^-/g, '_') ?? ''

/**
 * @internal
 * Type guard to check if a value is a primitive CSS value (string or number).
 *
 * @param val - The value to test
 * @returns True if the value is a string or number
 */
const isPrimitive = (val: string | number | CreateNestedCSS<string>): val is string | number =>
  typeof val === 'string' || typeof val === 'number'

/**
 * @internal
 * Converts a CSS property name to kebab-case unless it's already a CSS variable (--*).
 *
 * @param prop - The property name to convert
 * @returns The kebab-cased property or unchanged CSS variable
 */
const caseProp = (prop: string) => (prop.startsWith('--') ? prop : kebabCase(prop))

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
const formatStyles = ({
  map,
  value,
  prop,
  selectors = [],
}: {
  map: Map<string, string>
  value: CreateNestedCSS<typeof prop> | CSSProperties[typeof prop]
  prop: string
  selectors?: string[]
}) => {
  if (isPrimitive(value)) {
    const hash = createClassHash(prop, value, ...selectors)
    const className = `p${hash}`
    const rule = `${caseProp(prop)}:${value};`
    if (!selectors.length) return map.set(className, `.${className}{${rule}}`)
    const arr = selectors.map((str) => (str.startsWith('@') ? `${str}{` : `&${str}{`))
    return map.set(className, `.${className}{${arr.join('')}${rule}${'}'.repeat(arr.length)}}`)
  }
  const arr = Object.entries(value)
  const length = arr.length
  for (let i = 0; i < length; i++) {
    const [context, val] = arr[i]
    if (context === 'default' || /^(:|\[|(@(container|layer|media|supports)))/.test(context)) {
      const nextSelectors = [...selectors]
      context !== 'default' && nextSelectors.push(context)
      formatStyles({ map, value: val, prop, selectors: nextSelectors })
    }
  }
}

const create = <T extends CSSClasses>(classNames: T) =>
  Object.entries(classNames).reduce((acc, [cls, props]) => {
    const map = new Map<string, string>()
    for (const prop in props) formatStyles({ map, prop, value: props[prop] })
    const classes = [...map.keys()]
    const hash = createClassHash(...classes)
    acc[cls as keyof T] = {
      class: [`${cls}_${hash}`, ...classes].join(' '),
      stylesheet: [...map.values()],
    }
    return acc
  }, {} as StyleObjects<T>)

const host = (props: CSSHostProperties) => {
  const arr: string[] = []
  for (const prop in props) {
    const value = props[prop]
    if (isPrimitive(value)) {
      arr.push(`:host{${caseProp(prop)}:${value};}`)
      continue
    }
    for (const selector in value) {
      if (selector === 'default') {
        arr.push(`:host{${caseProp(prop)}:${value[selector]};}`)
        continue
      }
      arr.push(`:host(${selector}){${caseProp(prop)}:${value[selector]};}`)
    }
  }
  return { stylesheet: [...arr] }
}

const keyframes = (name: string, frames: CSSKeyFrames) => {
  const arr: string[] = []
  for (const value in frames) {
    const props = frames[value as keyof typeof frames]
    const step = []
    for (const prop in props) {
      step.push(`${caseProp(prop)}:${props[prop]};`)
    }
    arr.push(`${value}{${step.join('')}}`)
  }
  const hashedName = `${name}_${createClassHash(...arr)}`
  const getFrames = () => ({ stylesheet: `@keyframes ${hashedName}{${arr.join('')}}` })
  getFrames.id = hashedName
  return getFrames
}

const join = (...styleObjects: Array<StylesObject>) => {
  const cls: string[] = []
  const style: string[] = []
  for (const styleObject of styleObjects) {
    if (!styleObject) continue
    const { class: className, stylesheet } = styleObject
    className && cls.push(...(Array.isArray(className) ? className : [className]))
    stylesheet && style.push(...(Array.isArray(stylesheet) ? stylesheet : [stylesheet]))
  }
  return { class: cls, stylesheet: style }
}

/**
 * CSS-in-JS system for Plaited applications providing type-safe, atomic styles with Shadow DOM support.
 *
 * The `css` namespace offers utilities for creating scoped styles, animations, and conditional styling
 * that integrate seamlessly with Plaited's component system. All styles are automatically deduplicated
 * and optimized for minimal CSS output.
 *
 * @example Basic usage
 * ```tsx
 * const styles = css.create({
 *   button: { padding: '8px 16px', borderRadius: '4px' }
 * });
 *
 * const Button = bElement({
 *   tag: 'my-button',
 *   shadowDom: <button {...styles.button}>Click me</button>
 * });
 * ```
 *
 * @remarks
 * - Generates deterministic, collision-free class names using content-based hashing
 * - Supports nested selectors (pseudo-classes, media queries, attribute selectors)
 * - Integrates with Shadow DOM via Constructable Stylesheets
 * - Provides zero-runtime CSS generation with full TypeScript support
 */
export const css = {
  /**
   * Creates atomic style objects with generated class names from CSS property definitions.
   * Supports nested selectors for responsive design, pseudo-classes, and conditional styling.
   *
   * @param classNames - Style definitions where keys are logical names and values are CSS properties
   * @returns Style objects containing generated class names and CSS rules
   *
   * @example Basic styles
   * ```tsx
   * const styles = css.create({
   *   button: {
   *     padding: '8px 16px',
   *     backgroundColor: 'blue',
   *     color: 'white'
   *   }
   * });
   * // Usage: <button {...styles.button}>Click</button>
   * ```
   *
   * @example With nested selectors
   * ```tsx
   * const styles = css.create({
   *   card: {
   *     padding: '16px',
   *     ':hover': {
   *       boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
   *     },
   *     '@media (max-width: 768px)': {
   *       padding: '8px'
   *     }
   *   }
   * });
   * ```
   *
   * @example Complex property nesting
   * ```tsx
   * const styles = css.create({
   *   text: {
   *     fontSize: {
   *       default: '16px',
   *       '@media (min-width: 1024px)': '18px',
   *       ':hover': '17px'
   *     }
   *   }
   * });
   * ```
   */
  create,
  /**
   * Creates `:host` styles for Shadow DOM components with support for conditional styling
   * based on host attributes, classes, or states.
   *
   * @param props - CSS properties for the host element
   * @returns Style object containing :host CSS rules
   *
   * @example
   * ```tsx
   * const hostStyles = css.host({
   *   display: 'block',
   *   padding: '16px',
   *   border: {
   *     default: '1px solid #ccc',
   *     ':hover': '1px solid #999',
   *     '[disabled]': '1px solid #eee'
   *   }
   * });
   *
   * // Usage in component
   * bElement({
   *   tag: 'my-element',
   *   shadowDom: <div {...hostStyles}>Content</div>
   * });
   * ```
   */
  host,
  /**
   * Creates a reusable CSS animation with a unique, hashed name.
   * Returns a function that generates the @keyframes rule and exposes the animation ID.
   *
   * @param name - Base name for the animation (e.g., 'fadeIn', 'slide')
   * @param frames - Keyframe definitions with percentages or from/to keywords
   * @returns Function with `id` property containing the unique animation name
   *
   * @example
   * ```tsx
   * // Define animation
   * const fadeIn = css.keyframes('fadeIn', {
   *   from: { opacity: 0 },
   *   to: { opacity: 1 }
   * });
   *
   * // Use in styles
   * const styles = css.create({
   *   animated: {
   *     animationName: fadeIn.id,
   *     animationDuration: '300ms'
   *   }
   * });
   *
   * // Apply both styles and keyframes
   * <div {...css.join(styles.animated, fadeIn())} />
   * ```
   */
  keyframes,
  /**
   * Combines multiple style objects into one, supporting conditional application.
   * Falsy values are ignored, enabling clean conditional styling patterns.
   *
   * @param styleObjects - Style objects to merge (falsy values are skipped)
   * @returns Combined style object with merged classes and stylesheets
   *
   * @example Conditional styles
   * ```tsx
   * const styles = css.create({
   *   base: { padding: '8px' },
   *   primary: { backgroundColor: 'blue' },
   *   disabled: { opacity: 0.5 }
   * });
   *
   * const Button = ({ isPrimary, isDisabled }) => (
   *   <button {...css.join(
   *     styles.base,
   *     isPrimary && styles.primary,
   *     isDisabled && styles.disabled
   *   )}>Click</button>
   * );
   * ```
   */
  join,
}
