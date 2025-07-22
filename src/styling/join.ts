import type { StylesObjectWithClass, StylesObjectWithoutClass } from './styling.types.js'

export const join = (...styleObjects: Array<StylesObjectWithoutClass | StylesObjectWithClass>) => {
  const cls: string[] = []
  const style: string[] = []
  for (const styleObject of styleObjects) {
    if (!styleObject) continue
    const { class: className, stylesheet } = styleObject
    className && cls.push(...(Array.isArray(className) ? className : [className]))
    style.push(...(Array.isArray(stylesheet) ? stylesheet : [stylesheet]))
  }
  return { class: cls, stylesheet: style }
}
