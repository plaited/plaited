import { CSS_RESERVED_KEYS, CUSTOM_PROPERTY_OBJECT_IDENTIFIER } from './css.constants.js'
import type {
  CreateParams,
  CSSClasses,
  NestedStatements,
  CSSProperties,
  CreateHostParams,
  HostStylesObject,
  CSSKeyFrames,
  StyleFunctionKeyframe,
  StylesObject,
  DesignToken,
  CustomProperty,
  DesignTokenObject,
  DesignTokens,
  DesignTokenValueList,
  NestedTokenStatements,
  CreateTokens,
} from './css.types.js'
import { kebabCase, hashString, isTypeOf } from '../utils.js'

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
  set,
  hostSet,
  value,
  prop,
  selectors = [],
}: {
  set: Set<string>
  hostSet: Set<string>
  value: NestedStatements | CSSProperties[keyof CSSProperties]
  prop: string
  selectors?: string[]
}) => {
  if (isPrimitive(value)) {
    const rule = getRule(prop, value)
    if (!selectors.length) return set.add(`{${rule}}`)
    const arr = selectors.map((str) => (str.startsWith('@') ? `${str}{` : `&${str}{`))
    return set.add(`{${arr.join('')}${rule}${'}'.repeat(arr.length)}}`)
  }
  if (value === undefined) return
  const arr = Object.entries(value)
  const length = arr.length
  for (let i = 0; i < length; i++) {
    const [context, val] = arr[i]
    if (context === CSS_RESERVED_KEYS.$default || /^(:|\[|@)/.test(context)) {
      const nextSelectors = [...selectors]
      context !== CSS_RESERVED_KEYS.$default && nextSelectors.push(context)
      formatClassStatement({ set, value: val, prop, selectors: nextSelectors, hostSet })
    }
  }
}

/**
 * Creates atomic CSS classes from a style definition object.
 *
 * This function generates unique class names with hashed identifiers and returns
 * both the class names and their corresponding stylesheet strings. It supports
 * nested rules, media queries, pseudo-classes, attribute selectors, and CSS custom properties.
 *
 * @template T - The type of the style definitions object
 * @param {T} classNames - An object where keys are style names and values are CSS rule definitions
 * @returns {CSSClasses<T>} An object mapping each style name to its generated class names and stylesheets
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
const create = <T extends CreateParams>(classNames: T): CSSClasses<T> =>
  Object.entries(classNames).reduce((acc, [cls, props]) => {
    const set = new Set<string>()
    const hostSet = new Set<string>()
    for (const [prop, value] of Object.entries(props)) formatClassStatement({ set, prop, value, hostSet })
    const classes: string[] = []
    const stylesheet = [...hostSet]
    for (const sheet of set) {
      const cls = `cls${createHash(sheet)}`
      classes.push(cls)
      stylesheet.push(`.${cls}${sheet}`)
    }
    acc[cls as keyof T] = {
      className: [cls, ...classes],
      stylesheet,
    }
    return acc
  }, {} as CSSClasses<T>)

// host function (previously createHost in create-host.ts)
const formatHostStatement = ({
  set,
  prop,
  value,
  selectors = [],
  host,
}: {
  set: Set<string>
  prop: string
  value: CSSProperties[keyof CSSProperties] | NestedStatements
  selectors?: string[]
  host: string
}) => {
  if (isPrimitive(value)) {
    const arr = selectors.map((str) => `${str}{`)
    set.add(`${host}{${arr.join('')}${getRule(prop, value)}${'}'.repeat(arr.length)}}`)
    return
  }
  if (value === undefined) return
  for (const [key, val] of Object.entries(value)) {
    if (key === CSS_RESERVED_KEYS.$default) {
      formatHostStatement({
        set,
        prop,
        value: val,
        selectors,
        host,
      })
      continue
    }
    formatHostStatement({
      set,
      prop,
      value: val,
      selectors: [...selectors, key],
      host,
    })
  }
}

/**
 * Creates styles for Shadow DOM host elements using the :host pseudo-class.
 *
 * This function generates CSS rules that target the custom element itself from within
 * its shadow DOM. It supports nested rules, media queries, pseudo-classes, and compound
 * selectors for conditional host styling based on element state or attributes.
 *
 * @param {CreateHostParams} props - CSS properties and rules to apply to the host element
 * @returns {HostStylesObject} An object containing the generated stylesheet array
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
const host = (props: CreateHostParams): HostStylesObject => {
  const set = new Set<string>()
  for (const [prop, value] of Object.entries(props)) {
    if (isPrimitive(value)) {
      formatHostStatement({
        set,
        prop,
        value,
        host: ':host',
      })
      continue
    }

    const { $compoundSelectors, ...rest } = value
    formatHostStatement({
      set,
      prop,
      value: rest,
      host: ':host',
    })

    if ($compoundSelectors) {
      for (const [slector, value] of Object.entries($compoundSelectors)) {
        formatHostStatement({
          set,
          prop,
          value,
          host: `:host(${slector})`,
        })
      }
    }
  }
  return {
    stylesheet: [...set],
  }
}

// keyframes function (previously createKeyframes in create-keyframes.ts)
/**
 * Creates CSS keyframe animations with a unique, hashed identifier.
 *
 * This function generates a @keyframes rule with a deterministic name based on the
 * animation identifier and its content. The returned function can be called to get
 * the stylesheet, and includes an `id` property for referencing the animation.
 *
 * @param {string} ident - Base identifier for the animation (will be hashed for uniqueness)
 * @param {CSSKeyFrames} frames - Object defining keyframe steps with CSS properties
 * @returns {StyleFunctionKeyframe} A function that returns the stylesheet, with an `id` property
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
 * // Get the keyframes stylesheet
 * const { stylesheet } = fadeIn()
 * ```
 *
 * @see {@link create} for using animations in styles
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@keyframes
 */
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
  const getFrames = () => ({ stylesheet: [`@keyframes ${hashedIdent}{${arr.join('')}}`] })
  getFrames.id = hashedIdent
  return getFrames
}

// join function (previously in join.ts)
/**
 * Combines multiple style objects into a single style object.
 *
 * This utility function merges class names and stylesheets from multiple sources,
 * making it easy to compose styles from different style objects. It handles both
 * element styles (with classNames) and host styles (without classNames).
 *
 * @param {...StylesObject[]} styleObjects - Variable number of style objects to combine
 * @returns {StylesObject} A new style object with merged classNames and stylesheets
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
const join = (...styleObjects: StylesObject[]): StylesObject => {
  const cls: string[] = []
  const style: string[] = []
  for (const styleObject of styleObjects) {
    if (!styleObject) continue
    const { className, stylesheet } = styleObject
    className && cls.push(...className)
    style.push(...(Array.isArray(stylesheet) ? stylesheet : [stylesheet]))
  }
  return { className: cls, stylesheet: style }
}

// Design token utility functions
const isDesignToken = (prop: DesignToken | NestedTokenStatements): prop is DesignToken => {
  const length = Object.keys(prop).length
  if (length === 1) {
    return Object.hasOwn(prop, '$value')
  } else if (length === 2) {
    return Object.hasOwn(prop, '$value') && Object.hasOwn(prop, '$csv')
  } else {
    return false
  }
}

const isDesigntokenObject = (obj: unknown): obj is DesignTokenObject =>
  isTypeOf<Record<string, unknown>>(obj, 'object') && obj?.$ === CUSTOM_PROPERTY_OBJECT_IDENTIFIER

const handleTokenArray = ({
  stylesheet,
  $value,
  $csv,
}: {
  stylesheet: string[]
  $value: DesignTokenValueList['$value']
  $csv: DesignTokenValueList['$csv']
}) =>
  $value
    .map((val) => {
      if (isDesigntokenObject(val)) {
        stylesheet.push(...val.stylesheet)
        return val.variable
      }
      return `${val}`
    })
    .join($csv ? ',' : ' ')

const handleTokenObject = (obj: DesignTokenObject, stylesheet: string[]) => {
  stylesheet.push(...obj.stylesheet)
  return obj.variable
}

const getFunc = (func: string, value: string | number) => `${func}(${value})`

const formatTokenStatement = ({
  prop,
  token,
  selectors = [],
  stylesheet,
}: {
  prop: CustomProperty
  token: DesignToken | NestedTokenStatements
  selectors?: string[]
  stylesheet: string[]
}) => {
  if (isDesignToken(token)) {
    const { $csv, $value } = token
    const rule =
      isTypeOf<string>($value, 'string') || isTypeOf<number>($value, 'number') ? getRule(prop, $value)
      : isDesigntokenObject($value) ? getRule(prop, handleTokenObject($value, stylesheet))
      : Array.isArray($value) ? getRule(prop, handleTokenArray({ stylesheet, $value, $csv }))
      : Array.isArray($value.arguments) ?
        getRule(prop, getFunc($value.function, handleTokenArray({ stylesheet, $value: $value.arguments, $csv })))
      : isDesigntokenObject($value.arguments) ?
        getRule(prop, getFunc($value.function, handleTokenObject($value.arguments, stylesheet)))
      : getRule(prop, getFunc($value.function, $value.arguments))
    if (!selectors.length) {
      stylesheet.push(`:host{${rule}}`)
    } else {
      const arr = selectors.map((str) => (str.startsWith('@') ? `${str}{` : `&${str}{`))
      stylesheet.push(`:host{${arr.join('')}${rule}${'}'.repeat(arr.length)}}`)
    }
    return
  }
  for (const [key, value] of Object.entries(token)) {
    formatTokenStatement({
      prop,
      token: value,
      stylesheet,
      selectors: [...selectors, key],
    })
  }
}

/**
 * Creates design tokens with CSS custom properties for consistent theming.
 *
 * This function generates CSS custom properties (CSS variables) from a structured
 * token definition, supporting nested selectors, media queries, and contextual values.
 * Each token group creates scoped custom properties with automatic naming conventions.
 *
 * @template T - The type of the token definitions
 * @param {T} tokens - An object defining token groups and their values
 * @returns {DesignTokens<T>} An object mapping token paths to their generated custom properties
 *
 * @example
 * ```tsx
 * const theme = css.tokens({
 *   colors: {
 *     primary: { $value: '#007bff' },
 *     text: {
 *       $value: {
 *         $default: '#333',
 *         '@media (prefers-color-scheme: dark)': '#fff'
 *       }
 *     }
 *   },
 *   spacing: {
 *     small: { $value: '8px' },
 *     medium: { $value: '16px' },
 *     large: { $value: '24px' }
 *   }
 * })
 *
 * // Usage in styles
 * const styles = css.create({
 *   button: {
 *     backgroundColor: theme.colors.primary.variable,
 *     padding: theme.spacing.medium.variable
 *   }
 * })
 * ```
 */
const tokens = <T extends CreateTokens>(tokens: T): DesignTokens<T> =>
  Object.entries(tokens).reduce(
    (acc, [group, props]) => {
      const tokens: { [key: string]: DesignTokenObject } = {}
      for (const [key, token] of Object.entries(props)) {
        const prop: CustomProperty = `--${[kebabCase(group), kebabCase(key)].join('-')}`
        const stylesheet: string[] = []
        formatTokenStatement({
          prop,
          stylesheet,
          token,
        })
        tokens[key] = {
          $: CUSTOM_PROPERTY_OBJECT_IDENTIFIER,
          stylesheet,
          variable: `var(${prop})`,
        }
      }
      acc[group] = tokens
      return acc
    },
    {} as Record<string, { [key: string]: DesignTokenObject }>,
  ) as DesignTokens<T>

/**
 * CSS-in-JS utilities for Plaited framework.
 *
 * Provides a comprehensive set of functions for creating and managing styles
 * in Shadow DOM environments with atomic CSS generation.
 */
export const css = {
  create,
  host,
  keyframes,
  join,
  tokens,
}
