import type { CSS_RESERVED_KEYS } from './css.constants.ts'
import type * as CSS from './types/css.js'

/**
 * Represents CSS properties with string or number values.
 * Extends standard CSS properties to allow for custom properties (e.g., CSS variables).
 */
export type CSSProperties = CSS.Properties & {
  [key: string]: string | number
}

export type DesignTokenReference = {
  (): `var(--${string})`
  stylesheets: string[]
}

/**
 * Type for defining nested CSS rules within a specific CSS property.
 * Allows specifying different values for a property based on conditions like
 * container queries, layer rules, media queries, supports queries, pseudo-classes,
 * or attribute selectors.
 *
 * @template T The specific CSS property key (e.g., 'color', 'fontSize').
 */
export type NestedStatements = {
  /** The default value for the CSS property. */
  [CSS_RESERVED_KEYS.$default]?: CSSProperties[keyof CSSProperties] | DesignTokenReference
  /** Rules applied based on container queries, layers, media queries, or supports queries. */
  [key: `@${'container' | 'layer' | 'media' | 'supports'}${string}`]:
    | CSSProperties[keyof CSSProperties]
    | NestedStatements
    | DesignTokenReference
  /** Rules applied based on pseudo-classes (e.g., :hover, :focus). Can be nested further. */
  [key: `:${string}`]: CSSProperties[keyof CSSProperties] | NestedStatements | DesignTokenReference
  /** Rules applied based on attribute selectors (e.g., [disabled], [data-state="active"]). Can be nested further. */
  [key: `[${string}]`]: CSSProperties[keyof CSSProperties] | NestedStatements | DesignTokenReference
}

/**
 * Defines CSS rules that can be applied to an element.
 * Extends CSS properties to support nested statements and custom property objects.
 */
export type CSSRules = {
  [key in keyof CSSProperties]: CSSProperties[key] | NestedStatements | string | DesignTokenReference
}
/**
 * Defines a collection of CSS class definitions. Each key represents a class name,
 * and its value is an object containing CSS properties. Properties can have simple values,
 * nested rules defined by `CreateNestedCSS`, or string values (useful for CSS variables).
 */
export type CreateParams = {
  [key: string]: CSSRules
}

/**
 * Represents the output of css.create() for a single style definition.
 * Contains generated class names and their corresponding stylesheetss.
 */
export type ElementStylesObject = {
  /** A single class name or an array of class names. */
  classNames: string[]
  /** A single CSS stylesheets string or an array of stylesheets strings. */
  stylesheets: string[]
}

/**
 * Represents the output of css.host() for host element styling.
 * Contains only stylesheetss as host elements don't use class names.
 */
export type HostStylesObject = {
  /** A single class name or an array of class names. */
  classNames?: never
  /** A single CSS stylesheets string or an array of stylesheets strings. */
  stylesheets: string[]
}

/**
 * Union type representing any style object output from css functions.
 * Can be either element styles (with classes) or host styles (without classes).
 */
export type StylesObject = ElementStylesObject | HostStylesObject

/**
 * Maps style definition keys to their generated ElementStylesObject.
 * This is the return type of css.create().
 *
 * @template T - The CreateParams type defining the input styles
 */
export type ClassNames<T extends CreateParams> = {
  [key in keyof T]: ElementStylesObject
}

/**
 * Defines the parameter structure for css.host().
 * Extends CSS properties with support for nested statements, custom properties,
 * and compound selectors for conditional host styling.
 */
export type CreateHostParams = {
  [key in keyof CSSProperties]:
    | CSSProperties[key]
    | DesignTokenReference
    | (NestedStatements & {
        [CSS_RESERVED_KEYS.$compoundSelectors]?: {
          [key: string]: CSSProperties[keyof CSSProperties] | NestedStatements | DesignTokenReference
        }
      })
}

/**
 * Defines the structure for CSS `@keyframes` animations.
 * Allows specifying styles for different stages ('from', 'to', or percentage offsets) of an animation.
 */
export type CSSKeyFrames = {
  /** Styles applied at the beginning (0%) of the animation. */
  from?: {
    [key in keyof CSSProperties]: CSSProperties[key] | DesignTokenReference
  }
  /** Styles applied at the end (100%) of the animation. */
  to?: {
    [key in keyof CSSProperties]: CSSProperties[key] | DesignTokenReference
  }
  /** Styles applied at specific percentage points during the animation. */
  [key: `${number}%`]: {
    [key in keyof CSSProperties]: CSSProperties[key] | DesignTokenReference
  }
}
/**
 * Represents basic style-related properties that can be applied to a component or element.
 * Allows specifying class names and/or raw CSS stylesheetss. Undefined, null, or false values in arrays are ignored.
 */

/**
 * Represents a keyframe animation function returned by css.keyframes().
 * The function returns the keyframe stylesheets and has an 'id' property
 * for referencing the animation in CSS.
 */
export type StyleFunctionKeyframe = {
  (): HostStylesObject
  id: string
}

export type PrimitiveTokenValue = string | number

type FunctionTokenArguments = PrimitiveTokenValue | DesignTokenReference

export type FunctionTokenValue =
  | {
      $function: string
      $arguments: FunctionTokenArguments
      $csv: never
    }
  | {
      $function: string
      $arguments: FunctionTokenArguments[]
      $csv: boolean
    }

export type DesignTokenValue = PrimitiveTokenValue | FunctionTokenValue | DesignTokenReference

export type DesignToken =
  | {
      $value: DesignTokenValue
      $csv?: never
    }
  | {
      $value: DesignTokenValue[]
      $csv: boolean
    }

export type NestedDesignTokenStatements = {
  /** The default value for the CSS property. */
  [CSS_RESERVED_KEYS.$default]?: DesignToken
  /** Rules applied based on container queries, layers, media queries, or supports queries. */
  [key: `@${'container' | 'layer' | 'media' | 'supports'}${string}`]: DesignToken | NestedDesignTokenStatements
  /** Rules applied based on pseudo-classes (e.g., :hover, :focus). Can be nested further. */
  [key: `:${string}`]: DesignToken
  /** Rules applied based on attribute selectors (e.g., [disabled], [data-state="active"]). Can be nested further. */
  [key: `[${string}]`]: DesignToken
}

export type DesignTokenGroup = {
  [key: string]:
    | DesignToken
    | (NestedDesignTokenStatements & {
        [CSS_RESERVED_KEYS.$compoundSelectors]?: {
          [key: string]: DesignToken | NestedDesignTokenStatements
        }
      })
}

export type DesignTokenReferences<T extends DesignTokenGroup> = {
  [key in keyof T]: DesignTokenReference
}
