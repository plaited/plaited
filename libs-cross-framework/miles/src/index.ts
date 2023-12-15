import { applyStylesheet } from './utils.js'
import { css as originalCss, Primitive } from '@plaited/jsx'

export const css = (
  strings: TemplateStringsArray,
  ...expressions: Array<Primitive | Primitive[]>
): Record<string, string> => applyStylesheet(originalCss(strings, ...expressions))

export { classNames, stylesheets } from '@plaited/jsx/utils'
