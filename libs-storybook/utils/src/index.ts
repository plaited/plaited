import type { TemplateObject } from '@plaited/component-types'
import { kebabCase } from '@plaited/utils'

export const cssCache = new WeakMap<Document, Set<string>>()
export const createFragment = (template: TemplateObject) => {
  const { client, stylesheets } = template
  if (stylesheets.size) {
    const instanceStyles =
      cssCache.get(document) ?? (cssCache.set(document, new Set<string>()).get(document) as Set<string>)
    const newStyleSheets: CSSStyleSheet[] = []
    for (const style of stylesheets) {
      if (instanceStyles?.has(style)) continue
      const sheet = new CSSStyleSheet()
      sheet.replaceSync(style)
      newStyleSheets.push(sheet)
    }
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, ...newStyleSheets]
  }
  const tpl = document.createElement('template')
  tpl.innerHTML = client.join('')
  return tpl.content
}

// Create story id from story set tile and story export name
export const toId = (title: string, name: string) => `${kebabCase(title)}--${kebabCase(name)}`

export const isValidTitle = (title: string) => {
  const regex = /^[A-Za-z/]+$/
  const isValid = regex.test(title)
  if (!isValid) console.error(`Invalid Meta title [${title}]`)
  return isValid
}
