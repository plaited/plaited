/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Styles, create } from 'jss'
import _nested from 'jss-plugin-nested'
import _camel  from 'jss-plugin-camel-case'
import _global  from 'jss-plugin-global'
//@ts-ignore
const { default: nested } = _nested
//@ts-ignore
const { default: camel } = _camel
//@ts-ignore
const { default: global } = _global


const jss = create()
jss.use(
  global(),
  nested(),
  camel()
)

export const css = (style:Styles) => {
  const sheet = jss.createStyleSheet(style)
  const stylesheet = sheet.toString()
  return {
    styles: sheet.classes,
    stylesheet,
  }
}

export { Styles }
