/**
 * Core two-pass HTMLRewriter binding engine.
 *
 * @remarks
 * This module uses Bun's HTMLRewriter API, which is only available in the Bun runtime.
 * The Element and Text types used in handlers are Bun's HTMLRewriterTypes, not DOM types.
 * {@link import('../../controller/controller.ts').Controller#render} and
 * {@link import('../../controller/controller.ts').Controller#attrs} methods.
 *
 * **Pass 1** — Capture context:
 * Streams HTML through HTMLRewriter, accumulating text from the last
 * `<script type="application/json" p-context>` element. At element close,
 * JSON.parses the buffer. Throws {@link DuplicateContextError} if a second
 * p-context script appears. Strips the script element.
 *
 * **Pass 2** — Apply data:
 * If a context was captured, calls `dataResolver(context)`, then streams
 * pass-1 output through a second HTMLRewriter. For each `[p-target="<key>"]`
 * element, looks up the resolved data and applies it by type:
 * - **primitive** (string | number): sets inner text (escaped by default)
 * - **object**: applies each entry as attributes per updateAttributes rules
 * - **boolean** (top-level): throws InvalidResolverResultError
 * - **missing key** or **undefined**: no-op
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLRewriter}
 */

// Type reference for Bun's HTMLRewriter API (available globally in Bun runtime)
/// <reference path="../../node_modules/bun-types/html-rewriter.d.ts" />

import { htmlEscape } from '../utils.ts'
import { BOOLEAN_ATTRS, P_CONTEXT, P_TARGET, P_TRUSTED } from './html.constants.ts'
import { getNodeSchema, TemplateObjectSchema } from './html.schemas.ts'
import {
  DuplicateContextError,
  EventHandlerAttributeError,
  InvalidAttributeError,
  InvalidContextJsonError,
  InvalidResolverResultError,
} from './use-html-rewriter.errors.ts'

/**
 * Bun's HTMLRewriter Element type - used for type safety within this module.
 * HTMLRewriter Element has methods like setInnerContent, getAttribute, etc.
 * that differ from the DOM Element type.
 */
type RewriterElement = HTMLRewriterTypes.Element
type RewriterText = HTMLRewriterTypes.Text
type RewriterComment = HTMLRewriterTypes.Comment

/**
 * Result of pass 1: the captured context (if any) and the pass-1 output HTML.
 */
interface Pass1Result {
  context: unknown
  html: string
}

/**
 * Perform pass 1: find and capture the `<script type="application/json" p-context>`,
 * strip the element, and return the captured context + transformed HTML.
 */
const captureContext = async (html: string): Promise<Pass1Result> => {
  let contextBuffer = ''
  let foundCount = 0

  const result = await new HTMLRewriter()
    .on(`script[type="application/json"][${P_CONTEXT}]`, {
      element(el: RewriterElement) {
        foundCount++
        if (foundCount > 1) {
          throw new DuplicateContextError(
            'Multiple <script type="application/json" p-context> elements found — exactly one allowed per file',
          )
        }
        // Remove the entire element from output
        el.remove()
      },
      text(text: RewriterText) {
        if (foundCount > 0) {
          contextBuffer += text.text
          // text.remove() not strictly needed since element.remove() removes
          // the whole element, but being explicit doesn't hurt
          text.remove()
        }
      },
      comments(_comment: RewriterComment) {
        // No-op
      },
    })
    .transform(new Response(html))

  if (foundCount === 0) {
    return { context: undefined, html }
  }

  const outputHtml = await result.text()

  try {
    const context = JSON.parse(contextBuffer)
    return { context, html: outputHtml }
  } catch (err) {
    const parseError = err instanceof Error ? err.message : String(err)
    throw new InvalidContextJsonError(
      `Failed to parse <script type="application/json" p-context> content: ${parseError}`,
    )
  }
}

/**
 * Apply a primitive value to a p-target element.
 *
 * Bun's HTMLRewriter setInnerContent escapes HTML by default, so we only
 * need to pass `{ html: true }` for trusted content to bypass escaping.
 */
const applyPrimitive = (el: RewriterElement, val: string | number, isTrusted: boolean): void => {
  if (isTrusted) {
    el.setInnerContent(String(val), { html: true })
  } else {
    el.setInnerContent(String(val))
  }
}

/**
 * Apply an object value (attribute map) to a p-target element.
 * Mirrors the controller's updateAttributes logic.
 */
const applyObjectAttributes = (el: RewriterElement, attrs: Record<string, unknown>, isTrusted: boolean): void => {
  // Validate the attribute set against the element's schema.
  // Null values represent attribute removal (valid runtime op), so filter
  // them out before validation since they are not valid attribute values.
  // HTMLRewriter gives tagName in uppercase; getNodeSchema expects lowercase
  const nonNullAttrs = Object.fromEntries(Object.entries(attrs).filter(([, v]) => v !== null))
  const tagSchema = getNodeSchema(el.tagName.toLowerCase())
  const validationResult = tagSchema.shape.attributes.safeParse(nonNullAttrs)
  if (!validationResult.success) {
    const issues = validationResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new InvalidAttributeError(`Invalid attributes for <${el.tagName.toLowerCase()}>: ${issues}`)
  }

  for (const key in attrs) {
    // Reject on* event handler attributes
    if (key.startsWith('on')) {
      throw new EventHandlerAttributeError(
        `Event handler attributes are not allowed: [${key}] on <${el.tagName.toLowerCase()}>`,
      )
    }

    const val = attrs[key]
    if (val === undefined) continue

    const escapedKey = isTrusted ? key : htmlEscape(key)

    if (val === null) {
      if (el.hasAttribute(key)) el.removeAttribute(key)
      continue
    }

    if (BOOLEAN_ATTRS.has(key)) {
      if (!el.hasAttribute(key)) el.setAttribute(key, '')
      continue
    }

    const stringVal = String(val)
    const escapedVal = isTrusted ? stringVal : htmlEscape(stringVal)
    if (el.getAttribute(key) !== stringVal) {
      el.setAttribute(escapedKey, escapedVal)
    }
  }
}

/**
 * Apply resolved data to a single p-target element.
 */
const applyResolvedValue = (el: RewriterElement, key: string, value: unknown): void => {
  const isTrusted = el.hasAttribute(P_TRUSTED)

  if (value === undefined || value === null) {
    return
  }

  if (typeof value === 'boolean') {
    throw new InvalidResolverResultError(
      `Boolean value for p-target="${key}" on <${el.tagName.toLowerCase()}> is ambiguous. ` +
        'Use an object map with boolean attribute values, or a string/number primitive.',
    )
  }

  if (typeof value === 'string' || typeof value === 'number') {
    applyPrimitive(el, value, isTrusted)
    return
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    applyObjectAttributes(el, value as Record<string, unknown>, isTrusted)
    return
  }

  // MINIMAL: arrays in simple binding are an error. Child-insertion via
  // list kind descriptor handles array iteration.
  throw new InvalidResolverResultError(
    `Array value for p-target="${key}" on <${el.tagName.toLowerCase()}> is not supported in simple binding. ` +
      'Use a "list" kind binding descriptor for array iteration.',
  )
}

/**
 * Perform pass 2: apply resolved data to p-target elements.
 */
const applyData = async (html: string, resolvedData: Record<string, unknown>): Promise<string> => {
  const result = await new HTMLRewriter()
    .on(`[${P_TARGET}]`, {
      element(el: RewriterElement) {
        const target = el.getAttribute(P_TARGET)
        if (target === null) return

        const value = resolvedData[target]
        if (value !== undefined) {
          applyResolvedValue(el, target, value)
        }
        // Keep p-target on the element — client controller needs it
      },
      text(_text: RewriterText) {},
      comments(_comment: RewriterComment) {},
    })
    .transform(new Response(html))

  return await result.text()
}

/**
 * Rewrite a single HTML file through the two-pass process.
 *
 * @param html - The raw HTML content
 * @param dataResolver - Async/sync callback invoked with the parsed p-context descriptor;
 *   returns a Record<string, unknown> keyed by p-target value
 * @returns The rewritten HTML string
 *
 * @throws Various errors from the errors module on validation/integrity failures
 */
export const rewriteFile = async (
  html: string,
  dataResolver: (context: unknown) => unknown | Promise<unknown>,
): Promise<string> => {
  // Pass 1 — capture context
  const { context, html: pass1Html } = await captureContext(html)

  // No context found — passthrough
  if (context === undefined) {
    return pass1Html
  }

  // Call dataResolver with the parsed context
  const rawResolved = await dataResolver(context)

  // Validate the resolver result
  if (typeof rawResolved !== 'object' || rawResolved === null || Array.isArray(rawResolved)) {
    throw new InvalidResolverResultError(
      `dataResolver returned ${typeof rawResolved === 'object' ? (Array.isArray(rawResolved) ? 'array' : 'null') : typeof rawResolved}, expected a Record<string, unknown>`,
    )
  }

  const resolvedData = rawResolved as Record<string, unknown>

  // Pass 2 — apply data
  return applyData(pass1Html, resolvedData)
}

/**
 * Type for the result of dynamic() mode.
 */
export interface TemplateObject {
  html: string[]
  stylesheets: string[]
  scale: 'rel'
  $: '🦄'
}

/**
 * Validate a TemplateObject shape against TemplateObjectSchema.
 */
export const validateTemplateObject = (obj: unknown): obj is TemplateObject => {
  const result = TemplateObjectSchema.safeParse(obj)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new TypeError(`Invalid TemplateObject: ${issues}`)
  }
  return true
}
