/**
 * @internal
 * @module ssr
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
 * Server-side renders Plaited templates to static HTML.
 * Collects styles, escapes content, and produces optimized HTML strings.
 *
 * @param templates - One or more Plaited template objects to render
 * @returns Complete HTML string with injected styles
 *
 * @remarks
 * Style injection:
 * - Collects all stylesheets
 * - Deduplicates via Set
 * - Injects before </head> or after <body>
 *
 * Security:
 * - Auto-escapes all content
 * - Prevents XSS attacks
 * - Trusted content requires explicit flag
 *
 * @see {@link h} for creating templates
 * @see {@link css} for styling
 */
export const ssr = (...templates: TemplateObject[]) => {
  /**
   * @internal
   * Main processing arrays:
   * - arr: Collected HTML fragments
   * - stylesheets: Deduplicated CSS strings
   */
  const arr = []
  const stylesheets = new Set<string>()
  const length = templates.length

  /**
   * @internal
   * Template processing loop:
   * 1. Valid TemplateObjects: Extract HTML and styles
   * 2. Primitive values: Escape and add as text
   * 3. Invalid types: Skip silently
   */
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
    const safeChild = htmlEscape(`${child}`)
    arr.push(safeChild)
  }

  /**
   * @internal
   * Style injection strategy:
   * 1. Combine all unique styles into single <style> tag
   * 2. Replace :host selectors with :root for SSR compatibility
   * 3. Find optimal injection point (head > body > start)
   * 4. Insert styles at calculated position
   *
   * Note: This approach ensures styles load before content renders
   * :host is replaced with :root because Shadow DOM doesn't exist in SSR
   * :host(<selector>) becomes :root<selector>
   */
  const style = stylesheets.size
    ? `<style>${[...stylesheets]
        .join('')
        .replaceAll(/:host\{/g, ':root{')
        .replaceAll(/:host\(([^)]+)\)/g, ':root$1')}</style>`
    : ''
  const str = arr.join('')

  /**
   * @internal
   * Injection point calculation:
   * - headIndex: Before </head> - ideal for style loading
   * - bodyIndex: After <body> opening - fallback for malformed HTML
   * - 0: Start of document - last resort
   */
  const headIndex = str.indexOf('</head>')
  const bodyRegex = /<body\b[^>]*>/i
  const bodyMatch = bodyRegex.exec(str)
  const bodyIndex = bodyMatch ? bodyMatch.index + bodyMatch[0].length : 0
  const index = headIndex !== -1 ? headIndex : bodyIndex

  return str.slice(0, index) + style + str.slice(index)
}
