/**
 * Public type definitions for the Plaited controller system.
 *
 * @remarks
 * Defines the shapes for constructor arguments, extension registration, and
 * agent card metadata used by {@link Controller}.
 *
 * @packageDocumentation
 */

import type { Trigger } from '../../behavioral/behavioral.types.ts'

/**
 * Resolves the specific event map for a given concrete event target type.
 *
 * @template T - The event target (`HTMLElement` or `Window`)
 *
 * @remarks
 * Most HTML elements share the events defined in `HTMLElementEventMap`
 * (click, mouseenter, input, change, keydown, etc.). Only elements that
 * introduce **additional** unique events have their own maps:
 *
 * | Target | Unique events |
 * |---|---|
 * | `HTMLMediaElement` / `HTMLVideoElement` | `play`, `pause`, `seeking`, `volumechange`, etc. |
 * | `HTMLBodyElement` / `HTMLFrameSetElement` | `afterprint`, `beforeunload`, `hashchange`, `storage`, etc. |
 * | `Window` | Full set at {@link https://developer.mozilla.org/en-US/docs/Web/API/Window#events | MDN} |
 *
 * All other elements (`HTMLSpanElement`, `HTMLDivElement`, `HTMLInputElement`,
 * `HTMLButtonElement`, etc.) resolve to the shared `HTMLElementEventMap`.
 *
 * @see {@link ElementEvent} for resolving a single event payload from a target + key
 */
export type ElementEventMap<T extends HTMLElement | Window> = T extends Window
  ? WindowEventMap
  : T extends HTMLVideoElement
    ? HTMLVideoElementEventMap
    : T extends HTMLMediaElement
      ? HTMLMediaElementEventMap
      : T extends HTMLBodyElement
        ? HTMLBodyElementEventMap
        : /* fallback – div, span, input, button, form, section, p, h1–h6, a, etc. */
          HTMLElementEventMap

/**
 * Resolves the event payload type for a given event target and event name.
 *
 * @template T     - The event target (`HTMLElement` or `Window`)
 * @template TEvent - The event key to look up (defaults to a union of **all** event keys
 *                    for the target, so you get the union of all event payloads)
 *
 * @remarks
 * When **only the target type** is supplied, `TEvent` defaults to
 * `keyof ElementEventMap<T>` — a union of every event name — so the resulting
 * type resolves to a union of every possible event payload for that target.
 *
 * When **both** the target and a specific event name are supplied, the type
 * resolves to the single corresponding event payload (e.g. `MouseEvent` for
 * `'mouseenter'` on `HTMLSpanElement`, or `PageTransitionEvent` for
 * `'pageshow'` on `Window`).
 */
export type ElementEvent<
  T extends HTMLElement | Window,
  TEvent extends keyof ElementEventMap<T> = keyof ElementEventMap<T>,
> = ElementEventMap<T>[TEvent]

/**
 * Context object passed to imported controller extensions.
 *
 * @remarks
 * Provides the primitives a controller extension needs to read the DOM event
 * and trigger behavioral events back to the agent. Extensions are invoked
 * per matching DOM event (not once at setup), so any listener wiring that
 * needs to outlive a single event must be done against `event.currentTarget`
 * within the handler.
 *
 * @public
 */
export type ControllerExtensionParams<
  T extends HTMLElement | Window = HTMLElement,
  TEvent extends keyof ElementEventMap<T> = keyof ElementEventMap<T>,
> = {
  event: ElementEvent<T, TEvent>
  /** Triggers a behavioral event on the controller's page. */
  trigger: Trigger
}

/**
 * Type for a controller extension function.
 *
 * @remarks
 * Each extension is registered in the Controller constructor via the
 * `extensions` map keyed by trigger pair strings (e.g. `"click:my_action"`).
 * When a `p-trigger` attribute value matches an extension key, the function
 * is invoked on each matching DOM event and receives the event plus a
 * `trigger` for emitting behavioral events. It returns nothing (synchronous
 * or promise-based); rejected promises are reported to the agent as errors.
 *
 * @see {@link ControllerExtensionParams} for the received context
 * @public
 */
export type ControllerExtension<
  T extends HTMLElement | Window = HTMLElement,
  TEvent extends keyof ElementEventMap<T> = keyof ElementEventMap<T>,
> = (params: ControllerExtensionParams<T, TEvent>) => void | Promise<void>

/**
 * Arguments for constructing a {@link Controller}.
 *
 * @public
 */
export type ControllerConstructorArgs = {
  /**
   * Optional map of trigger-pair keys to extension functions.
   * Keys follow the pattern `"<domEvent>:<action>"` (e.g. `"click:my_handler"`)
   * and are matched against `p-trigger` attribute values on elements.
   */
  extensions?: Map<string, ControllerExtension>
  /** Called on {@link https://developer.mozilla.org/en-US/docs/Web/API/Window/pagereveal_event | pagereveal}. */
  onPageReveal?: ControllerExtension<Window, 'pagereveal'>
  /** Called on {@link https://developer.mozilla.org/en-US/docs/Web/API/Window/pageswap_event | pageswap}. */
  onPageSwap?: ControllerExtension<Window, 'pageswap'>
  /** Called on {@link https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event | pageshow}. */
  onPageShow?: ControllerExtension<Window, 'pageshow'>
  /** Called on {@link https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event | pagehide}. */
  onPageHide?: ControllerExtension<Window, 'pagehide'>
}
