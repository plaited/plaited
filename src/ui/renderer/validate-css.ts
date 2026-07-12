/// <reference path="../../../scripts/types/css-tree.d.ts" />
import { parse, walk } from 'css-tree'
import { CUSTOM_PROPERTY_REF_PATTERN } from '../css.constants.ts'
import { CSSPropertiesSchema } from '../css.schemas.ts'

/**
 * Validate CSS inside `<style>` blocks of an HTML string against the
 * auto-generated {@link CSSPropertiesSchema}.
 *
 * @remarks
 * Extracts every `<style>` block via Bun {@link HTMLRewriter}, parses each with
 * `css-tree` (correctly handling `@media` queries, `&` nesting, and line
 * numbers), and validates each declaration's value against
 * {@link CSSPropertiesSchema} using the same rules as the `[STYLE]` refine in
 * `html.schemas.ts`: `--*` custom properties are always valid; known
 * properties are validated against their per-property schema (with `var(--…)`
 * references passed through); unknown properties are browser-handled (no-op).
 *
 * Collects all invalid declarations and throws a single
 * {@link CssValidationError} aggregate; returns `void` when all declarations
 * are valid.
 *
 * MINIMAL: value-permissive properties (`display`, `color`, `padding`, …)
 * accept any string because {@link CSSPropertiesSchema} is property-name-strict
 * but value-permissive for them. Exhaustive value-grammar validation would
 * require augmenting `scripts/css-schemas` generation to tighten per-property
 * value schemas (the `@webref/css` syntax data to drive it exists), or vending
 * the JVM `w3c/css-validator`. That is a separate, explicit scope.
 *
 * @public
 */

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
 * Thrown by {@link validateCss} when one or more CSS declarations fail
 * validation. Carries the full list of invalid declarations in
 * {@link CssValidationError.errors}.
 *
 * @public
 */
export class CssValidationError extends Error {
  override name = 'CssValidationError'
  /** All invalid declarations found across every `<style>` block. */
  errors: CssError[]
  constructor(errors: CssError[]) {
    super(`${errors.length} CSS validation error(s)`)
    this.errors = errors
  }
}

const lineNumberOf = (lineBreakOffsets: number[], absoluteOffset: number): number => {
  let line = 1
  for (const offset of lineBreakOffsets) {
    if (absoluteOffset > offset) line++
    else break
  }
  return line
}

/**
 * Validate all CSS declarations inside `<style>` blocks of an HTML string.
 *
 * @param html - The full HTML document string to validate.
 * @throws {CssValidationError} when one or more declarations are invalid.
 * @public
 */
export const validateCss = (html: string): void => {
  const lineBreakOffsets: number[] = []
  for (let i = 0; i < html.length; i++) if (html[i] === '\n') lineBreakOffsets.push(i)

  const errors: CssError[] = []
  let current = ''
  let searchFrom = 0

  new HTMLRewriter()
    .on('style', {
      text(chunk) {
        current += chunk.text
        if (!chunk.lastInTextNode) return
        const block = current
        current = ''
        const blockStart = html.indexOf(block, searchFrom)
        searchFrom = blockStart + block.length
        const blockLine = lineNumberOf(lineBreakOffsets, blockStart)
        const ast = parse(block, { positions: true })
        walk(ast, (node) => {
          if (node.type !== 'Declaration') return
          const property = node.property!
          const valueLoc = node.value!.loc
          if (!valueLoc) return
          const value = block.slice(valueLoc.start.offset, valueLoc.end.offset).trim()
          if (property.startsWith('--')) return
          if (!(property in CSSPropertiesSchema.shape)) return
          const result = CSSPropertiesSchema.shape[property as keyof typeof CSSPropertiesSchema.shape].safeParse(value)
          if (!result.success && !CUSTOM_PROPERTY_REF_PATTERN.test(value)) {
            const declLine = node.loc?.start.line ?? 1
            errors.push({
              line: blockLine + declLine - 1,
              property,
              value,
              message: `Invalid value "${value}" for property "${property}"`,
            })
          }
        })
      },
    })
    .transform(html)

  if (errors.length) throw new CssValidationError(errors)
}
