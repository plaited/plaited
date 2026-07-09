/**
 * Core two-pass HTMLRewriter binding engine.
 *
 * @remarks
 * Implements the SSR data-binding rewriter with support for simple binding,
 * child-insertion (data/list/switch kinds), and static file inclusion.
 *
 * **Pass 1** — Capture context:
 * Streams HTML through HTMLRewriter, accumulating text from the last
 * `<script type="application/json" p-context>` element. JSON.parses the
 * buffer. Throws DuplicateContextError if a second p-context appears.
 * Strips the script element.
 *
 * **Pass 2** — Apply data + resolve includes:
 * Calls dataResolver(context) → resolvedData, then applies by descriptor:
 * - Simple (path only, no kind): apply value directly (primitive→text, object→attrs)
 * - data kind: apply value, optionally render a template with it as context
 * - list kind: loop template per array item, scope paths per iteration
 * - switch kind: pick case by discriminator, render that case's template
 * Resolves `<ssr-include>` elements recursively.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLRewriter}
 */

import { resolve } from 'node:path'
import { htmlEscape } from '../utils.ts'
import {
  BOOLEAN_ATTRS,
  P_CONTEXT,
  P_TARGET,
  P_TRUSTED,
  type SCALE,
  type TEMPLATE_OBJECT_IDENTIFIER,
} from './html.constants.ts'
import { getNodeSchema, TemplateObjectSchema } from './html.schemas.ts'
import { resolveJsonPointer } from './resolve-json-pointer.ts'
import {
  DuplicateContextError,
  EventHandlerAttributeError,
  IncludeCycleError,
  IncludeNotFoundError,
  InvalidAttributeError,
  InvalidContextJsonError,
  InvalidDescriptorError,
  InvalidResolverResultError,
} from './use-html-rewriter.errors.ts'
import { ContextDescriptorSchema } from './use-html-rewriter.schemas.ts'

/** Bun's HTMLRewriter Element type. */
type RewriterElement = HTMLRewriterTypes.Element
/** Bun's HTMLRewriter Text type. */
type RewriterText = HTMLRewriterTypes.Text

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
  /** The raw parsed p-context JSON (descriptor or simple data). */
  context: unknown
  /** HTML with p-context scripts stripped. */
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
 */
const applyObjectAttributes = (el: RewriterElement, attrs: Record<string, unknown>, isTrusted: boolean): void => {
  // R6: validate the null-filtered map, then apply the original (nulls
  // included). Nulls represent attribute removal (a valid runtime op per
  // updateAttributes) but are not valid attribute values, so the schema
  // would reject them. MINIMAL: ceiling — make the per-tag schemas
  // `.nullable()` on the relevant fields so the full map validates as
  // applied; upgrade path is a schema-generation pass. For now nulls are
  // filtered for validation only and handled as removeAttribute at apply.
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

    // R7: do NOT escape attribute keys — setAttribute takes a raw attribute
    // name, not an HTML-escaped string. (The old h() string-concat builder
    // needed key escaping; HTMLRewriter's setAttribute does not.) Values ARE
    // escaped below — verified necessary: HTMLRewriter does not escape &/<
    // in attribute values.

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
      el.setAttribute(key, escapedVal)
    }
  }
}

/**
 * Apply a simple resolved value (without descriptor-based child-insertion).
 */
const applySimpleValue = (el: RewriterElement, key: string, value: unknown): void => {
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

  throw new InvalidResolverResultError(
    `Array value for p-target="${key}" on <${el.tagName}> is not supported in simple binding. ` +
      'Use a "list" kind binding descriptor for array iteration.',
  )
}

/**
 * Render a template file by reading it, creating a scoped resolver, and
 * recursively rewriting it.
 */
const renderTemplate = async (
  templatePath: string,
  scopedData: unknown,
  _dataResolver: (context: unknown) => unknown | Promise<unknown>,
  options: RewriteOptions,
): Promise<string> => {
  const absolutePath = resolve(options.cwd, templatePath)

  if (options.includeStack.has(absolutePath)) {
    const cycle = [...options.includeStack, absolutePath].join(' \u2192 ')
    throw new IncludeCycleError(`Circular template include detected: ${cycle}`)
  }

  const file = Bun.file(absolutePath)
  const exists = await file.exists()
  if (!exists) {
    throw new IncludeNotFoundError(
      `Template file "${templatePath}" not found at "${absolutePath}" (resolved against cwd "${options.cwd}")`,
    )
  }

  const fileContent = await file.text()

  // The scoped resolver receives the template's own p-context descriptor
  // and resolves each entry's data path against scopedData. This enables
  // scoped-path resolution: a template with p-context
  // `{"item":{"path":"/name"}}` rendered with scopedData = { name, price }
  // resolves `/name` from the item. Kind-based descriptors (data/list/switch)
  // use the `data` field instead of `path`; resolve that too so child-
  // insertion chains resolve at every depth. A missing token fails fast
  // (resolveJsonPointer throws InvalidDescriptorError) — per open-decision #5.
  const scopedResolver = (templateDescriptor: unknown) => {
    if (typeof templateDescriptor !== 'object' || templateDescriptor === null) {
      return scopedData
    }
    const result: Record<string, unknown> = {}
    for (const [key, binding] of Object.entries(templateDescriptor as Record<string, unknown>)) {
      if (typeof binding !== 'object' || binding === null) continue
      const b = binding as Record<string, unknown>
      const ptr = typeof b.path === 'string' ? b.path : typeof b.data === 'string' ? b.data : null
      if (ptr === null) continue
      result[key] = resolveJsonPointer(scopedData, ptr)
    }
    return result
  }

  const stack = new Set(options.includeStack)
  stack.add(absolutePath)

  return rewriteFile(fileContent, scopedResolver, { cwd: options.cwd, includeStack: stack })
}

/**
 * Apply child-insertion binding for a p-target element based on its descriptor.
 * Handles data, list, and switch kinds.
 */
const applyChildInsertion = async (
  el: RewriterElement,
  key: string,
  descriptor: Record<string, unknown>,
  resolvedData: Record<string, unknown>,
  dataResolver: (context: unknown) => unknown | Promise<unknown>,
  options: RewriteOptions,
): Promise<void> => {
  const value = resolvedData[key]
  if (value === undefined || value === null) {
    return
  }

  if (!('kind' in descriptor) || !descriptor.kind) {
    return
  }

  const kind = descriptor.kind as string

  switch (kind) {
    case 'data': {
      const d = descriptor as Record<string, unknown>
      if (d.template) {
        const boundHtml = await renderTemplate(d.template as string, value, dataResolver, options)
        el.setInnerContent(boundHtml, { html: true })
      } else {
        applySimpleValue(el, key, value)
      }
      break
    }
    case 'list': {
      if (!Array.isArray(value)) {
        throw new InvalidResolverResultError(
          `Expected array for p-target="${key}" <${el.tagName}> with kind="list", got ${typeof value}`,
        )
      }
      const d = descriptor as Record<string, unknown>
      const items: string[] = []
      for (const item of value) {
        const boundHtml = await renderTemplate(d.template as string, item, dataResolver, options)
        items.push(boundHtml)
      }
      el.setInnerContent(items.join(''), { html: true })
      break
    }
    case 'switch': {
      if (typeof value !== 'object' || value === null) {
        throw new InvalidResolverResultError(
          `Expected object for p-target="${key}" <${el.tagName}> with kind="switch", got ${typeof value}`,
        )
      }
      const d = descriptor as Record<string, unknown>
      const obj = value as Record<string, unknown>
      const discriminatorValue = String(obj[d.discriminator as string] ?? '')
      const cases = d.cases as Record<string, unknown> | undefined
      const caseDescriptor: unknown = cases?.[discriminatorValue]

      if (caseDescriptor) {
        await applyDescriptorToElement(el, key, caseDescriptor, resolvedData, dataResolver, options)
      } else if (d.default) {
        await applyDescriptorToElement(el, key, d.default, resolvedData, dataResolver, options)
      } else {
        // No matching case and no default — clear the target content
        el.setInnerContent('')
      }
      break
    }
  }
}

/**
 * Apply a single descriptor entry to an element.
 */
const applyDescriptorToElement = async (
  el: RewriterElement,
  key: string,
  descriptor: unknown,
  resolvedData: Record<string, unknown>,
  dataResolver: (context: unknown) => unknown | Promise<unknown>,
  options: RewriteOptions,
): Promise<void> => {
  if (
    typeof descriptor === 'object' &&
    descriptor !== null &&
    'kind' in descriptor &&
    (descriptor as Record<string, unknown>).kind
  ) {
    await applyChildInsertion(el, key, descriptor as Record<string, unknown>, resolvedData, dataResolver, options)
  } else {
    applySimpleValue(el, key, resolvedData[key])
  }
}

/**
 * Perform pass 2: apply resolved data to p-target elements, resolve
 * `<ssr-include>` includes, and handle child-insertion descriptors.
 *
 * Uses a deferred error pattern to work around Bun's HTMLRewriter async
 * handler error propagation limitation.
 */
const applyData = async (
  html: string,
  resolvedData: Record<string, unknown>,
  descriptor: Record<string, unknown> | undefined,
  dataResolver: (context: unknown) => unknown | Promise<unknown>,
  options: RewriteOptions,
): Promise<string> => {
  let deferredError: Error | undefined

  const handleError = (err: unknown) => {
    if (!deferredError) {
      deferredError = err instanceof Error ? err : new Error(String(err))
    }
  }

  const result = await new HTMLRewriter()
    .on(`[${P_TARGET}]`, {
      async element(el: RewriterElement) {
        try {
          const target = el.getAttribute(P_TARGET)
          if (target === null) return

          const value = resolvedData[target]
          if (value === undefined) return

          const bindingDescriptor = descriptor?.[target]
          if (
            bindingDescriptor &&
            typeof bindingDescriptor === 'object' &&
            'kind' in bindingDescriptor &&
            (bindingDescriptor as Record<string, unknown>).kind
          ) {
            await applyChildInsertion(el, target, bindingDescriptor, resolvedData, dataResolver, options)
          } else {
            applySimpleValue(el, target, value)
          }
        } catch (err) {
          handleError(err)
        }
      },
    })
    .on('ssr-include[src]', {
      async element(el: RewriterElement) {
        try {
          const src = el.getAttribute('src')
          if (!src) return

          const absolutePath = resolve(options.cwd, src)

          if (options.includeStack.has(absolutePath)) {
            throw new IncludeCycleError(
              `Circular <ssr-include> detected: ${[...options.includeStack, absolutePath].join(' \u2192 ')}`,
            )
          }

          const file = Bun.file(absolutePath)
          const exists = await file.exists()
          if (!exists) {
            throw new IncludeNotFoundError(
              `<ssr-include src="${src}">: file not found at "${absolutePath}" (resolved against cwd "${options.cwd}")`,
            )
          }

          const fileContent = await file.text()

          const includeStack = new Set(options.includeStack)
          includeStack.add(absolutePath)
          const boundHtml = await rewriteFile(fileContent, dataResolver, {
            cwd: options.cwd,
            includeStack,
          })

          el.replace(boundHtml, { html: true })
        } catch (err) {
          handleError(err)
        }
      },
    })
    .transform(new Response(html))

  const outputHtml = await result.text()

  // Re-throw any deferred error from async handlers
  if (deferredError) {
    throw deferredError
  }

  return outputHtml
}

/**
 * Rewrite a single HTML file through the two-pass process.
 *
 * @param html - The raw HTML content
 * @param dataResolver - Async/sync callback invoked with the parsed p-context descriptor;
 *   returns a Record<string, unknown> keyed by p-target value
 * @param options - Rewrite options including cwd and includeStack
 * @returns The rewritten HTML string
 */
export const rewriteFile = async (
  html: string,
  dataResolver: (context: unknown) => unknown | Promise<unknown>,
  options: RewriteOptions = { cwd: '.', includeStack: new Set() },
): Promise<string> => {
  const { context, html: pass1Html } = await captureContext(html)

  if (context === undefined) {
    // No context — passthrough (still resolve ssr-include)
    return applyData(pass1Html, {}, undefined, dataResolver, options)
  }

  const rawResolved = await dataResolver(context)

  if (typeof rawResolved !== 'object' || rawResolved === null || Array.isArray(rawResolved)) {
    throw new InvalidResolverResultError(
      `dataResolver returned ${typeof rawResolved === 'object' ? (Array.isArray(rawResolved) ? 'array' : 'null') : typeof rawResolved}, expected a Record<string, unknown>`,
    )
  }

  const resolvedData = rawResolved as Record<string, unknown>

  // R2: validate the p-context descriptor against ContextDescriptorSchema.
  // Only non-null objects are validated; non-object contexts (primitives,
  // arrays) skip the schema and flow through to dataResolver as-is.
  let descriptor: Record<string, unknown> | undefined
  if (typeof context === 'object' && context !== null) {
    const descriptorResult = ContextDescriptorSchema.safeParse(context)
    if (!descriptorResult.success) {
      const issues = descriptorResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      throw new InvalidDescriptorError(`Invalid p-context descriptor: ${issues}`)
    }
    descriptor = descriptorResult.data as Record<string, unknown>
  }

  return applyData(pass1Html, resolvedData, descriptor, dataResolver, options)
}

/**
 * Type for the result of dynamic() mode.
 * scale/$ reference the constants so the interface stays in sync with
 * TemplateObjectSchema and html.constants.ts (no magic literals).
 */
export interface TemplateObject {
  html: string[]
  stylesheets: string[]
  scale: typeof SCALE.rel
  $: typeof TEMPLATE_OBJECT_IDENTIFIER
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
