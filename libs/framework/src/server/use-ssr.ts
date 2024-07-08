import { escape, isTypeOf } from '@plaited/utils'
import { TemplateObject } from '../types.js'
import { validPrimitiveChildren } from '../jsx/constants.js'

export const useSSR =
  (...importPaths: string[]) =>
  (...templates: TemplateObject[]) => {
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
    const script =
      importPaths.length ?
        `<script type="module" async>${importPaths.map((path) => `import '${path}';`).join('\n')}</script>`
      : ''
    const index = headIndex !== -1 ? headIndex : bodyIndex

    return str.slice(0, index) + script + style + str.slice(index)
  }
