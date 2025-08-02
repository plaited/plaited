import type * as CSS from './types/css.js'
import { type CSS_RESERVED_KEYS, type CUSTOM_PROPERTY_OBJECT_IDENTIFIER } from './css.constants.js'

/**
 * Represents CSS properties with string or number values.
 * Extends standard CSS properties to allow for custom properties (e.g., CSS variables).
 *
 * @example
 * const styles: CSSProperties = {
 *   color: 'blue',
 *   fontSize: 16,
 *   '--custom-property': 'value',
 * };
 */
export type CSSProperties = CSS.Properties & {
  [key: string]: string | number
}

export type CustomProperty = `--${string}`

export type CSSVariable = `var(${CustomProperty})`

/**
 * Type for defining nested CSS rules within a specific CSS property.
 * Allows specifying different values for a property based on conditions like
 * container queries, layer rules, media queries, supports queries, pseudo-classes,
 * or attribute selectors.
 *
 * @template T The specific CSS property key (e.g., 'color', 'fontSize').
 * @example
 * const nestedColor: CreateNestedCSS<'color'> = {
 *   default: 'black',
 *   '@media (min-width: 768px)': 'darkgray',
 *   ':hover': 'red',
 *   '[disabled]': 'gray',
 * };
 */
export type NestedStatements = {
  /** The default value for the CSS property. */
  [CSS_RESERVED_KEYS.$default]?: CSSProperties[keyof CSSProperties] | DesignTokenObject
  /** Rules applied based on container queries, layers, media queries, or supports queries. */
  [key: `@${'container' | 'layer' | 'media' | 'supports'}${string}`]:
    | CSSProperties[keyof CSSProperties]
    | NestedStatements
    | DesignTokenObject
  /** Rules applied based on pseudo-classes (e.g., :hover, :focus). Can be nested further. */
  [key: `:${string}`]: CSSProperties[keyof CSSProperties] | NestedStatements | DesignTokenObject
  /** Rules applied based on attribute selectors (e.g., [disabled], [data-state="active"]). Can be nested further. */
  [key: `[${string}]`]: CSSProperties[keyof CSSProperties] | NestedStatements | DesignTokenObject
}

export type CSSRules = {
  [key in keyof CSSProperties]: CSSProperties[key] | NestedStatements | string | DesignTokenObject
}
/**
 * Defines a collection of CSS class definitions. Each key represents a class name,
 * and its value is an object containing CSS properties. Properties can have simple values,
 * nested rules defined by `CreateNestedCSS`, or string values (useful for CSS variables).
 *
 * @example
 * const myClasses: CSSSelectors = {
 *   button: {
 *     color: 'white',
 *     backgroundColor: {
 *       $default: 'blue',
 *       ':hover': 'darkblue',
 *     },
 *     padding: '10px 20px',
 *     border: 'var(--button-border)', // Using a CSS variable
 *   },
 *   // ... other class definitions
 * };
 */
export type CreateParams = {
  [key: string]: CSSRules
}

export type ElementStylesObject = {
  /** A single class name or an array of class names. */
  className: string[]
  /** A single CSS stylesheet string or an array of stylesheet strings. */
  stylesheet: string[]
}

export type HostStylesObject = {
  /** A single class name or an array of class names. */
  className?: never
  /** A single CSS stylesheet string or an array of stylesheet strings. */
  stylesheet: string[]
}

export type StylesObject = ElementStylesObject | HostStylesObject

export type CSSClasses<T extends CreateParams> = {
  [key in keyof T]: ElementStylesObject
}

type NestedHostStatements = NestedStatements & {
  [CSS_RESERVED_KEYS.$compoundSelectors]?: {
    [key: string]: CSSProperties[keyof CSSProperties] | NestedStatements | DesignTokenObject
  }
}

export type CreateHostParams = {
  [key in keyof CSSProperties]: CSSProperties[key] | DesignTokenObject | NestedHostStatements
}

/**
 * Defines the structure for CSS `@keyframes` animations.
 * Allows specifying styles for different stages ('from', 'to', or percentage offsets) of an animation.
 *
 * @example
 * const fadeIn: CSSKeyFrames = {
 *   from: { opacity: 0 },
 *   to: { opacity: 1 },
 * };
 *
 * const bounce: CSSKeyFrames = {
 *   '0%': { transform: 'translateY(0)' },
 *   '50%': { transform: 'translateY(-10px)' },
 *   '100%': { transform: 'translateY(0)' },
 * };
 */
export type CSSKeyFrames = {
  /** Styles applied at the beginning (0%) of the animation. */
  from?: { [key in keyof CSSProperties]: CSSProperties[key] }
  /** Styles applied at the end (100%) of the animation. */
  to?: { [key in keyof CSSProperties]: CSSProperties[key] }
  /** Styles applied at specific percentage points during the animation. */
  [key: `${number}%`]: { [key in keyof CSSProperties]: CSSProperties[key] }
}
/**
 * Represents basic style-related properties that can be applied to a component or element.
 * Allows specifying class names and/or raw CSS stylesheets. Undefined, null, or false values in arrays are ignored.
 *
 * @example
 * const elementStyles: StylesObject = {
 *   class: ['base-class', isActive && 'active-class'],
 *   stylesheet: [commonStyles, componentSpecificStyles],
 * };
 */

export type StyleFunctionKeyframe = {
  (): HostStylesObject
  id: string
}

export type DesignTokenValue = {
  $value: string | number | DesignTokenObject
  $csv: never
}

export type DesignTokenValueList = {
  $value: (string | number | DesignTokenObject)[]
  $csv: boolean
}

export type DesignTokenValueFunction = {
  $value: {
    function: string
    arguments: string | number | DesignTokenObject
  }
  $csv: never
}

export type DesignTokenValueFunctionList = {
  $value: {
    function: string
    arguments: (string | number | DesignTokenObject)[]
  }
  $csv: boolean
}

export type DesignToken =
  | DesignTokenValue
  | DesignTokenValueList
  | DesignTokenValueFunction
  | DesignTokenValueFunctionList

export type NestedTokenStatements = {
  /** The default value for the CSS property. */
  [CSS_RESERVED_KEYS.$default]?: DesignToken
  /** Rules applied based on container queries, layers, media queries, or supports queries. */
  [key: `@${'container' | 'layer' | 'media' | 'supports'}${string}`]: DesignToken | NestedTokenStatements
  /** Rules applied based on pseudo-classes (e.g., :hover, :focus). Can be nested further. */
  [key: `:${string}`]: DesignToken | NestedTokenStatements
  /** Rules applied based on attribute selectors (e.g., [disabled], [data-state="active"]). Can be nested further. */
  [key: `[${string}]`]: DesignToken | NestedTokenStatements
  [CSS_RESERVED_KEYS.$compoundSelectors]?: {
    [key: string]: NestedTokenStatements | DesignTokenObject
  }
}

export type DesignTokenGroup = {
  [key: string]: DesignToken | NestedTokenStatements
}

export type DesignTokenObject = {
  $: typeof CUSTOM_PROPERTY_OBJECT_IDENTIFIER
  variable: CSSVariable
  /** A single CSS stylesheet string or an array of stylesheet strings. */
  stylesheet: string[]
}

export type CreateTokens = {
  [key: string]: DesignTokenGroup
}

export type DesignTokens<T extends CreateTokens> = {
  [key in keyof T]: {
    [token in keyof T[key]]: DesignTokenObject
  }
}
