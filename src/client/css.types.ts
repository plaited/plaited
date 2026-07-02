import type { CSS_RESERVED_KEYS } from './css.constants.ts'
import type { CSSProperties } from './css.schemas.ts'

/**
 * Registry for inline $ref resolution.
 * Populated from saved catalog (JSONL) entries — how the registry is
 * populated (DB/query layer) is out of scope for this module.
 *
 * When no registry is provided and a $ref is encountered, the util throws
 * MissingRegistryError. The literal-only path (agent emits no refs) works
 * without a registry.
 *
 * @public
 */
export type CssRegistry = {
  /** Saved tokens by catalog id → { cssVar, stylesheets }. */
  tokens?: Map<string, { cssVar: `var(--${string})`; stylesheets: string[] }>
  /** Saved keyframes by catalog id → { id, stylesheets }. */
  keyframes?: Map<string, { id: string; stylesheets: string[] }>
}

/**
 * Type for defining nested CSS rules within a specific CSS property.
 * Allows specifying different values for a property based on conditions like
 * container queries, layer rules, media queries, supports queries, pseudo-classes,
 * attribute selectors, or compound host selectors.
 *
 */
export type NestedStatements = {
  /** The default value for the CSS property. */
  [CSS_RESERVED_KEYS.$default]?: CSSProperties[keyof CSSProperties]
  /** Compound host selectors — only valid within a `$host` block. */
  [CSS_RESERVED_KEYS.$compoundSelectors]?: {
    [key: string]: CSSProperties[keyof CSSProperties] | NestedStatements
  }
  /** Rules applied based on at-rules (container, layer, media, supports, view-transition, etc.). */
  [key: `@${string}`]: CSSProperties[keyof CSSProperties] | NestedStatements
  /** Rules applied based on pseudo-classes (e.g., :hover, :focus). Can be nested further. */
  [key: `:${string}`]: CSSProperties[keyof CSSProperties] | NestedStatements
  /** Rules applied based on attribute selectors (e.g., [disabled], [data-state="active"]). Can be nested further. */
  [key: `[${string}]`]: CSSProperties[keyof CSSProperties] | NestedStatements
}

/**
 * Defines CSS rules that can be applied to an element.
 * Extends CSS properties to support nested statements and custom property objects.
 */
export type CSSRules = {
  [key in keyof CSSProperties]: CSSProperties[key] | NestedStatements | string
}
/**
 * Defines a collection of CSS class definitions. Each key represents a class name,
 * and its value is an object containing CSS properties. Properties can have simple values,
 * nested rules defined by {@link NestedStatements}, or token references.
 *
 * Three reserved keys at the top level select special scoping:
 * - `$host` → `:host{...}` rules (no hashed class names)
 * - `$root` → `:root{...}` rules (no hashed class names)
 * - `$top`  → top-level at-rules, unwrapped (no hashed class names)
 */
export type CreateParams = {
  [key: string]: CSSRules | CSSProperties[keyof CSSProperties]
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
 * Union type representing any style object output from css functions.
 */
export type StylesObject = ElementStylesObject

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
 * Defines the structure for CSS `@keyframes` animations.
 * Allows specifying styles for different stages ('from', 'to', or percentage offsets) of an animation.
 */
export type CSSKeyFrames = {
  /** Styles applied at the beginning (0%) of the animation. */
  from?: {
    [key in keyof CSSProperties]: CSSProperties[key]
  }
  /** Styles applied at the end (100%) of the animation. */
  to?: {
    [key in keyof CSSProperties]: CSSProperties[key]
  }
  /** Styles applied at specific percentage points during the animation. */
  [key: `${number}%`]: {
    [key in keyof CSSProperties]: CSSProperties[key]
  }
}
/**
 * Represents a keyframe animation function returned by `createKeyframes`.
 * The function returns the keyframe stylesheets and has an 'id' property
 * for referencing the animation in CSS.
 */
export type StyleFunctionKeyframe = {
  (): ElementStylesObject
  id: string
}
