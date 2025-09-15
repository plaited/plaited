import type { StylesObject, DesignTokenReference } from './css.types.js'
import { isTokenReference } from './css.utils.js'

// join style objects
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
