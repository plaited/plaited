import { escape } from '../utils/escape.js'
import { isTypeOf } from '../utils/is-type-of.js'
import type { TemplateObject } from './jsx.types.js'
import { VALID_PRIMITIVE_CHILDREN, TEMPLATE_OBJECT_IDENTIFIER } from './jsx.constants.js'
/**
 * Generates HTML string output for server-side rendering with style injection.
 * Combines multiple templates, handles style deduplication, and ensures proper HTML escaping.
 *
 * Features:
 * - Style deduplication
 * - Automatic style injection
 * - HTML escaping
 * - Template composition
 * - Head/body detection
 *
 * @param templates Array of template objects to render
 * @returns HTML string with injected styles
 *
 * @example Basic Usage
 * ```ts
 * const html = ssr(
 *   createTemplate('html', {}, [
 *     createTemplate('head', {}),
 *     createTemplate('body', {}, [
 *       MyComponent({ title: 'Hello' })
 *     ])
 *   ])
 * );
 * ```
 *
 * @example Style Injection
 * ```ts
 * // Styles are automatically collected and injected
 * const StyledComponent = defineTemplate({
 *   tag: 'styled-component',
 *   shadowDom: (
 *     <div class={styles.container}>
 *       Content
 *     </div>
 *   )
 * });
 *
 * const html = ssr(
 *   <html>
 *     <head />
 *     <body>
 *       <StyledComponent />
 *     </body>
 *   </html>
 * );
 * // Results in styles being injected inside template tag of styled-component
 * ```
 *
 * Style Injection Rules:
 * 1. Collects all unique styles from templates that are not part of plaited elements shadow dom
 * 2. Injects before </head> if found
 * 3. Injects after <body> if no </head>
 * 4. Injects before html template content if no <body> or </head>
 * 4. Deduplicates identical styles
 *
 * @remarks
 * - Handles nested template composition
 * - Safely escapes primitive values
 * - Skips invalid child types
 * - Maintains template object structure
 * - Optimizes style injection
 * - Preserves HTML structure
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
