/**
 * Core two-pass HTMLRewriter binding engine.
 *
 * @remarks
 * This module implements the server-side counterpart of the client controller's
 * {@link import('../../controller/controller.ts').Controller#render} and
 * {@link import('../../controller/controller.ts').Controller#attrs} methods.
 *
 * **Pass 1** — Capture context:
 * Streams HTML through HTMLRewriter, accumulating text from the last
 * `<script type="application/json" p-context>` element. At element close,
 * JSON.parses the buffer. Throws DuplicateContextError if a second
 * p-context script appears. Strips the script element.
 *
 * **Pass 2** — Apply data + resolve includes:
 * If a context was captured, calls `dataResolver(context)`, then streams
 * pass-1 output through a second HTMLRewriter. For each `[p-target="<key>"]`
 * element, looks up the resolved data and applies it by type.
 * For each `<ssr-include src="...">`, resolves the file, recursively
 * rewrites it, and replaces the element.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLRewriter}
 */

import { resolve } from 'node:path'
import { htmlEscape } from '../utils.ts'
import { BOOLEAN_ATTRS, P_CONTEXT, P_TARGET, P_TRUSTED } from './html.constants.ts'
import { getNodeSchema, TemplateObjectSchema } from './html.schemas.ts'
import {
  DuplicateContextError,
  EventHandlerAttributeError,
  IncludeCycleError,
  IncludeNotFoundError,
  InvalidAttributeError,
  InvalidContextJsonError,
  InvalidResolverResultError,
} from './use-html-rewriter.errors.ts'

/** Bun's HTMLRewriter Element type. */
type RewriterElement = HTMLRewriterTypes.Element
/** Bun's HTMLRewriter Text type. */
type RewriterText = HTMLRewriterTypes.Text
/** Bun's HTMLRewriter Comment type. */
type RewriterComment = HTMLRewriterTypes.Comment

/**
 * Options for the rewrite process.
 */
export interface RewriteOptions {
  /** Base directory for resolving relative file paths. */
  cwd: string
  /** Set of already-resolved absolute paths for cycle detection. */
  includeStack: Set<string>
}

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
        el.remove()
      },
      text(text: RewriterText) {
        if (foundCount > 0) {
          contextBuffer += text.text
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
  const nonNullAttrs = Object.fromEntries(Object.entries(attrs).filter(([, v]) => v !== null))
  const tagSchema = getNodeSchema(el.tagName)
  const validationResult = tagSchema.shape.attributes.safeParse(nonNullAttrs)
  if (!validationResult.success) {
    const issues = validationResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new InvalidAttributeError(`Invalid attributes for <${el.tagName}>: ${issues}`)
  }

  for (const key in attrs) {
    if (key.startsWith('on')) {
      throw new EventHandlerAttributeError(`Event handler attributes are not allowed: [${key}] on <${el.tagName}>`)
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
      `Boolean value for p-target="${key}" on <${el.tagName}> is ambiguous. ` +
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
    `Array value for p-target="${key}" on <${el.tagName}> is not supported in simple binding. ` +
      'Use a "list" kind binding descriptor for array iteration.',
  )
}

/**
 * Perform pass 2: apply resolved data to p-target elements and resolve
 * `<ssr-include>` includes.
 */
const applyData = async (
  html: string,
  resolvedData: Record<string, unknown>,
  dataResolver: (context: unknown) => unknown | Promise<unknown>,
  options: RewriteOptions,
): Promise<string> => {
  const result = await new HTMLRewriter()
    .on(`[${P_TARGET}]`, {
      element(el: RewriterElement) {
        const target = el.getAttribute(P_TARGET)
        if (target === null) return

        const value = resolvedData[target]
        if (value !== undefined) {
          applyResolvedValue(el, target, value)
        }
      },
      text(_text: RewriterText) {},
      comments(_comment: RewriterComment) {},
    })
    .on('ssr-include[src]', {
      async element(el: RewriterElement) {
        const src = el.getAttribute('src')
        if (!src) return

        // Resolve against cwd, not including file's location
        const absolutePath = resolve(options.cwd, src)

        // Cycle guard
        if (options.includeStack.has(absolutePath)) {
          const cycle = [...options.includeStack, absolutePath].join(' → ')
          throw new IncludeCycleError(`Circular <ssr-include> detected: ${cycle}`)
        }

        // Check file exists
        const file = Bun.file(absolutePath)
        const exists = await file.exists()
        if (!exists) {
          throw new IncludeNotFoundError(
            `<ssr-include src="${src}">: file not found at "${absolutePath}" (resolved against cwd "${options.cwd}")`,
          )
        }

        const fileContent = await file.text()

        // Recursively rewrite with this path in the stack
        const includeStack = new Set(options.includeStack)
        includeStack.add(absolutePath)
        const boundHtml = await rewriteFile(fileContent, dataResolver, {
          cwd: options.cwd,
          includeStack,
        })

        // Replace the <ssr-include> element with the bound HTML
        el.replace(boundHtml, { html: true })
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
 * @param options - Rewrite options including cwd and includeStack for ssr-include recursion
 * @returns The rewritten HTML string
 *
 * @throws Various errors from the errors module on validation/integrity failures
 */
export const rewriteFile = async (
  html: string,
  dataResolver: (context: unknown) => unknown | Promise<unknown>,
  options: RewriteOptions = { cwd: '.', includeStack: new Set() },
): Promise<string> => {
  const { context, html: pass1Html } = await captureContext(html)

  // No context found — passthrough (still resolve ssr-include)
  if (context === undefined) {
    return applyData(pass1Html, {}, dataResolver, options)
  }

  const rawResolved = await dataResolver(context)

  if (typeof rawResolved !== 'object' || rawResolved === null || Array.isArray(rawResolved)) {
    throw new InvalidResolverResultError(
      `dataResolver returned ${typeof rawResolved === 'object' ? (Array.isArray(rawResolved) ? 'array' : 'null') : typeof rawResolved}, expected a Record<string, unknown>`,
    )
  }

  const resolvedData = rawResolved as Record<string, unknown>

  return applyData(pass1Html, resolvedData, dataResolver, options)
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
