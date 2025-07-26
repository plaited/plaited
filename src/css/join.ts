import type { StylesObject } from './css.types.js'

export const join = (...styleObjects: StylesObject[]) => {
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
