import { TemplateObject } from '@plaited/types'
import { escape, isTypeOf } from '@plaited/utils'
import { validPrimitiveChildren } from '@plaited/jsx/utils'
import { camelCase } from '@plaited/utils'
import { Database } from 'bun:sqlite'

if (typeof global.HTMLElement === 'undefined') {
  // @ts-ignore node env
  global.HTMLElement = class HTMLElement {}
}

const importTemplate = (arr: [string, string][]) => `
await Promise.all(${JSON.stringify(arr, null, 2)}.map(async ([tag, path])=> {
  try {
    const modules = await import(path)
    modules[tag].define()
  } catch (err) {
    console.error(err)
  }
}))
`

export const useSSR =
  (db: Database, table: string) =>
  (...templates: TemplateObject[]) => {
    const arr = []
    const stylesheets = new Set<string>()
    const importMap: [string, string][] = []

    const length = templates.length
    for (let i = 0; i < length; i++) {
      const child = templates[i]
      if (isTypeOf<Record<string, unknown>>(child, 'object') && child.$ === '🦄') {
        arr.push(...child.server)
        for (const sheet of child.stylesheets) {
          stylesheets.add(sheet)
        }

        for (const { tag } of child.registry) {
          const query = db.query(`SELECT path FROM ${table} WHERE tag = $tag`)
          const result = query.get({ $tag: tag }) as { path: string }
          result?.path && importMap.push([camelCase(tag), result.path])
        }
        continue
      }
      if (!validPrimitiveChildren.has(typeof child)) continue
      const safeChild = escape(`${child}`)
      arr.push(safeChild)
    }

    const style = stylesheets.size ? `<style>${[...stylesheets].join('')}</style>` : ''
    const script = importMap.length ? `<script type="module" async>${importTemplate(importMap)}</script>` : ''
    const str = arr.join('')
    const headIndex = str.indexOf('</head>')
    const bodyRegex = /<body\b[^>]*>/i
    const bodyMatch = bodyRegex.exec(str)
    const bodyIndex = bodyMatch ? bodyMatch.index + bodyMatch[0].length : 0

    const index = headIndex !== -1 ? headIndex : bodyIndex

    return str.slice(0, index) + script + style + str.slice(index)
  }
