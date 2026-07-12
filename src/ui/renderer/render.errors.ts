/**
 * One validation violation found in the HTML string.
 *
 * @public
 */
export type HtmlError = {
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
