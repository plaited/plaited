import {
  Styles,
  createJSS,
  nestedJSS,
  camelJSS,
  globalJSS,
} from '../deps.ts'


const jss = createJSS()
jss.use(
  globalJSS(),
  nestedJSS(),
  camelJSS()
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
