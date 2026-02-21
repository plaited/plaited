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
import { TEMPLATE_OBJECT_IDENTIFIER, VALID_PRIMITIVE_CHILDREN } from './create-template.constants.ts'
import type { TemplateObject } from './create-template.types.ts'

/**
 * @internal
 * Assembles HTML from templates, deduplicating styles against a shared Set.
 * Styles already present in `sent` are skipped — only fresh styles are emitted.
 */
const renderTemplates = (sent: Set<string>, templates: TemplateObject[]) => {
  const arr = []
  const fresh: string[] = []
  const length = templates.length

  for (let i = 0; i < length; i++) {
    const child = templates[i]
    if (isTypeOf<Record<string, unknown>>(child, 'object') && child.$ === TEMPLATE_OBJECT_IDENTIFIER) {
      arr.push(...child.html)
      for (const sheet of child.stylesheets) {
        if (sent.has(sheet)) continue
        fresh.push(sheet)
        sent.add(sheet)
      }
      continue
    }
    if (!VALID_PRIMITIVE_CHILDREN.has(typeof child)) continue
    const safeChild = htmlEscape(`${child}`)
    arr.push(safeChild)
  }

  const style = fresh.length
    ? `<style>${fresh
        .join('')
        .replaceAll(/:host\{/g, ':root{')
        .replaceAll(/:host\(([^)]+)\)/g, ':root$1')}</style>`
    : ''
  const str = arr.join('')

  const headIndex = str.indexOf('</head>')
  const bodyRegex = /<body\b[^>]*>/i
  const bodyMatch = bodyRegex.exec(str)
  const bodyIndex = bodyMatch ? bodyMatch.index + bodyMatch[0].length : 0
  const index = headIndex !== -1 ? headIndex : bodyIndex

  return str.slice(0, index) + style + str.slice(index)
}

/**
 * Creates a stateful renderer with per-connection style deduplication.
 *
 * @returns Object with `render` and `clearStyles` methods
 *
 * @remarks
 * Use one `createSSR` instance per WebSocket connection. The first
 * `render` call emits all styles; subsequent calls only emit styles not
 * yet sent on this connection. Call `clearStyles` when the connection
 * closes or when you need to re-send all styles.
 *
 * Style injection:
 * - Collects all stylesheets across renders
 * - Deduplicates via persistent Set
 * - Replaces `:host` with `:root` for SSR compatibility
 * - Injects before `</head>` or after `<body>`
 *
 * Security:
 * - Auto-escapes all content
 * - Prevents XSS attacks
 * - Trusted content requires explicit flag
 *
 * @see {@link h} for creating templates
 * @see {@link css} for styling
 *
 * @public
 */
export const createSSR = () => {
  const sent = new Set<string>()
  return {
    render(...templates: TemplateObject[]) {
      return renderTemplates(sent, templates)
    },
    clearStyles() {
      sent.clear()
    },
  }
}
