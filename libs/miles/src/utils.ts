import { css } from 'plaited/css'
import { canUseDOM } from '@plaited/utils'

const ready = canUseDOM()
const cssCache = new WeakMap<Document, Set<string>>()

export const adoptStylesheets = (...stylesheets: string[]) => {
  const instanceStyles =
    cssCache.get(document) ?? (cssCache.set(document, new Set<string>()).get(document) as Set<string>)
  const newStyleSheets: CSSStyleSheet[] = []
  for (const stylesheet of stylesheets) {
    if (instanceStyles?.has(stylesheet)) continue
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(stylesheet)
    instanceStyles.add(stylesheet)
    newStyleSheets.push(sheet)
  }
  // eslint-disable-next-line compat/compat
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, ...newStyleSheets]
}

export const applyStylesheet = (obj: ReturnType<typeof css>) => {
  const { $stylesheet, ...cls } = obj
  ready && adoptStylesheets($stylesheet)
  return cls
}
