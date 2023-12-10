import { css as originalCss, Primitive } from '@plaited/jsx'
import { canUseDOM } from '@plaited/utils'
import { adoptStylesheets } from './adopt-stylesheets.js'

const ready = canUseDOM()
export const css = (
  strings: TemplateStringsArray,
  ...expressions: Array<Primitive | Primitive[]>
): Record<string, string> => {
  const { $stylesheet, ...cls } = originalCss(strings, ...expressions)
  if (ready) adoptStylesheets($stylesheet)
  return cls
}
