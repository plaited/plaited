/**
 * @internal
 * @module create-ssr
 *
 * Server-side rendering engine for Plaited templates.
 * Converts JSX to static HTML with style collection and injection.
 *
 * @remarks
 * Implementation details:
 * - Single-pass template processor with style deduplication
 * - No DOM APIs - works in Node.js and edge environments
 * - Automatic HTML escaping for security
 * - Synchronous processing for predictable server behavior
 * - Style injection location is heuristic-based
 * - No source maps for debugging generated HTML
 * - Shadow DOM polyfills not included
 */
import { htmlEscape, isTypeOf } from '../utils.ts'
import { CONNECT_PLAITED_ROUTE, TEMPLATE_OBJECT_IDENTIFIER, VALID_PRIMITIVE_CHILDREN } from './template.constants.ts'
import { createTemplate } from './template.ts'
import type { CustomElementTag, TemplateObject } from './template.types.ts'

export const ssr = (templates: TemplateObject[]) => {
  const arr = []
  const adoptedStyleSheets = new Set<string>()
  const length = templates.length
  const registry: CustomElementTag[] = []
  for (let i = 0; i < length; i++) {
    const child = templates[i]
    if (isTypeOf<Record<string, unknown>>(child, 'object') && child.$ === TEMPLATE_OBJECT_IDENTIFIER) {
      arr.push(...child.html)
      for (const sheet of child.stylesheets) {
        if (adoptedStyleSheets.has(sheet)) continue
        adoptedStyleSheets.add(sheet)
      }
      registry.push(...child.registry)
      continue
    }
    if (!VALID_PRIMITIVE_CHILDREN.has(typeof child)) continue
    const safeChild = htmlEscape(`${child}`)
    arr.push(safeChild)
  }
  const src = `${CONNECT_PLAITED_ROUTE}?registry=${encodeURIComponent([...new Set(registry)].join(','))}`
  const connect = createTemplate('script', { src, type: 'module', async: true }).html.join('')
  const pre = adoptedStyleSheets.size
    ? `<style>${[...adoptedStyleSheets]
        .join('')
        .replaceAll(/:host\{/g, ':root{')
        .replaceAll(/:host\(([^)]+)\)/g, ':root$1')}</style>\n${connect}`
    : connect
  const str = arr.join('')

  const headIndex = str.indexOf('</head>')
  const bodyRegex = /<body\b[^>]*>/i
  const bodyMatch = bodyRegex.exec(str)
  const bodyIndex = bodyMatch ? bodyMatch.index + bodyMatch[0].length : 0
  const index = headIndex === -1 ? bodyIndex : headIndex

  return str.slice(0, index) + pre + str.slice(index)
}
