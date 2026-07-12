import { getNodeSchema } from '../html.schemas.ts'

/**
 * Validate and sanitize an HTML string for SSR rendering.
 *
 * @remarks
 * Transformer: HTML string in → validated + escaped HTML string out, via Bun
 * {@link HTMLRewriter}. For every element: (1) block `on*` inline event handler
 * attributes — a security violation (events must use the `p-trigger`
 * declarative system); (2) validate attributes against the per-tag schema via
 * {@link getNodeSchema}; (3) re-serialize every attribute via `setAttribute`,
 * which normalizes to double-quoted form and escapes `"` (the only character
 * that can break out of a double-quoted attribute). This is idempotent on
 * already-escaped input — `setAttribute` only escapes `"`, preserving existing
 * `&amp;`/`&lt;`/`&gt;` entities (no double-escape). All violations across all
 * elements are collected and thrown as a single aggregate
 * {@link HtmlValidationError}.
 *
 * MINIMAL: text content is not escaped here. HTMLRewriter's text handler yields
 * already-serialized content with entities preserved (verified), so re-escaping
 * would double-escape legitimate entities (`&amp;` → `&amp;amp;`). Text safety
 * belongs at build time (the hyperscript `h()` builder), not in a string
 * transformer. Attributes are the safe escape surface: `setAttribute` escapes
 * `"` (neutralizing quote-breakout XSS), and `on*` blocking is the security
 * floor.
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
  const out = new HTMLRewriter()
    .on('*', {
      element(el) {
        const names = [...el.attributes].map(([name]) => name)
        const schema = getNodeSchema(el.tagName)
        const attrs: Record<string, unknown> = {}
        for (const name of names) {
          if (name.startsWith('on')) {
            errors.push({
              tag: el.tagName,
              attribute: name,
              message: `Event handler attributes are not allowed: [${name}]`,
            })
            continue
          }
          const value = el.getAttribute(name) ?? ''
          attrs[name] = value
          // Re-serialize every non-on* attribute via setAttribute: normalizes
          // to double-quoted form and escapes " (the only char that can break
          // out of a double-quoted attribute). Idempotent on already-escaped
          // input (setAttribute only escapes ", preserving existing
          // &amp;/&lt;/&gt;). on* attributes are skipped — they are violations
          // and the throw discards the output anyway.
          el.setAttribute(name, value)
        }
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
  return out
}
