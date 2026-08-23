import type { BPEvent } from './behavioral.schemas.ts'
import { BOOLEAN_ATTRS, P_SCALE, P_TARGET, SCALE, SCALE_RANK } from './html.constants.ts'
import { validateAndEscapeHtml, validateAttributeValue } from './html-rewriter.utils.ts'
import { RENDERER_RESULTS_MESSAGE_TYPES, SWAP_MODES, SWAP_TARGETS } from './message.constants.ts'
import type { AttrsMessage, RenderMessage, ScaleCheckMessage } from './message.schemas.ts'
import { ValidationError } from './render.errors.ts'
import { swapBoundary } from './swap-boundary.ts'

/**
 * Apply one attribute update to a Bun {@link HTMLRewriter} element, with
 * validation. Rules: null + present → removeAttribute; null + absent → no-op;
 * {@link BOOLEAN_ATTRS} member → set bare when absent; otherwise setAttribute
 * (when changed) after validating the value via {@link validateAttributeValue}.
 * The rewriter serializes attribute values itself; no manual escaping.
 *
 * @param element - The {@link HTMLRewriterTypes.Element} to mutate.
 * @param attr - The attribute name.
 * @param val - The new value (or `null` to remove).
 * @throws {ValidationError} when the value fails `on*` or per-tag schema
 *   validation.
 * @public
 */
export const updateAttributes = ({
  element,
  attr,
  val,
}: {
  element: HTMLRewriterTypes.Element
  attr: string
  val: string | null | number | boolean
}): void => {
  if (val === null && element.hasAttribute(attr)) {
    element.removeAttribute(attr)
    return
  }
  if (val === null) return
  if (BOOLEAN_ATTRS.has(attr)) {
    if (!element.hasAttribute(attr)) element.setAttribute(attr, '')
    return
  }
  if (element.getAttribute(attr) !== `${val}`) {
    validateAttributeValue({ tag: element.tagName, attr, val })
    element.setAttribute(attr, `${val}`)
  }
}

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

export type RendererResult =
  | {
      type: typeof RENDERER_RESULTS_MESSAGE_TYPES.attrs_result | typeof RENDERER_RESULTS_MESSAGE_TYPES.render_result
      detail: { id: string; target: string; html: string }
    }
  | {
      type: typeof RENDERER_RESULTS_MESSAGE_TYPES.scale_check_result
      detail: { id: string; target: string; effectiveScale: keyof typeof SCALE }
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

  /**
   * Pre-flight read: resolve the structural scale context a `render` into or
   * beside this `target` would nest inside.
   *
   * @remarks
   * Walks the owned buffer with a single read-only `HTMLRewriter` pass,
   * maintaining an open-element stack to track ancestor `p-scale` values.
   * For every `[p-target]` match, resolves the effective structural boundary:
   *
   * - **Into modes** (`afterbegin`, `beforeend`, `innerHTML`): the target IS
   *   the container → read its own `p-scale`; if absent, inherit the nearest
   *   ancestor's.
   * - **Replace/beside modes** (`beforebegin`, `afterend`, `outerHTML`): the
   *   target's PARENT is the container → read the nearest ancestor's `p-scale`
   *   (the target's own scale does not govern).
   *
   * Across multiple matches, returns the **most restrictive** (lowest-rank)
   * effective scale, so a single content blob respects every target's
   * boundary. Zero matches or no `p-scale` found anywhere → `rel` (scale-less,
   * permissive).
   *
   * Advisory only — does not enforce nesting. The agent calls this before
   * `render` to learn the boundary its content must respect.
   *
   * @param detail - `{ target, swap, id, match }` (no `html` — this is a read).
   * @returns A {@link RendererResult} of type `scale_check_result` with
   *   `detail = { id, target, effectiveScale }`.
   */
  scaleCheck({ target, swap, id, match = '=' }: ScaleCheckMessage['detail']): RendererResult {
    const boundary = swapBoundary(swap)
    const stack: (string | null)[] = []
    const scales: (keyof typeof SCALE)[] = []

    new HTMLRewriter()
      .on('*', {
        element(el) {
          if (el.canHaveContent) {
            stack.push(el.getAttribute(P_SCALE))
            el.onEndTag(() => void stack.pop())
          }
        },
      })
      .on(`[${P_TARGET}${match}"${target}"]`, {
        element(el) {
          const ownScale = el.getAttribute(P_SCALE)
          let scale: string | null = null
          if (boundary === SWAP_TARGETS.self && ownScale) {
            scale = ownScale
          } else {
            const ancestorStart = el.canHaveContent ? stack.length - 2 : stack.length - 1
            for (let i = ancestorStart; i >= 0; i--) {
              const pScale = stack[i]
              if (pScale) {
                scale = pScale
                break
              }
            }
          }
          scales.push((scale ?? SCALE.rel) as keyof typeof SCALE)
        },
      })
      .transform(this.#html)

    const effectiveScale: keyof typeof SCALE =
      scales.filter((s) => s !== SCALE.rel).sort((a, b) => SCALE_RANK[a] - SCALE_RANK[b])[0] ?? SCALE.rel

    return {
      type: RENDERER_RESULTS_MESSAGE_TYPES.scale_check_result,
      detail: { id, target, effectiveScale },
    }
  }
}
