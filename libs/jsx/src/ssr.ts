import { TemplateObject } from '@plaited/component-types'
import { escape, isTypeOf } from '../../../libs-cross-framework/utils/dist/index.js'
import { validPrimitiveChildren } from './constants.js'
if (typeof global.HTMLElement === 'undefined') {
  // @ts-ignore node env
  global.HTMLElement = class HTMLElement {}
}

export const ssr = (...templates: TemplateObject[]) => {
  const arr = []
  const stylesheets = new Set<string>()
  const length = templates.length
  for (let i = 0; i < length; i++) {
    const child = templates[i]
    if (isTypeOf<Record<string, unknown>>(child, 'object') && child.$ === '🦄') {
      arr.push(...child.server)
      for (const sheet of child.stylesheets) {
        stylesheets.add(sheet)
      }
      continue
    }
    if (!validPrimitiveChildren.has(typeof child)) continue
    const safeChild = escape(`${child}`)
    arr.push(safeChild)
  }
  const style = stylesheets.size ? `<style>${[...stylesheets].join('')}</style>` : ''
  const str = arr.join('')
  const headIndex = str.indexOf('</head>')
  const bodyRegex = /<body\b[^>]*>/i
  const bodyMatch = bodyRegex.exec(str)
  const bodyIndex = bodyMatch ? bodyMatch.index + bodyMatch[0].length : 0

  const index = headIndex !== -1 ? headIndex : bodyIndex

  return str.slice(0, index) + style + str.slice(index)
}
