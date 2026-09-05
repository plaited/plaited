/// <reference path="../../scripts/types/css-tree.d.ts" />
import { parse, walk } from 'css-tree'
import { CUSTOM_PROPERTY_REF_PATTERN } from './css.constants.ts'
import { CSSPropertiesSchema, validateCSSValue } from './css.schemas.ts'
import { getNodeSchema } from './html.schemas.ts'
import { type CssError, type HtmlError, ValidationError } from './render.errors.ts'

export type { CssError, HtmlError } from './render.errors.ts'
export { ValidationError } from './render.errors.ts'

/**
 * Validate and sanitize an HTML string for SSR rendering — both HTML
 * attributes and CSS inside `<style>` blocks, in a single HTMLRewriter pass.
 *
 * @remarks
 * Transformer: HTML string in → validated + escaped HTML string out, via Bun
 * {@link HTMLRewriter}. Two handlers are chained on one rewriter:
 *
 * 1. `.on('*', { element })` — for every element: (a) block `on*` inline event
 *    handler attributes (security: events must use `p-trigger`); (b) validate
 *    attributes against the per-tag schema via {@link getNodeSchema}; (c)
 *    re-serialize every non-`on*` attribute via `setAttribute`, which
 *    normalizes to double-quoted form and escapes `"` (the only character that
 *    can break out of a double-quoted attribute). Idempotent on already-escaped
 *    input — `setAttribute` only escapes `"`, preserving existing
 *    `&amp;`/`&lt;`/`&gt;` entities (no double-escape).
 *
 * 2. `.on('style', { text })` — accumulate each `<style>` block's text chunks,
 *    parse with `css-tree` (correctly handling `@media` queries, `&` nesting,
 *    and line numbers), and validate each declaration's value against
 *    {@link CSSPropertiesSchema} using the same rules as the `[STYLE]` refine
 *    in `html.schemas.ts`: `--*` custom properties are always valid; known
 *    properties are validated against their per-property schema (with `var(--…)`
 *    references passed through); unknown properties are browser-handled.
 *
 * All violations (both HTML and CSS) are collected and thrown as a single
 * {@link ValidationError} so an agent consumer sees every problem in one shot.
 *
 * MINIMAL: text content is not escaped here (HTMLRewriter's text handler yields
 * already-serialized content; re-escaping would double-escape entities). CSS
 * value-permissive properties (`display`, `color`, `padding`, …) accept any
 * string; exhaustive value-grammar validation is a separate scope.
 *
 * @public
 */

const lineNumberOf = (lineBreakOffsets: number[], absoluteOffset: number): number => {
  let line = 1
  for (const offset of lineBreakOffsets) {
    if (absoluteOffset > offset) line++
    else break
  }
  return line
}

/**
 * Validate and sanitize an HTML string for SSR rendering.
 *
 * @param html - The HTML document fragment string to validate.
 * @returns The validated + escaped HTML string (content unchanged when valid).
 * @throws {ValidationError} when one or more HTML or CSS violations are found.
 * @public
 */
export const validateAndEscapeHtml = (html: string): string => {
  const lineBreakOffsets: number[] = []
  for (let i = 0; i < html.length; i++) if (html[i] === '\n') lineBreakOffsets.push(i)

  const htmlErrors: HtmlError[] = []
  const cssErrors: CssError[] = []
  let currentStyleBlock = ''
  let searchFrom = 0

  const out = new HTMLRewriter()
    .on('*', {
      element(el) {
        const names = [...el.attributes].map(([name]) => name)
        const schema = getNodeSchema(el.tagName)
        const attrs: Record<string, unknown> = {}
        for (const name of names) {
          if (name.startsWith('on')) {
            htmlErrors.push({
              tag: el.tagName,
              attribute: name,
              message: `Event handler attributes are not allowed: [${name}]`,
            })
            continue
          }
          const value = el.getAttribute(name) ?? ''
          attrs[name] = value
          el.setAttribute(name, value)
        }
        const result = schema.shape.attributes.safeParse(attrs)
        if (!result.success) {
          for (const issue of result.error.issues) {
            htmlErrors.push({ tag: el.tagName, attribute: issue.path.join('.'), message: issue.message })
          }
        }
      },
    })
    .on('style', {
      text(chunk) {
        currentStyleBlock += chunk.text
        if (!chunk.lastInTextNode) return
        const block = currentStyleBlock
        currentStyleBlock = ''
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
          if (!(property in (CSSPropertiesSchema.properties as Record<string, unknown>))) return
          if (!validateCSSValue(property, value) && !CUSTOM_PROPERTY_REF_PATTERN.test(value)) {
            const declLine = node.loc?.start.line ?? 1
            cssErrors.push({
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

  if (htmlErrors.length || cssErrors.length) {
    throw new ValidationError({ htmlErrors, cssErrors })
  }
  return out
}

/**
 * Validate a single attribute value against the per-tag schema and the
 * `on*` inline event handler blocklist.
 *
 * @remarks
 * Substrate-neutral — takes `{ tag, attr, val }` (plain strings), not a DOM
 * or {@link HTMLRewriter} element. Both surfaces (the SSR
 * {@link HTMLRewriter}-based {@link updateAttributes} and the browser
 * Controller's `updateAttributes`) and a b-thread validating a dynamic
 * `attrs` message before sending it to the browser call this same function.
 *
 * Rules:
 * 1. `on*` attributes are always blocked (security: events must use
 *    `p-trigger`) — throws {@link ValidationError} with an `HtmlError`.
 * 2. Otherwise the value is validated against the per-tag attribute schema
 *    via {@link getNodeSchema}; schema failures throw {@link ValidationError}.
 *
 * @param tag - The element tag name (lowercase, e.g. `'div'`, `'a'`).
 * @param attr - The attribute name.
 * @param val - The attribute value (coerced to string by the caller for
 *   comparison; passed as-is to the schema).
 * @throws {ValidationError} when the attribute is an `on*` handler or fails
 *   per-tag schema validation.
 * @public
 */
export const validateAttributeValue = ({
  tag,
  attr,
  val,
}: {
  tag: string
  attr: string
  val: string | number | boolean | null
}): void => {
  if (attr.startsWith('on')) {
    throw new ValidationError({
      htmlErrors: [{ tag, attribute: attr, message: `Event handler attributes are not allowed: [${attr}]` }],
    })
  }
  const schema = getNodeSchema(tag)
  const result = schema.shape.attributes.safeParse({ [attr]: val })
  if (!result.success) {
    throw new ValidationError({
      htmlErrors: result.error.issues.map((issue) => ({
        tag,
        attribute: issue.path.join('.') || attr,
        message: issue.message,
      })),
    })
  }
}
