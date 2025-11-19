import type { StylesObject, DesignTokenReference } from './css.types.js'
import { isTokenReference } from './css.utils.js'

/**
 * Combines multiple style objects or design token references into a single unified style object.
 * Merges class names and stylesheets from all inputs, handling both element styles and token references.
 * Useful for composing styles from multiple sources or applying conditional styling.
 *
 * @param styleObjects - Variable number of style objects or design token references to combine
 * @returns Merged style object with combined classNames and stylesheets arrays
 *
 * @example Combining multiple style definitions
 * ```ts
 * const baseStyles = createStyles({
 *   base: {
 *     display: 'block',
 *     padding: '8px'
 *   }
 * });
 *
 * const interactiveStyles = createStyles({
 *   hover: {
 *     cursor: {
 *       $default: 'pointer',
 *       ':hover': 'grab'
 *     }
 *   }
 * });
 *
 * const combined = joinStyles(baseStyles.base, interactiveStyles.hover);
 * // Result: { classNames: [...all classes], stylesheets: [...all styles] }
 * ```
 *
 * @example Conditional style composition
 * ```ts
 * const button = createStyles({
 *   base: { padding: '10px', borderRadius: '4px' },
 *   primary: { backgroundColor: 'blue', color: 'white' },
 *   disabled: { opacity: 0.5, cursor: 'not-allowed' }
 * });
 *
 * const isPrimary = true;
 * const isDisabled = false;
 *
 * const buttonStyles = joinStyles(
 *   button.base,
 *   isPrimary && button.primary,
 *   isDisabled && button.disabled
 * );
 * ```
 *
 * @example Mixing tokens and styles
 * ```ts
 * const tokens = createTokens('theme', {
 *   spacing: { $value: '16px' }
 * });
 *
 * const componentStyles = createStyles({
 *   container: {
 *     display: 'flex',
 *     gap: '8px'
 *   }
 * });
 *
 * const mixed = joinStyles(tokens.spacing, componentStyles.container);
 * // Token styles are included in the stylesheets
 * ```
 *
 * @remarks
 * - Falsy values (undefined, null, false) are automatically filtered out
 * - Class names from all style objects are concatenated
 * - Stylesheets from all sources (including token references) are merged
 * - Design token references are resolved and their styles are included
 * - Order of style objects affects the order of class names and stylesheets
 *
 * @see {@link StylesObject} for the return type structure
 * @see {@link createStyles} for creating style objects
 * @see {@link createTokens} for creating design token references
 */
export const joinStyles = (...styleObjects: (StylesObject | DesignTokenReference)[]): StylesObject => {
  const cls: string[] = []
  const style: string[] = []
  for (const styleObject of styleObjects) {
    if (!styleObject) continue
    if (isTokenReference(styleObject)) {
      style.push(...styleObject.styles)
      continue
    }
    const { classNames, stylesheets } = styleObject
    classNames && cls.push(...classNames)
    style.push(...(Array.isArray(stylesheets) ? stylesheets : [stylesheets]))
  }
  return { classNames: cls, stylesheets: style }
}
