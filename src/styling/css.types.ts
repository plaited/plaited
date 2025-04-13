import type * as CSS from './types/css.js'

/**
 * Represents CSS properties with string or number values.
 * Extends standard CSS properties to allow for custom properties.
 */
export type CSSProperties = CSS.Properties<string | number> & {
  [key: string]: string | number
}
/**
 * Type for nested CSS rules including container, layer, media queries, and pseudo-selectors.
 * @template T The CSS property key being nested
 */
export type CreateNestedCSS<T extends keyof CSSProperties> = {
  default?: CSSProperties[T]
  [key: `@${'container' | 'layer' | 'media' | 'supports'}${string}`]: CSSProperties[T]
  [key: `:${string}`]: CSSProperties[T] | CreateNestedCSS<T>
  [key: `[${string}`]: CSSProperties[T] | CreateNestedCSS<T>
}
/**
 * Defines a collection of CSS classes with their properties and nested rules.
 * Allows for complex CSS structures with nested selectors and media queries.
 */
export type CSSClasses = {
  [key: string]: {
    [key in keyof CSSProperties]: CSSProperties[key] | CreateNestedCSS<key> | string
  }
}

type CreateHostCSSWithSelector<T extends keyof CSSProperties> = {
  [key: string]: CSSProperties[T]
}
/**
 * Type for CSS properties that can be applied to host elements with custom selectors.
 * Used for styling shadow DOM host elements.
 */
export type CSSHostProperties = {
  [key in keyof CSSProperties]: CSSProperties[key] | CreateHostCSSWithSelector<key>
}
/**
 * Defines the structure for CSS @keyframes animations.
 * Supports percentage-based keyframes and from/to syntax.
 */
export type CSSKeyFrames = {
  from?: { [key in keyof CSSProperties]: CSSProperties[key] }
  to?: { [key in keyof CSSProperties]: CSSProperties[key] }
  [key: `${number}%`]: { [key in keyof CSSProperties]: CSSProperties[key] }
}
/**
 * Basic style properties for components.
 * Handles both class names and stylesheets with nullable values.
 */
export type StylesObject = {
  className?: string | Array<string | undefined | false | null>
  stylesheet?: string | Array<string | undefined | false | null>
}
/**
 * Maps CSS class definitions to their compiled representation.
 * Provides both class names and associated stylesheets.
 * @template T The CSS classes configuration
 */
export type StyleObjects<T extends CSSClasses> = {
  [key in keyof T]: {
    className: string
    stylesheet: string[]
  }
}
