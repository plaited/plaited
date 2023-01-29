import { Styles, create } from 'jss'
import nested from 'jss-plugin-nested'
import camel  from 'jss-plugin-camel-case'
import global  from 'jss-plugin-global'


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
