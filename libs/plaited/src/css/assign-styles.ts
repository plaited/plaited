import { StyleObject } from '../types.js'

export const assignStyles = (...styleObjects: Array<StyleObject | undefined | false | null>) => {
  const className = []
  const stylesheet: string[] = []
  for (const styleObject of styleObjects) {
    if (!styleObject) continue
    styleObject?.className && className.push(styleObject.className)
    styleObject?.stylesheet && stylesheet.push(...styleObject.stylesheet)
  }
  return { className: className.join(' '), stylesheet }
}
