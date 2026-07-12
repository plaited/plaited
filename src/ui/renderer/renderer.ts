import { B_PROGRAM_MESSAGE_TYPES, SWAP_MODES } from '../../b-program/message.constants.ts'
import type { AttrsMessage, RenderMessage } from '../../b-program/message.schemas.ts'
import type { BPEvent } from '../../behavioral.ts'
import { BOOLEAN_ATTRS, P_TARGET } from '../html.constants.ts'

/**
 * Port of the browser {@link Controller}'s `updateAttributes` helper, retargeted
 * at the Bun {@link HTMLRewriter} element API. The HTMLRewriter element exposes
 * the same `getAttribute`/`hasAttribute`/`setAttribute`/`removeAttribute` surface
 * as a live DOM `Element`, so the rules port verbatim — only the boolean branch
 * adapts: HTMLRewriter has no `toggleAttribute`, so a present-but-valueless
 * attribute is set via `setAttribute(attr, '')`.
 *
 * Rules:
 * - `null` + present → `removeAttribute`
 * - `null` + absent → no-op
 * - {@link BOOLEAN_ATTRS} member → set bare when absent (presence = truthy)
 * - otherwise → `setAttribute(attr, String(val))` when the value changed
 *
 * The HTMLRewriter serializer escapes attribute values itself; values are passed
 * through as `String(val)` without manual escaping (matching the Controller).
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
  if (val === null && element.hasAttribute(attr)) return element.removeAttribute(attr)
  if (val === null) return
  if (BOOLEAN_ATTRS.has(attr)) {
    if (!element.hasAttribute(attr)) element.setAttribute(attr, '')
    return
  }
  if (element.getAttribute(attr) !== `${val}`) element.setAttribute(attr, `${val}`)
}

/**
 * Apply one swap-mode insertion to a matching HTMLRewriter element. Each mode
 * maps to a single HTMLRewriter element method, all with `{ html: true }` since
 * the payload is a markup fragment. Mirrors the Controller's `#performSwitch`.
 *
 * @internal
 */
const applySwap = (element: HTMLRewriterTypes.Element, html: string, swap: RenderMessage['detail']['swap']) => {
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
 * Server-side renderer — the SSR counterpart to the browser
 * {@link Controller}.
 *
 * @remarks
 * The Controller applies `render`/`attrs` commands to a live DOM (browser,
 * WebSocket-driven). The Renderer applies the same commands to an HTML string
 * held in memory (Bun process, {@link HTMLRewriter}-driven). One instance owns
 * one buffer: `render`/`attrs` mutate the buffer in place and re-store it, and
 * {@link Renderer.html} reads the current state. A behavioral program's
 * handlers call {@link Renderer.render} / {@link Renderer.attrs} directly to
 * drive SSR.
 *
 * The Renderer is intentionally a strict subset of the Controller: everything
 * that needs a live DOM (WebSocket transport, page lifecycle, `p-trigger` /
 * `p-form` binding, `dispatch_custom_event`, `navigate`, stylesheet adoption)
 * is dropped. Its entire surface is {@link Renderer.render},
 * {@link Renderer.attrs}, and the {@link Renderer.html} getter.
 *
 * ## Synchronous transform
 *
 * Bun's `HTMLRewriter.transform(string)` overload returns a `string`
 * synchronously, and the element handlers used here are synchronous (no `await`
 * inside). `render`/`attrs` therefore return a {@link BPEvent} directly rather
 * than a `Promise<BPEvent>`. The bProgram handler that calls them may still be
 * async; that is its concern, not the Renderer's.
 *
 * ## Zero-match contract
 *
 * The Controller's `querySelectorAll` loop throws {@link ElementNotFoundError}
 * only when a node is `null` mid-iteration — an `empty NodeList is a no-op`.
 * The Renderer mirrors that exactly: HTMLRewriter's `.on()` simply does not fire
 * on zero matches, and there is no genuine lookup-failure mode for a string
 * transform, so the Renderer never throws {@link ElementNotFoundError} (or any
 * other error class). A command that matches nothing is a no-op that returns a
 * success {@link BPEvent} and leaves the buffer unchanged. There is no throw
 * path to test; the behavioral engine's `feedback_error` snapshot mechanism is
 * not exercised by this module.
 *
 * ## Returned BPEvent shape
 *
 * `render`/`attrs` return a {@link BPEvent} whose `type` reuses
 * {@link B_PROGRAM_MESSAGE_TYPES.render} / {@link B_PROGRAM_MESSAGE_TYPES.attrs}
 * and whose `detail` carries `{ id, target, html }` — the `html` is the new
 * buffer state so the calling bProgram handler can thread state forward.
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
    this.#html = html
  }

  /** The current buffer state. Each `render`/`attrs` mutates and re-stores it. */
  get html(): string {
    return this.#html
  }

  /**
   * Apply a `render` command — insert or replace content at every element
   * matching the `p-target` selector — and return a success {@link BPEvent}.
   *
   * @remarks
   * Targets all matches (mirroring `querySelectorAll`): the `match` operator
   * interpolates directly into the attribute selector
   * `[p-target${match}"${target}"]`, and HTMLRewriter fires the handler for
   * every match. Zero matches is a no-op (see class doc). Throws never.
   *
   * @param detail - A {@link RenderMessage} detail: `target`, `html`, `swap`,
   *   `id`, and optional `match` (defaults to `=`).
   * @returns A {@link BPEvent} of type {@link B_PROGRAM_MESSAGE_TYPES.render}
   *   with `detail = { id, target, html }` where `html` is the new buffer.
   */
  render({ target, html, swap, id, match = '=' }: RenderMessage['detail']): BPEvent {
    this.#html = new HTMLRewriter()
      .on(`[${P_TARGET}${match}"${target}"]`, {
        element: (el) => {
          applySwap(el, html, swap)
        },
      })
      .transform(this.#html)
    return { type: B_PROGRAM_MESSAGE_TYPES.render, detail: { id, target, html: this.#html } }
  }

  /**
   * Apply an `attrs` command — merge an attribute map into every element
   * matching the `p-target` selector — and return a success {@link BPEvent}.
   *
   * @remarks
   * Targets all matches and applies {@link updateAttributes} for each key in
   * `attr`. Zero matches is a no-op (see class doc). Throws never.
   *
   * @param detail - An {@link AttrsMessage} detail: `target`, `attr`, `id`, and
   *   optional `match` (defaults to `=`).
   * @returns A {@link BPEvent} of type {@link B_PROGRAM_MESSAGE_TYPES.attrs}
   *   with `detail = { id, target, html }` where `html` is the new buffer.
   */
  attrs({ target, attr, id, match = '=' }: AttrsMessage['detail']): BPEvent {
    this.#html = new HTMLRewriter()
      .on(`[${P_TARGET}${match}"${target}"]`, {
        element: (el) => {
          for (const key in attr) updateAttributes({ element: el, attr: key, val: attr[key]! })
        },
      })
      .transform(this.#html)
    return { type: B_PROGRAM_MESSAGE_TYPES.attrs, detail: { id, target, html: this.#html } }
  }
}
