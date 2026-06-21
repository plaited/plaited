/**
 * Public type definitions for the Plaited controller system.
 *
 * @remarks
 * Defines the shapes for constructor arguments, extension registration, and
 * agent card metadata used by {@link Controller}.
 *
 * @packageDocumentation
 */

import type { Disconnect, JsonObject, Trigger } from '../behavioral.ts'

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
 * @example
 * ```ts
 * type A = ElementEventMap<HTMLSpanElement>    // HTMLElementEventMap
 * type B = ElementEventMap<HTMLInputElement>   // HTMLElementEventMap
 * type C = ElementEventMap<HTMLMediaElement>   // HTMLMediaElementEventMap
 * type D = ElementEventMap<HTMLVideoElement>   // HTMLVideoElementEventMap
 * type E = ElementEventMap<Window>             // WindowEventMap
 * ```
 */
export type ElementEventMap<T extends HTMLElement | Window> =
  T extends Window ? WindowEventMap :
  T extends HTMLVideoElement ? HTMLVideoElementEventMap :
  T extends HTMLMediaElement ? HTMLMediaElementEventMap :
  T extends HTMLBodyElement ? HTMLBodyElementEventMap :
  /* fallback – div, span, input, button, form, section, p, h1–h6, a, etc. */
  HTMLElementEventMap;

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
 *
 * @example
 * ```ts
 * // All events for a span (default): union of all HTMLElementEventMap values
 * type AllSpanEvents = ElementEvent<HTMLSpanElement>;
 *
 * // Single event key: resolves to MouseEvent
 * type EnterEvent = ElementEvent<HTMLSpanElement, 'mouseenter'>;
 *
 * // Input element's input event: resolves to InputEvent
 * type InputEvent = ElementEvent<HTMLInputElement, 'input'>;
 *
 * // Media element's play event: resolves to Event
 * type PlayEvent = ElementEvent<HTMLVideoElement, 'play'>;
 *
 * // Window page lifecycle events
 * type RevealEvent = ElementEvent<Window, 'pagereveal'>;
 * type SwapEvent   = ElementEvent<Window, 'pageswap'>;
 * type ShowEvent   = ElementEvent<Window, 'pageshow'>;
 * type HideEvent   = ElementEvent<Window, 'pagehide'>;
 *
 * // All window events
 * type AllWindowEvents = ElementEvent<Window>;
 * ```
 */
export type ElementEvent<
  T extends HTMLElement | Window,
  TEvent extends keyof ElementEventMap<T> = keyof ElementEventMap<T>
> = ElementEventMap<T>[TEvent];

/**
 * Context object passed to imported controller extensions.
 *
 * @remarks
 * Provides the primitives a controller extension needs to wire DOM event
 * listeners, trigger behavioral events, register cleanup callbacks, and
 * report runtime errors back to the agent.
 *
 * @public
 */
export type ControllerExtensionParams<T extends HTMLElement  | Window = HTMLElement,   TEvent extends keyof ElementEventMap<T> = keyof ElementEventMap<T>> = {
  event: ElementEvent<T, TEvent>
  /** Registers a cleanup callback invoked when the controller disconnects. */
  addDisconnect: (disconnect: Disconnect) => void
  /** Triggers a behavioral event on the controller's topic. */
  trigger: Trigger
  /** Reports a runtime error back to the agent with an optional description and context. */
  reportError: (error: unknown, metadata?: { description?: string; context?: JsonObject }) => void
}

/**
 * Type for a controller extension function.
 *
 * @remarks
 * Each extension is registered in the Controller constructor via the
 * `extensions` map keyed by trigger pair strings (e.g. `"click:my_action"`).
 * When a `p-trigger` attribute value matches an extension key, the setup
 * function receives controller context primitives and returns nothing
 * (synchronous or promise-based).
 *
 * @example
 * ```ts
 * // my-controller-module.ts
 * import type { ControllerExtension } from 'plaited/ui'
 *
 * const setup: ControllerExtension = ({ element, trigger, addDisconnect }) => {
 *   const handler = () => {
 *     trigger({ type: 'my_event', detail: { key: 'value' } })
 *   }
 *   element.addEventListener('click', handler)
 *   addDisconnect(() => element.removeEventListener('click', handler))
 * }
 *
 * export default setup
 * ```
 *
 * @public
 */
export type ControllerExtension<T extends HTMLElement | Window = HTMLElement,  TEvent extends keyof ElementEventMap<T> = keyof ElementEventMap<T>> = (
  params: ControllerExtensionParams<T, TEvent>,
) => void | Promise<void>

/**
 * Agent card describing a controller's remote agent.
 *
 * @remarks
 * Provided to the Controller constructor and returned to the Flutter host on
 * `agent/getCard` requests.
 *
 * @public
 */
export type AgentCard = {
  /** Human-readable name for the agent. */
  name: string
  /** Description of the agent's capabilities. */
  description: string
  /** Organization providing the agent. */
  provider?: {
    organization: string
  }
  /** Tasks the agent can perform. */
  skills?: {
    id: string
    name: string
    description: string
    tags?: string[]
    examples?: string[]
  }[]
}

/**
 * Arguments for constructing a {@link Controller}.
 *
 * @public
 */
export type ControllerConstructorArgs = {
  /** Agent card describing the remote agent. */
  agentCard: AgentCard
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
