/**
 * One HTML attribute validation violation found in the HTML string.
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
 * One invalid CSS declaration found in a `<style>` block.
 *
 * @public
 */
export type CssError = {
  /** 1-based line number within the input HTML string. */
  line: number
  /** The CSS property name (e.g. `box-sizing`). */
  property: string
  /** The invalid value as it appears in the source. */
  value: string
  /** Human-readable explanation. */
  message: string
}

/**
 * Thrown by {@link validateAndEscapeHtml} when one or more HTML attribute or
 * CSS declaration violations are found. Carries both lists so an agent
 * consumer sees every problem in one shot — no priority ordering that would
 * force multiple fix-and-rerun cycles.
 *
 * @public
 */
export class ValidationError extends Error {
  override name = 'ValidationError'
  /** All HTML attribute violations found across every element. */
  htmlErrors: HtmlError[]
  /** All CSS declaration violations found across every `<style>` block. */
  cssErrors: CssError[]
  constructor({ htmlErrors, cssErrors = [] }: { htmlErrors: HtmlError[]; cssErrors?: CssError[] }) {
    const total = htmlErrors.length + cssErrors.length
    super(`${total} validation error(s) (${htmlErrors.length} HTML, ${cssErrors.length} CSS)`)
    this.htmlErrors = htmlErrors
    this.cssErrors = cssErrors
  }
}
