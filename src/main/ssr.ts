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
import { escape, isTypeOf } from '../utils.js'
import type { TemplateObject } from './create-template.types.js'
import { VALID_PRIMITIVE_CHILDREN, TEMPLATE_OBJECT_IDENTIFIER } from './create-template.constants.js'

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
 * import { ssr, h, css } from 'plaited'
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
    const safeChild = escape(`${child}`)
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
