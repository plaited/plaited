import { CSS_RESERVED_KEYS } from './css.constants.js'
import type {
  CreateParams,
  ClassNames,
  NestedStatements,
  CSSProperties,
  CreateHostParams,
  HostStylesObject,
  CSSKeyFrames,
  StyleFunctionKeyframe,
  StylesObject,
} from './css.types.js'
import { kebabCase, hashString } from '../utils.js'

// Utility functions (previously in css.utils.ts)
/**
 * @internal
 * Helper function to create a deterministic hash for class names based on style properties and selectors.
 *
 * @param args - The strings and numbers to hash together
 * @returns A base36 hash string prefixed with underscore if negative
 */
const createHash = (...args: (string | number)[]) => {
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
const isPrimitive = (val: string | number | unknown): val is string | number =>
  typeof val === 'string' || typeof val === 'number'

/**
 * @internal
 * Converts a CSS property name to kebab-case unless it's already a CSS variable (--*).
 *
 * @param prop - The property name to convert
 * @returns The kebab-cased property or unchanged CSS variable
 */
const caseProp = (prop: string) => (prop.startsWith('--') ? prop : kebabCase(prop))

const getRule = (prop: string, value: string | number) => `${caseProp(prop)}:${value};`

const formatClassStatement = ({
  styles,
  value,
  prop,
  selectors = [],
}: {
  styles: string[]
  value: NestedStatements | CSSProperties[keyof CSSProperties]
  prop: string
  selectors?: string[]
}) => {
  if (isPrimitive(value)) {
    const rule = getRule(prop, value)
    const arr = selectors.map((str) => (str.startsWith('@') ? `${str}{` : `&${str}{`))
    return styles.push(`{${arr.join('')}${rule}${'}'.repeat(arr.length)}}`)
  }
  const arr = Object.entries(value)
  const length = arr.length
  for (let i = 0; i < length; i++) {
    const [context, val] = arr[i]
    if (context === CSS_RESERVED_KEYS.$default || /^(:|\[|@)/.test(context)) {
      const nextSelectors = [...selectors]
      context !== CSS_RESERVED_KEYS.$default && nextSelectors.push(context)
      formatClassStatement({ styles, value: val, prop, selectors: nextSelectors })
    }
  }
}

const create = <T extends CreateParams>(classNames: T): ClassNames<T> =>
  Object.entries(classNames).reduce((acc, [cls, props]) => {
    const styles: string[] = []
    for (const [prop, value] of Object.entries(props)) formatClassStatement({ styles, prop, value })
    const classes: string[] = []
    const stylesheets: string[] = []
    for (const sheet of styles) {
      const cls = `cls${createHash(sheet)}`
      classes.push(cls)
      stylesheets.push(`.${cls}${sheet}`)
    }
    acc[cls as keyof T] = {
      classNames: [cls, ...classes],
      stylesheets,
    }
    return acc
  }, {} as ClassNames<T>)

// host function (previously createHost in create-host.ts)
const formatHostStatement = ({
  styles,
  prop,
  value,
  selectors = [],
  host,
}: {
  styles: string[]
  prop: string
  value: CSSProperties[keyof CSSProperties] | NestedStatements
  selectors?: string[]
  host: string
}) => {
  if (isPrimitive(value)) {
    const arr = selectors.map((str) => `${str}{`)
    styles.push(`${host}{${arr.join('')}${getRule(prop, value)}${'}'.repeat(arr.length)}}`)
    return
  }
  for (const [key, val] of Object.entries(value)) {
    if (key === CSS_RESERVED_KEYS.$default) {
      formatHostStatement({
        styles,
        prop,
        value: val,
        selectors,
        host,
      })
      continue
    }
    formatHostStatement({
      styles,
      prop,
      value: val,
      selectors: [...selectors, key],
      host,
    })
  }
}

const host = (props: CreateHostParams): HostStylesObject => {
  const styles: string[] = []
  for (const [prop, value] of Object.entries(props)) {
    if (isPrimitive(value)) {
      formatHostStatement({
        styles,
        prop,
        value,
        host: ':host',
      })
      continue
    }

    // Check if value is an object and has $compoundSelectors property
    const { $compoundSelectors, ...rest } = value
    if (Object.keys(rest).length) {
      formatHostStatement({
        styles,
        prop,
        value: rest,
        host: ':host',
      })
    }

    if ($compoundSelectors) {
      for (const [slector, value] of Object.entries($compoundSelectors)) {
        formatHostStatement({
          styles,
          prop,
          value,
          host: `:host(${slector})`,
        })
      }
    }
  }

  return {
    stylesheets: styles,
  }
}

// keyframes function (previously createKeyframes in create-keyframes.ts)
const keyframes = (ident: string, frames: CSSKeyFrames): StyleFunctionKeyframe => {
  const arr: string[] = []
  for (const [value, props] of Object.entries(frames)) {
    const step = []
    for (const [prop, val] of Object.entries(props)) {
      step.push(getRule(prop, val))
    }
    arr.push(`${value}{${step.join('')}}`)
  }
  const hashedIdent = ident + createHash(...arr)
  const getFrames = () => ({ stylesheets: [`@keyframes ${hashedIdent}{${arr.join('')}}`] })
  getFrames.id = hashedIdent
  return getFrames
}

// join style objects
const join = (...styleObjects: StylesObject[]): StylesObject => {
  const cls: string[] = []
  const style: string[] = []
  for (const styleObject of styleObjects) {
    if (!styleObject) continue
    const { classNames, stylesheets } = styleObject
    classNames && cls.push(...classNames)
    style.push(...(Array.isArray(stylesheets) ? stylesheets : [stylesheets]))
  }
  return { classNames: cls, stylesheets: style }
}

/**
 * CSS-in-JS utilities for Plaited framework.
 *
 * Provides a comprehensive set of functions for creating and managing styles
 * in Shadow DOM environments with atomic CSS generation.
 */
export const css = {
  /**
   * Creates atomic CSS classes from a style definition object.
   *
   * This function generates unique class names with hashed identifiers and returns
   * both the class names and their corresponding stylesheets strings. It supports
   * nested rules, media queries, pseudo-classes, attribute selectors, and CSS custom properties.
   *
   * @template T - The type of the style definitions object
   * @param {T} classNames - An object where keys are style names and values are CSS rule definitions
   * @returns {ClassNames<T>} An object mapping each style name to its generated class names and stylesheetss
   *
   * @example
   * ```tsx
   * const styles = css.create({
   *   button: {
   *     backgroundColor: 'blue',
   *     color: 'white',
   *     padding: '10px 20px',
   *     borderRadius: '4px',
   *     // Pseudo-class support
   *     backgroundColor: {
   *       $default: 'blue',
   *       ':hover': 'darkblue',
   *       ':active': 'navy'
   *     }
   *   },
   *   responsiveText: {
   *     fontSize: {
   *       $default: '14px',
   *       '@media (min-width: 768px)': '16px',
   *       '@media (min-width: 1024px)': '18px'
   *     }
   *   }
   * })
   *
   * // Usage in JSX
   * <button {...styles.button}>Click me</button>
   * ```
   *
   * @see {@link host} for styling Shadow DOM host elements
   * @see {@link join} for combining multiple style objects
   *
   */
  create,
  /**
   * Creates styles for Shadow DOM host elements using the :host pseudo-class.
   *
   * This function generates CSS rules that target the custom element itself from within
   * its shadow DOM. It supports nested rules, media queries, pseudo-classes, and compound
   * selectors for conditional host styling based on element state or attributes.
   *
   * @param {CreateHostParams} props - CSS properties and rules to apply to the host element
   * @returns {HostStylesObject} An object containing the generated stylesheets array
   *
   * @example
   * ```tsx
   * const hostStyles = css.host({
   *   display: 'block',
   *   padding: '20px',
   *   backgroundColor: {
   *     $default: 'white',
   *     ':hover': 'lightgray',
   *     '@media (prefers-color-scheme: dark)': 'black'
   *   },
   *   // Compound selectors for conditional styling
   *   color: {
   *     $compoundSelectors: {
   *       '[disabled]': 'gray',
   *       '.dark-theme': 'white',
   *       ':state(expanded)': 'blue'
   *     }
   *   }
   * })
   *
   * // Generated CSS includes:
   * // :host { display: block; padding: 20px; }
   * // :host { background-color: white; }
   * // :host:hover { background-color: lightgray; }
   * // :host([disabled]) { color: gray; }
   * // :host(.dark-theme) { color: white; }
   * ```
   *
   * @see {@link create} for creating regular CSS classes
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/:host
   */
  host,
  /**
   * Creates CSS keyframe animations with a unique, hashed identifier.
   *
   * This function generates a @keyframes rule with a deterministic name based on the
   * animation identifier and its content. The returned function can be called to get
   * the stylesheets, and includes an `id` property for referencing the animation.
   *
   * @param {string} ident - Base identifier for the animation (will be hashed for uniqueness)
   * @param {CSSKeyFrames} frames - Object defining keyframe steps with CSS properties
   * @returns {StyleFunctionKeyframe} A function that returns the stylesheets, with an `id` property
   *
   * @example
   * ```tsx
   * const fadeIn = css.keyframes('fadeIn', {
   *   from: { opacity: 0 },
   *   to: { opacity: 1 }
   * })
   *
   * const bounce = css.keyframes('bounce', {
   *   '0%': { transform: 'translateY(0)' },
   *   '50%': { transform: 'translateY(-20px)' },
   *   '100%': { transform: 'translateY(0)' }
   * })
   *
   * // Use in styles
   * const styles = css.create({
   *   animated: {
   *     animation: `${fadeIn.id} 0.3s ease-in`,
   *     // or
   *     animationName: bounce.id,
   *     animationDuration: '1s',
   *     animationIterationCount: 'infinite'
   *   }
   * })
   *
   * // Get the keyframes stylesheets
   * const { stylesheets } = fadeIn()
   * ```
   *
   * @see {@link create} for using animations in styles
   * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@keyframes
   */
  keyframes,
  /**
   * Combines multiple style objects into a single style object.
   *
   * This utility function merges class names and stylesheetss from multiple sources,
   * making it easy to compose styles from different style objects. It handles both
   * element styles (with classNames) and host styles (without classNames).
   *
   * @param {...StylesObject[]} styleObjects - Variable number of style objects to combine
   * @returns {StylesObject} A new style object with merged classNames and stylesheetss
   *
   * @example
   * ```tsx
   * const buttonBase = css.create({
   *   base: {
   *     padding: '10px 20px',
   *     borderRadius: '4px',
   *     cursor: 'pointer'
   *   }
   * })
   *
   * const buttonVariants = css.create({
   *   primary: {
   *     backgroundColor: 'blue',
   *     color: 'white'
   *   },
   *   large: {
   *     fontSize: '18px',
   *     padding: '15px 30px'
   *   }
   * })
   *
   * const hostStyles = css.host({
   *   display: 'inline-block'
   * })
   *
   * // Combine multiple styles
   * const buttonStyles = css.join(
   *   buttonBase.base,
   *   buttonVariants.primary,
   *   buttonVariants.large,
   *   hostStyles
   * )
   *
   * // Use in JSX
   * <button {...buttonStyles}>Click me</button>
   * ```
   *
   * @see {@link create} for creating style objects
   * @see {@link host} for creating host style objects
   */
  join,
}
