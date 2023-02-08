// -- JSS --
import { create as createJSS, type Styles } from 'https://esm.sh/jss@10.9.2'
import { default as nestedJSS } from 'https://esm.sh/jss-plugin-nested@10.9.2'
import { default as camelJSS } from 'https://esm.sh/jss-plugin-camel-case@10.9.2'
import { default as globalJSS } from 'https://esm.sh/jss-plugin-global@10.9.2'

export const css = (style: Styles) => {
  const jss = createJSS()
  jss.use(
    globalJSS(),
    nestedJSS(),
    camelJSS(),
  )
  const sheet = jss.createStyleSheet(style)
  const stylesheet = sheet.toString()
  return {
    styles: sheet.classes,
    stylesheet,
  }
}

export { type Styles }
