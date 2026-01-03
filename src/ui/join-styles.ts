import type { DesignTokenReference, StylesObject } from './css.types.ts'
import { isTokenReference } from './css.utils.ts'

/**
 * Combines multiple style objects or design token references into a single unified style object.
 * Merges class names and stylesheets from all inputs, handling both element styles and token references.
 * Useful for composing styles from multiple sources or applying conditional styling.
 *
 * @param styleObjects - Variable number of style objects or design token references to combine
 * @returns Merged style object with combined classNames and stylesheets arrays
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
export const joinStyles = <T extends (StylesObject | DesignTokenReference | undefined)[]>(
  ...styleObjects: T
): T[number] => {
  const cls: string[] = []
  const style: string[] = []
  for (const styleObject of styleObjects) {
    if (!styleObject) continue
    if (isTokenReference(styleObject)) {
      style.push(...styleObject.stylesheets)
      continue
    }
    const { classNames, stylesheets } = styleObject
    classNames && cls.push(...classNames)
    style.push(...(Array.isArray(stylesheets) ? stylesheets : [stylesheets]))
  }
  return { classNames: cls, stylesheets: style }
}
