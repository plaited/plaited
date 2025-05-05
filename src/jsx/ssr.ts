import { escape } from '../utils/escape.js'
import { isTypeOf } from '../utils/is-type-of.js'
import type { TemplateObject } from './jsx.types.js'
import { VALID_PRIMITIVE_CHILDREN, TEMPLATE_OBJECT_IDENTIFIER } from './jsx.constants.js'

/**
 * Server-Side Rendering (SSR) for Plaited Templates
 *
 * Generates static HTML strings from Plaited template objects with automatic style injection
 * and security measures. Optimized for server-side environments and static generation.
 *
 * @param templates - One or more Plaited template objects to render
 * @returns HTML string with injected styles and processed content
 *
 * Key Features:
 * - Automatic style collection and deduplication
 * - Security-first content escaping
 * - Shadow DOM support
 * - Intelligent style injection
 * - Custom element registration tracking
 *
 * @example
 * Basic Page Rendering
 * ```ts
 * import { ssr, h } from 'plaited'
 *
 * const page = h('html', {
 *   children: [
 *     h('head', {
 *       children: h('title', { children: 'My Page' })
 *     }),
 *     h('body', {
 *       children: h('h1', { children: 'Hello World' })
 *     })
 *   ]
 * })
 *
 * const html = ssr(page)
 * ```
 *
 * @example
 * Component with Styles
 * ```ts
 * import { ssr, h } from 'plaited'
 * import { css } from 'plaited/styling'
 *
 * const styles = css.create({
 *   card: {
 *     padding: '1rem',
 *     borderRadius: '4px',
 *     boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
 *   }
 * })
 *
 * const Card = ({ children }) => h('div', {
 *   ...styles.card,
 *   children
 * })
 *
 * const html = ssr(
 *   h(Card, { children: 'Styled content' })
 * )
 * ```
 *
 * @example
 * Shadow DOM Components
 * ```ts
 * import { ssr, h } from 'plaited'
 *
 * const CustomElement = () => h('my-element', {
 *   children: h('template', {
 *     shadowrootmode: 'open',
 *     children: h('p', { children: 'Shadow content' })
 *   })
 * })
 *
 * const html = ssr(h(CustomElement))
 * ```
 *
 * @remarks
 * Style Injection Strategy:
 * 1. Collects styles from all template objects
 * 2. Deduplicates styles using Set
 * 3. Injects combined styles in optimal location:
 *    - Before </head> (preferred)
 *    - After <body> (fallback)
 *    - At start of document (last resort)
 *
 * Security Features:
 * - Automatic HTML escaping for primitive values
 * - XSS prevention through content sanitization
 * - Opt-in trusted content with `trusted` prop
 *
 * Processing Details:
 * 1. Templates are recursively processed
 * 2. Stylesheets are collected and deduplicated
 * 3. Content is escaped unless marked as trusted
 * 4. Custom element tags are registered
 * 5. Shadow DOM templates are preserved
 * 6. Final HTML string is assembled with injected styles
 *
 * Best Practices:
 * - Keep templates modular and composable
 * - Use CSS modules for style scoping
 * - Leverage shadow DOM for encapsulation
 * - Avoid inline scripts unless trusted
 * - Structure HTML with proper head/body tags
 */
export const ssr = (...templates: TemplateObject[]) => {
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
  const bodyRegex = /<body\b[^>]*>/i
  const bodyMatch = bodyRegex.exec(str)
  const bodyIndex = bodyMatch ? bodyMatch.index + bodyMatch[0].length : 0
  const index = headIndex !== -1 ? headIndex : bodyIndex
  return str.slice(0, index) + style + str.slice(index)
}
