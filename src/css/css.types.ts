import type { CSS_RESERVED_KEYS } from './css.constants.ts'
import type * as CSS from './types/css.js'

/**
 * Represents CSS properties with string or number values.
 * Extends standard CSS properties to allow for custom properties (e.g., CSS variables).
 *
 * @public
 */
export type CSSProperties = CSS.Properties & {
  [key: string]: string | number
}

/**
 * A callable reference to a CSS custom property created by `createTokens`.
 * When called, returns the `var(--css-variable-name)` expression.
 * The `stylesheets` array holds the `:root{}` declarations that define the variable.
 *
 * @remarks
 * Compose token references into styles by passing them to `createStyles`,
 * `createHostStyles`, or `joinStyles`. The style deduplication in `createSSR`
 * ensures each declaration is emitted only once per connection.
 *
 * @public
 */
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
 * nested rules defined by {@link NestedStatements}, or token references.
 */
export type CreateParams = {
  [key: string]: CSSRules
}

/**
 * Represents the output of `createStyles` for a single style definition.
 * Contains generated class names and their corresponding stylesheets.
 */
export type ElementStylesObject = {
  /** A single class name or an array of class names. */
  classNames: string[]
  /** Stylesheets generated for the style definition. */
  stylesheets: string[]
}

/**
 * Represents the output of `createHostStyles` for host element styling.
 * Contains only stylesheets because host styles do not produce class names.
 */
export type HostStylesObject = {
  /** A single class name or an array of class names. */
  classNames?: never
  /** Stylesheets generated for the host style definition. */
  stylesheets: string[]
}

/**
 * Union type representing any style object output from css functions.
 * Can be either element styles (with classes) or host styles (without classes).
 */
export type StylesObject = ElementStylesObject | HostStylesObject

/**
 * Maps style definition keys to their generated ElementStylesObject.
 * This is the return type of `createStyles`.
 *
 * @template T - The CreateParams type defining the input styles
 */
export type ClassNames<T extends CreateParams> = {
  [key in keyof T]: ElementStylesObject
}

/**
 * Defines the parameter structure for `createHostStyles`.
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
 * Defines the parameter structure for `createRootStyles`.
 * Extends CSS properties with support for nested statements and custom properties.
 */
export type CreateRootParams = {
  [key in keyof CSSProperties]: CSSProperties[key] | DesignTokenReference | NestedStatements
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
 * Represents a keyframe animation function returned by `createKeyframes`.
 * The function returns the keyframe stylesheets and has an 'id' property
 * for referencing the animation in CSS.
 */
export type StyleFunctionKeyframe = {
  (): HostStylesObject
  id: string
}

/**
 * Primitive value type accepted by design tokens — string or number.
 *
 * @public
 */
export type PrimitiveTokenValue = string | number

/** @internal Accepted argument types for CSS function tokens. */
type FunctionTokenArguments = PrimitiveTokenValue | DesignTokenReference

/**
 * A CSS function-based token value (e.g., `calc()`, `rgb()`, `clamp()`).
 * Specifies the function name, arguments, and whether arguments are comma-separated.
 *
 * @public
 */
export type FunctionTokenValue =
  | {
      $function: string
      $arguments: FunctionTokenArguments
      $csv?: never
    }
  | {
      $function: string
      $arguments: FunctionTokenArguments[]
      $csv: boolean
    }

/**
 * Union of all valid value types for a design token.
 *
 * @public
 */
export type DesignTokenValue = PrimitiveTokenValue | FunctionTokenValue | DesignTokenReference

/**
 * A design token with a single value or array of values.
 *
 * @public
 */
export type DesignToken =
  | {
      $value: DesignTokenValue
      $csv?: never
    }
  | {
      $value: DesignTokenValue[]
      $csv: boolean
    }

/**
 * A nested group of tokens for creating scales (e.g., sizes, colors).
 * Supports one level of nesting.
 */
export type DesignTokenScale = {
  [key: string]: DesignToken
}

/**
 * Defines a group of design tokens.
 * Tokens can be simple values or nested scales for organizing related values.
 */
export type DesignTokenGroup = {
  [key: string]: DesignToken | DesignTokenScale
}

/**
 * Maps a token group to reference functions.
 * For simple tokens, returns a DesignTokenReference.
 * For nested scales, returns an object mapping each key to a DesignTokenReference.
 */
export type DesignTokenReferences<T extends DesignTokenGroup> = {
  [K in keyof T]: T[K] extends DesignToken
    ? DesignTokenReference
    : T[K] extends DesignTokenScale
      ? { [SK in keyof T[K]]: DesignTokenReference }
      : never
}
