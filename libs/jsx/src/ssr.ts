import { TemplateObject } from './types.js'

if (typeof global.HTMLElement === 'undefined') {
  // @ts-ignore node env
  global.HTMLElement = class HTMLElement {}
}

export const ssr = (...templates: TemplateObject[]) => {
  let str = ''
  const stylesheets = new Set<string>()
  const length = templates.length
  for (let i = 0; i < length; i++) {
    const child = templates[i]
    if (typeof child === 'string') {
      str += child
      continue
    }
    str += child.server
    for (const sheet of child.stylesheets) {
      stylesheets.add(sheet)
    }
  }
  const style = stylesheets.size ? `<style>${[...stylesheets].join('')}</style>` : ''

  const headIndex = str.indexOf('</head>')
  const bodyRegex = /<body\b[^>]*>/i
  const bodyMatch = bodyRegex.exec(str)
  const bodyIndex = bodyMatch ? bodyMatch.index + bodyMatch[0].length : 0

  const index = headIndex !== -1 ? headIndex : bodyIndex

  return str.slice(0, index) + style + str.slice(index)
}
