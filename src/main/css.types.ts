import type * as CSS from './types/css.js'

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
export type CSSProperties = CSS.Properties<string | number> & {
  [key: string]: string | number
}
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
export type CreateNestedCSS<T extends keyof CSSProperties> = {
  /** The default value for the CSS property. */
  default?: CSSProperties[T]
  /** Rules applied based on container queries, layers, media queries, or supports queries. */
  [key: `@${'container' | 'layer' | 'media' | 'supports'}${string}`]: CSSProperties[T]
  /** Rules applied based on pseudo-classes (e.g., :hover, :focus). Can be nested further. */
  [key: `:${string}`]: CSSProperties[T] | CreateNestedCSS<T>
  /** Rules applied based on attribute selectors (e.g., [disabled], [data-state="active"]). Can be nested further. */
  [key: `[${string}]`]: CSSProperties[T] | CreateNestedCSS<T>
}
/**
 * Defines a collection of CSS class definitions. Each key represents a class name,
 * and its value is an object containing CSS properties. Properties can have simple values,
 * nested rules defined by `CreateNestedCSS`, or string values (useful for CSS variables).
 *
 * @example
 * const myClasses: CSSClasses = {
 *   button: {
 *     color: 'white',
 *     backgroundColor: {
 *       default: 'blue',
 *       ':hover': 'darkblue',
 *     },
 *     padding: '10px 20px',
 *     border: 'var(--button-border)', // Using a CSS variable
 *   },
 *   // ... other class definitions
 * };
 */
export type CSSClasses = {
  [key: string]: {
    [key in keyof CSSProperties]: CSSProperties[key] | CreateNestedCSS<key> | string
  }
}

/**
 * Helper type for defining CSS properties specific to a host element selector.
 * @template T The specific CSS property key.
 * @internal
 */
type CreateHostCSSWithSelector<T extends keyof CSSProperties> = {
  /** A CSS selector targeting the host or related elements. */
  [key: string]: CSSProperties[T]
}
/**
 * Type for CSS properties applied to a component's host element (relevant in Shadow DOM).
 * Allows defining styles directly on the host or conditionally based on selectors applied to the host.
 *
 * @example
 * const hostStyles: CSSHostProperties = {
 *   display: 'block',
 *   border: {
 *     ':host([hidden])': 'none', // Style when host has 'hidden' attribute
 *     ':host(.focused)': '1px solid blue', // Style when host has 'focused' class
 *   },
 * };
 */
export type CSSHostProperties = {
  [key in keyof CSSProperties]: CSSProperties[key] | CreateHostCSSWithSelector<key>
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
export type StylesObject = {
  /** A single class name or an array of class names. */
  class?: string | Array<string>
  /** A single CSS stylesheet string or an array of stylesheet strings. */
  stylesheet?: string | Array<string>
}
/**
 * Maps CSS class definitions to their compiled representation.
 * Provides both class names and associated stylesheets. This is typically the
 * shape of the object returned by `css.create()`.
 *
 * @template T - The type of the input `CSSClasses` object.
 *
 * @example
 * ```ts
 * const myComponentStyles = css.create({
 *   button: {
 *     color: 'blue',
 *     padding: '10px',
 *   },
 *   container: {
 *     margin: 'auto',
 *   }
 * });
 * // myComponentStyles would conform to:
 * // StyleObjects<{ button: { color: string; padding: string; }; container: { margin: string; } }>
 * // And its value would look like:
 * // {
 * //   button: { class: 'plaited-css-xxxxxx', stylesheet: ['.plaited-css-xxxxxx { color: blue; padding: 10px; }'] },
 * //   container: { class: 'plaited-css-yyyyyy', stylesheet: ['.plaited-css-yyyyyy { margin: auto; }'] }
 * // }
 *
 * // Usage in a component:
 * const MyComponent = () => h('div', {
 *   ...myComponentStyles.container, // Spreads class and stylesheet
 *   children: h('button', {
 *     ...myComponentStyles.button,
 *     children: 'Click me'
 *   })
 * });
 * ```
 */
export type StyleObjects<T extends CSSClasses> = {
  [key in keyof T]: {
    /** The generated unique class name for the style definition. */
    class: string
    /** An array containing the generated CSS stylesheet strings. */
    stylesheet: string[]
  }
}
