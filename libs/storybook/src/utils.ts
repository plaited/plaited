import type { TemplateObject, Attrs } from 'plaited'
import { kebabCase } from 'plaited/utils'

const cssCache = new WeakMap<Document, Set<string>>()

const adoptStylesheets = (...stylesheets: string[]) => {
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

  document.adoptedStyleSheets = [...document.adoptedStyleSheets, ...newStyleSheets]
}

// Create document fragment from template object
export const createFragment = (template: TemplateObject) => {
  const { client, stylesheets } = template
  if (stylesheets.size) {
    adoptStylesheets(...stylesheets)
  }
  const tpl = document.createElement('template')
  tpl.innerHTML = client.join('')
  return tpl.content
}

// Create story id from story set tile and story export name
export const toId = (title: string, name: string) => `${kebabCase(title)}--${kebabCase(name)}`

// Validate story title
export const isValidTitle = (title: string) => {
  const regex = /^[A-Za-z/]+$/
  const isValid = regex.test(title)
  if (!isValid) console.error(`Invalid Meta title [${title}]`)
  return isValid
}
const isEvent = (arg: string): arg is `on${string}` => arg.startsWith('on')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const filterAttrs = (args: Record<string, any>) => {
  const attrs: Attrs = {}
  const events: { [key: `on${string}`]: unknown } = {}
  for (const arg in args) {
    if (isEvent(arg)) {
      events[arg] = args[arg]
    } else {
      attrs[arg] = args[arg]
    }
  }
  return { attrs, events }
}

// Create JSX string from component name and attributes
export const createJSXString = (tagName: string, attrs: Attrs) => {
  const propsString = Object.entries(attrs)
    .map(([key, value]) => {
      if (typeof value === 'string') {
        return `${key}="${value}"`
      }
      return `${key}={${JSON.stringify(value)}}`
    })
    .join(' ')

  return `<${tagName} ${propsString} />`
}
