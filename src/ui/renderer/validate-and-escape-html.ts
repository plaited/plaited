import { getNodeSchema } from '../html.schemas.ts'

/**
 * Validate and sanitize an HTML string for SSR rendering.
 *
 * @remarks
 * Transformer: HTML string in → validated + sanitized HTML string out, via Bun
 * {@link HTMLRewriter}. For every element: (1) block `on*` inline event handler
 * attributes — a security violation (events must use the `p-trigger`
 * declarative system); (2) validate attributes against the per-tag schema via
 * {@link getNodeSchema}. All violations across all elements are collected and
 * thrown as a single aggregate {@link HtmlValidationError}.
 *
 * MINIMAL: text content is not escaped here. HTMLRewriter's text handler yields
 * already-serialized content with entities preserved (verified), so re-escaping
 * would double-escape legitimate entities (`&amp;` → `&amp;amp;`). Text safety
 * belongs at build time (the hyperscript `h()` builder), not in a string
 * transformer. Attributes are the safe escape surface: HTMLRewriter's
 * `setAttribute` serializes attribute values (escaping `"`), and `on*` blocking
 * is the security floor. Use `Bun.escapeHTML` (native, faster than the JS
 * `htmlEscape`) if a future builder path needs value escaping.
 *
 * @public
 */

/**
 * One validation violation found in the HTML string.
 *
 * @public
 */
type HtmlError = {
  /** 1-based line number within the input HTML string, when available. */
  line?: number
  /** The element tag name. */
  tag: string
  /** The offending attribute name (when applicable). */
  attribute?: string
  /** Human-readable explanation. */
  message: string
}

/**
 * Thrown by {@link validateAndEscapeHtml} when one or more elements fail
 * validation. Carries the full list of violations in
 * {@link HtmlValidationError.errors}.
 *
 * @public
 */
export class HtmlValidationError extends Error {
  override name = 'HtmlValidationError'
  /** All violations found across every element. */
  errors: HtmlError[]
  constructor(errors: HtmlError[]) {
    super(`${errors.length} HTML validation error(s)`)
    this.errors = errors
  }
}

/**
 * Validate and sanitize an HTML string for SSR rendering.
 *
 * @param html - The HTML document fragment string to validate.
 * @returns The validated HTML string (content unchanged when valid).
 * @throws {HtmlValidationError} when one or more violations are found.
 * @public
 */
export const validateAndEscapeHtml = (html: string): string => {
  const errors: HtmlError[] = []
  new HTMLRewriter()
    .on('*', {
      element(el) {
        const names = [...el.attributes].map(([name]) => name)
        for (const name of names) {
          if (name.startsWith('on')) {
            errors.push({
              tag: el.tagName,
              attribute: name,
              message: `Event handler attributes are not allowed: [${name}]`,
            })
          }
        }
        const schema = getNodeSchema(el.tagName)
        const attrs: Record<string, unknown> = {}
        for (const [name, value] of el.attributes) attrs[name] = value
        const result = schema.shape.attributes.safeParse(attrs)
        if (!result.success) {
          for (const issue of result.error.issues) {
            errors.push({ tag: el.tagName, attribute: issue.path.join('.'), message: issue.message })
          }
        }
      },
    })
    .transform(html)
  if (errors.length) throw new HtmlValidationError(errors)
  return html
}
