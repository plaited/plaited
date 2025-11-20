/**
 * @internal
 * @module ssr
 *
 * Purpose: Server-side rendering engine for Plaited templates, converting JSX to static HTML
 * Architecture: Single-pass template processor with style collection and injection
 * Dependencies: Utils for escaping and type checking, JSX types and constants
 * Consumers: Server applications, static site generators, build tools
 *
 * Maintainer Notes:
 * - This module is critical for SEO and initial page load performance
 * - No DOM APIs are used - must work in Node.js and edge environments
 * - Style injection strategy affects CSS loading order and specificity
 * - Escaping is mandatory for security - never bypass for user content
 * - Template processing is synchronous for predictable server behavior
 *
 * Common modification scenarios:
 * - Supporting streaming: Would require major refactor to iterative approach
 * - Custom style injection: Modify the index calculation logic
 * - Supporting CSS-in-JS libraries: Extend style collection mechanism
 * - Adding hydration markers: Insert data attributes during rendering
 *
 * Performance considerations:
 * - Single pass through templates minimizes memory usage
 * - Set deduplication prevents duplicate styles
 * - String concatenation is optimized by V8 for array joins
 * - No async operations for predictable performance
 *
 * Known limitations:
 * - No streaming support - entire HTML must fit in memory
 * - Style injection location is heuristic-based
 * - No source maps for debugging generated HTML
 * - Shadow DOM polyfills not included
 */
import { htmlEscape, isTypeOf } from '../utils.js'
import { TEMPLATE_OBJECT_IDENTIFIER, VALID_PRIMITIVE_CHILDREN } from './create-template.constants.js'
import type { TemplateObject } from './create-template.types.js'

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
   * 2. Find optimal injection point (head > body > start)
   * 3. Insert styles at calculated position
   *
   * Note: This approach ensures styles load before content renders
   */
  const style = stylesheets.size ? `<style>${[...stylesheets].join('')}</style>` : ''
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
