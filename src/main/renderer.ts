import type { BPEvent } from './behavioral.schemas.ts'
import { BOOLEAN_ATTRS, P_TARGET } from './html.constants.ts'
import { getNodeSchema } from './html.schemas.ts'
import { RENDERER_RESULTS_MESSAGE_TYPES, SWAP_MODES } from './message.constants.ts'
import type { AttrsMessage, RenderMessage } from './message.schemas.ts'
import { ValidationError } from './render.errors.ts'
import { validateAndEscapeHtml } from './validate-and-escape-html.ts'

/**
 * Apply one swap-mode insertion to a matching HTMLRewriter element. Each mode
 * maps to a single HTMLRewriter element method, all with `{ html: true }` since
 * the payload is a markup fragment. Mirrors the Controller's `#performSwap`.
 *
 * @internal
 */
const applySwap = ({
  element,
  html,
  swap,
}: {
  element: HTMLRewriterTypes.Element
  html: string
  swap: RenderMessage['detail']['swap']
}) => {
  switch (swap) {
    case SWAP_MODES.innerHTML:
      return element.setInnerContent(html, { html: true })
    case SWAP_MODES.outerHTML:
      return element.replace(html, { html: true })
    case SWAP_MODES.afterbegin:
      return element.prepend(html, { html: true })
    case SWAP_MODES.beforeend:
      return element.append(html, { html: true })
    case SWAP_MODES.beforebegin:
      return element.before(html, { html: true })
    case SWAP_MODES.afterend:
      return element.after(html, { html: true })
  }
}

/**
 * Port of the browser Controller's `updateAttributes` helper, retargeted at the
 * Bun HTMLRewriter element API (same getAttribute/hasAttribute/setAttribute/
 * removeAttribute surface). Rules: null + present → removeAttribute; null +
 * absent → no-op; BOOLEAN_ATTRS member → set bare when absent; otherwise
 * setAttribute(attr, String(val)) when the value changed. The rewriter
 * serializes attribute values itself; no manual escaping (matches Controller).
 *
 * @internal
 */
const updateAttributes = ({
  element,
  attr,
  val,
}: {
  element: HTMLRewriterTypes.Element
  attr: string
  val: string | null | number | boolean
}) => {
  // on* inline event handlers are always blocked (security: use p-trigger).
  if (attr.startsWith('on')) {
    throw new ValidationError({
      htmlErrors: [
        { tag: element.tagName, attribute: attr, message: `Event handler attributes are not allowed: [${attr}]` },
      ],
    })
  }
  if (val === null && element.hasAttribute(attr)) return element.removeAttribute(attr)
  if (val === null) return
  if (BOOLEAN_ATTRS.has(attr)) {
    if (!element.hasAttribute(attr)) element.setAttribute(attr, '')
    return
  }
  if (element.getAttribute(attr) !== `${val}`) {
    // Validate the new value against the per-tag attribute schema.
    const schema = getNodeSchema(element.tagName)
    const result = schema.shape.attributes.safeParse({ [attr]: val })
    if (!result.success) {
      throw new ValidationError({
        htmlErrors: result.error.issues.map((issue) => ({
          tag: element.tagName,
          attribute: issue.path.join('.') || attr,
          message: issue.message,
        })),
      })
    }
    element.setAttribute(attr, `${val}`)
  }
}

export type RendererResult = {
  type: typeof RENDERER_RESULTS_MESSAGE_TYPES.attrs_result | typeof RENDERER_RESULTS_MESSAGE_TYPES.render_result
  detail: {
    id: string
    target: string
    html: string
  }
}

/**
 * Server-side renderer — the SSR counterpart to the browser Controller.
 *
 * @remarks
 * The Controller applies `render`/`attrs` commands to a live DOM (browser,
 * WebSocket-driven). The Renderer applies the same commands to an HTML string
 * held in memory (Bun process, {@link HTMLRewriter}-driven). One instance owns
 * one buffer: `render`/`attrs` mutate the buffer in place and re-store it, and
 * {@link Renderer.html} reads the current state. A behavioral program's handlers
 * call {@link Renderer.render} / {@link Renderer.attrs} directly to drive SSR.
 *
 * The Renderer is a strict subset of the Controller: everything needing a live
 * DOM (WebSocket transport, page lifecycle, `p-trigger`/`p-form` binding,
 * `dispatch_custom_event`, `navigate`, stylesheet adoption) is dropped. Its
 * entire surface is {@link Renderer.render}, {@link Renderer.attrs}, and the
 * {@link Renderer.html} getter.
 *
 * ## Synchronous transform
 *
 * Bun's `HTMLRewriter.transform(string)` overload returns a `string`
 * synchronously, and the element handlers used here are synchronous (no `await`
 * inside). `render`/`attrs` therefore return a {@link BPEvent} directly rather
 * than a `Promise<BPEvent>`. The bProgram handler that calls them may still be
 * async; that is its concern, not the Renderer's. Because no `await` occurs
 * inside an element handler, Bun's async-handler error-propagation limitation
 * does not apply, and no deferred-error pattern is needed.
 *
 * ## Zero-match contract
 *
 * The Controller's `querySelectorAll` loop throws {@link ElementNotFoundError}
 * only when a node is `null` mid-iteration — an empty `NodeList` is a no-op.
 * The Renderer mirrors that exactly: `HTMLRewriter.on()` simply does not fire
 * on zero matches, and there is no genuine lookup-failure mode for a string
 * transform. The Renderer therefore never throws {@link ElementNotFoundError}.
 * A command that matches nothing leaves the buffer unchanged — except that
 * {@link Renderer.render} validates its payload HTML via
 * {@link validateAndEscapeHtml} before the selector match, so an XSS-laden or
 * schema-invalid payload throws {@link ValidationError} even when no
 * `[p-target]` element matches (security: never silently accept a dangerous
 * payload). The constructor and {@link Renderer.attrs} also throw
 * {@link ValidationError} when an `on*` handler attribute is requested or an
 * attribute value fails per-tag schema validation. The behavioral engine's
 * `feedback_error` snapshot mechanism captures those throws.
 *
 * ## Returned `RendererResult` shape
 *
 * `render`/`attrs` return a {@link RendererResult} whose `type` is
 * {@link RENDERER_RESULTS_MESSAGE_TYPES.render_result} /
 * {@link RENDERER_RESULTS_MESSAGE_TYPES.attrs_result} and whose `detail` is
 * `{ id, target, html }` — `html` is the new buffer state so the calling
 * bProgram handler can thread state forward.
 *
 * @public
 */
export class Renderer {
  /** The current buffer state. Each `render`/`attrs` mutates and re-stores it. */
  #html: string

  /**
   * Construct with the initial HTML string held as owned mutable state.
   *
   * @param args.html - The HTML document fragment string to own and mutate.
   */
  constructor({ html }: { html: string }) {
    this.#html = validateAndEscapeHtml(html)
  }

  /** The current buffer state. Each `render`/`attrs` mutates and re-stores it. */
  get html(): string {
    return this.#html
  }

  /**
   * Apply a `render` command — insert or replace content at every element
   * matching the `p-target` selector — and return a success {@link RendererResult}.
   *
   * @remarks
   * Targets all matches (mirroring `querySelectorAll`): the `match` operator
   * interpolates directly into the attribute selector
   * `[p-target${match}"${target}"]`, and `HTMLRewriter.on` fires the handler
   * for every match. Zero matches leaves the buffer unchanged, but the payload
   * HTML is validated via {@link validateAndEscapeHtml} before matching — an
   * invalid payload throws {@link ValidationError} even with zero matches.
   *
   * @param detail - A {@link RenderMessage} detail: `target`, `html`, `swap`,
   *   `id`, and optional `match` (defaults to `=`).
   * @returns A {@link RendererResult} of type {@link RENDERER_RESULTS_MESSAGE_TYPES.render_result}
   *   with `detail = { id, target, html }` where `html` is the new buffer.
   */
  render({ target, html, swap, id, match = '=' }: RenderMessage['detail']): RendererResult {
    const validatedHtml = validateAndEscapeHtml(html)
    this.#html = new HTMLRewriter()
      .on(`[${P_TARGET}${match}"${target}"]`, {
        element: (element) => {
          applySwap({ element, html: validatedHtml, swap })
        },
      })
      .transform(this.#html)
    return { type: RENDERER_RESULTS_MESSAGE_TYPES.render_result, detail: { id, target, html: this.#html } }
  }

  /**
   * Apply an `attrs` command — merge an attribute map into every element
   * matching the `p-target` selector — and return a success {@link RendererResult}.
   *
   * @remarks
   * Targets all matches and applies {@link updateAttributes} for each key in
   * `attr`. Zero matches is a no-op (see class doc). Throws
   * {@link ValidationError} when an `on*` attribute is requested or an
   * attribute value fails per-tag schema validation.
   *
   * @param detail - An {@link AttrsMessage} detail: `target`, `attr`, `id`, and
   *   optional `match` (defaults to `=`).
   * @returns A {@link RendererResult} of type {@link RENDERER_RESULTS_MESSAGE_TYPES.attrs_result}
   *   with `detail = { id, target, html }` where `html` is the new buffer.
   */
  attrs({ target, attr, id, match = '=' }: AttrsMessage['detail']): RendererResult {
    this.#html = new HTMLRewriter()
      .on(`[${P_TARGET}${match}"${target}"]`, {
        element: (el) => {
          for (const key in attr) updateAttributes({ element: el, attr: key, val: attr[key]! })
        },
      })
      .transform(this.#html)
    return { type: RENDERER_RESULTS_MESSAGE_TYPES.attrs_result, detail: { id, target, html: this.#html } }
  }
}
