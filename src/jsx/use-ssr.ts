import { escape } from '../utils/escape.ts'
import { isTypeOf } from '../utils/is-type-of.ts'
import type { TemplateObject } from './jsx.types.ts'
import { VALID_PRIMITIVE_CHILDREN, TEMPLATE_OBJECT_IDENTIFIER } from './jsx.constants.ts'

export const useSSR =
  (...importPaths: string[]) =>
  (...templates: TemplateObject[]) => {
    const arr = []
    const stylesheets = new Set<string>()
    const length = templates.length
    for (let i = 0; i < length; i++) {
      const child = templates[i]
      if (isTypeOf<Record<string, unknown>>(child, 'object') && child.$ === TEMPLATE_OBJECT_IDENTIFIER) {
        arr.push(...child.html)
        for (const sheet of child.stylesheets) {
          stylesheets.add(sheet)
        }
        continue
      }
      if (!VALID_PRIMITIVE_CHILDREN.has(typeof child)) continue
      const safeChild = escape(`${child}`)
      arr.push(safeChild)
    }
    const style = stylesheets.size ? `<style>${[...stylesheets].join('')}</style>` : ''
    const str = arr.join('')
    const headIndex = str.indexOf('</head>')
    const startBodyRegex = /<body\b[^>]*>/i
    const startBodyMatch = startBodyRegex.exec(str)
    const startBodyIndex = startBodyMatch ? startBodyMatch.index + startBodyMatch[0].length : 0
    const endBodyRegex = /<\/body\b[^>]*>/i
    const endBodyMatch = endBodyRegex.exec(str)
    const endBodyIndex = endBodyMatch ? endBodyMatch.index : str.length
    const script =
      importPaths.length ?
        `<script type="module">${importPaths.map((path) => `import '${path}';`).join('\n')}</script>`
      : ''
    const index = headIndex !== -1 ? headIndex : startBodyIndex
    return str.slice(0, index) + style + str.slice(index, endBodyIndex) + script + str.slice(endBodyIndex)
  }
