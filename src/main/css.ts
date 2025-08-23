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
 * CSS-in-JS system for Plaited with atomic CSS generation and Shadow DOM support.
 * Provides type-safe style creation with automatic deduplication and scoping.
 *
 * @example Complete styling workflow
 * ```tsx
 * import { css, bElement } from 'plaited';
 *
 * // Create atomic CSS classes
 * const styles = css.create({
 *   card: {
 *     padding: '1rem',
 *     borderRadius: '8px',
 *     backgroundColor: {
 *       $default: 'white',
 *       ':hover': '#f5f5f5',
 *       '@media (prefers-color-scheme: dark)': '#1a1a1a'
 *     }
 *   },
 *   title: {
 *     fontSize: '1.5rem',
 *     marginBottom: '0.5rem'
 *   }
 * });
 *
 * // Style the host element
 * const hostStyles = css.host({
 *   display: 'block',
 *   margin: '1rem'
 * });
 *
 * // Create animations
 * const slideIn = css.keyframes('slideIn', {
 *   from: { transform: 'translateX(-100%)' },
 *   to: { transform: 'translateX(0)' }
 * });
 *
 * // Use in component
 * const Card = bElement({
 *   tag: 'my-card',
 *   shadowDom: (
 *     <div {...css.join(styles.card, hostStyles)}>
 *       <h2 {...styles.title} p-target="title" />
 *       <slot />
 *     </div>
 *   )
 * });
 * ```
 *
 * @remarks
 * Key features:
 * - Atomic CSS generation for optimal performance
 * - Automatic style deduplication
 * - Shadow DOM scoping
 * - TypeScript support
 * - Media query and pseudo-class support
 *
 * @see {@link bElement} for component creation
 */
export const css = {
  /**
   * Creates atomic CSS classes from style definitions.
   * Generates unique class names with hashed identifiers for optimal performance.
   *
   * @template T Style definitions type
   * @param classNames Object mapping style names to CSS properties
   * @returns Object with generated class names and stylesheets
   *
   * @example Basic styles
   * ```tsx
   * const styles = css.create({
   *   button: {
   *     padding: '10px 20px',
   *     borderRadius: '4px',
   *     cursor: 'pointer'
   *   }
   * });
   * ```
   *
   * @example Responsive design
   * ```tsx
   * const styles = css.create({
   *   container: {
   *     width: {
   *       $default: '100%',
   *       '@media (min-width: 768px)': '750px',
   *       '@media (min-width: 1024px)': '960px',
   *       '@media (min-width: 1280px)': '1140px'
   *     }
   *   }
   * });
   * ```
   *
   * @example Interactive states
   * ```tsx
   * const styles = css.create({
   *   link: {
   *     color: {
   *       $default: 'blue',
   *       ':hover': 'darkblue',
   *       ':active': 'navy',
   *       ':visited': 'purple',
   *       ':focus': {
   *         '@media (prefers-reduced-motion: no-preference)': 'blue'
   *       }
   *     }
   *   }
   * });
   * ```
   *
   * @example CSS variables
   * ```tsx
   * const styles = css.create({
   *   themed: {
   *     '--primary-color': 'blue',
   *     backgroundColor: 'var(--primary-color)',
   *     color: 'var(--text-color, black)'
   *   }
   * });
   * ```
   *
   * @see {@link host} for host element styling
   * @see {@link join} for combining styles
   */
  create,
  /**
   * Styles Shadow DOM host elements using :host pseudo-class.
   * Targets the custom element itself from within its shadow DOM.
   *
   * @param props CSS properties for the host element
   * @returns Object containing generated stylesheets
   *
   * @example Basic host styling
   * ```tsx
   * const hostStyles = css.host({
   *   display: 'block',
   *   padding: '1rem',
   *   borderRadius: '4px'
   * });
   * ```
   *
   * @example Conditional host styling
   * ```tsx
   * const hostStyles = css.host({
   *   opacity: {
   *     $compoundSelectors: {
   *       '[disabled]': '0.5',
   *       ':state(loading)': '0.7',
   *       '.highlighted': '1'
   *     }
   *   }
   * });
   * ```
   *
   * @example Theme-aware host
   * ```tsx
   * const hostStyles = css.host({
   *   backgroundColor: {
   *     $default: 'white',
   *     '@media (prefers-color-scheme: dark)': '#1a1a1a'
   *   },
   *   color: {
   *     $default: 'black',
   *     '@media (prefers-color-scheme: dark)': 'white'
   *   }
   * });
   * ```
   *
   * @see {@link create} for regular CSS classes
   */
  host,
  /**
   * Creates CSS keyframe animations with a unique, hashed identifier.
   * Generates deterministic animation names for reliable cross-component usage.
   *
   * @param ident - Base identifier for the animation (will be hashed for uniqueness)
   * @param frames - Object defining keyframe steps with CSS properties
   * @returns Function that returns stylesheets, with an `id` property for referencing
   *
   * @example Simple fade animation
   * ```tsx
   * const fadeIn = css.keyframes('fadeIn', {
   *   from: { opacity: 0 },
   *   to: { opacity: 1 }
   * });
   * 
   * const styles = css.create({
   *   element: {
   *     animation: `${fadeIn.id} 0.3s ease-in`
   *   }
   * });
   * ```
   *
   * @example Complex multi-step animation
   * ```tsx
   * const bounce = css.keyframes('bounce', {
   *   '0%': { transform: 'translateY(0)' },
   *   '25%': { transform: 'translateY(-20px)' },
   *   '50%': { transform: 'translateY(0)' },
   *   '75%': { transform: 'translateY(-10px)' },
   *   '100%': { transform: 'translateY(0)' }
   * });
   * ```
   *
   * @example Loading spinner
   * ```tsx
   * const spin = css.keyframes('spin', {
   *   from: { transform: 'rotate(0deg)' },
   *   to: { transform: 'rotate(360deg)' }
   * });
   * 
   * const spinner = css.create({
   *   loader: {
   *     width: '40px',
   *     height: '40px',
   *     border: '4px solid #f3f3f3',
   *     borderTop: '4px solid #3498db',
   *     borderRadius: '50%',
   *     animation: `${spin.id} 1s linear infinite`
   *   }
   * });
   * ```
   *
   * @see {@link create} for using animations
   */
  keyframes,
  /**
   * Combines multiple style objects into a single style object.
   * Merges class names and stylesheets for flexible style composition.
   *
   * @param styleObjects - Variable number of style objects to combine
   * @returns New style object with merged classNames and stylesheets
   *
   * @example Composing button styles
   * ```tsx
   * const base = css.create({
   *   button: {
   *     padding: '10px 20px',
   *     borderRadius: '4px',
   *     cursor: 'pointer'
   *   }
   * });
   * 
   * const variants = css.create({
   *   primary: { backgroundColor: 'blue', color: 'white' },
   *   secondary: { backgroundColor: 'gray', color: 'black' },
   *   large: { fontSize: '18px', padding: '15px 30px' }
   * });
   * 
   * // Compose styles based on props
   * const buttonStyles = css.join(
   *   base.button,
   *   isPrimary ? variants.primary : variants.secondary,
   *   isLarge && variants.large
   * );
   * ```
   *
   * @example Conditional styling
   * ```tsx
   * const getCardStyles = (isActive: boolean, isError: boolean) => 
   *   css.join(
   *     styles.card,
   *     isActive && styles.active,
   *     isError && styles.error,
   *     hostStyles
   *   );
   * ```
   *
   * @example Merging with animations
   * ```tsx
   * const fadeIn = css.keyframes('fadeIn', {
   *   from: { opacity: 0 },
   *   to: { opacity: 1 }
   * });
   * 
   * const animated = css.create({
   *   fade: { animation: `${fadeIn.id} 0.3s` }
   * });
   * 
   * const combined = css.join(
   *   styles.element,
   *   animated.fade,
   *   fadeIn()
   * );
   * ```
   *
   * @see {@link create} for creating style objects
   * @see {@link host} for host styles
   */
  join,
}
