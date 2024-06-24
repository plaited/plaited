import { AssignStylesObject } from '../types.js'

export const assignStyles = (...styleObjects: Array<AssignStylesObject | undefined | false | null>) => {
  const cls: Array<string | undefined | false | null> = []
  const style: Array<string | undefined | false | null> = []
  for (const styleObject of styleObjects) {
    if (!styleObject) continue
    const { className, stylesheet } = styleObject
    className && cls.push(...(Array.isArray(className) ? className : [className]))
    stylesheet && style.push(...(Array.isArray(stylesheet) ? stylesheet : [stylesheet]))
  }
  return { className: cls, stylesheet: style }
}
