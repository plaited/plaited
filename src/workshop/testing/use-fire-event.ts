import type { Trigger } from '../../behavioral/b-program.js'
import type { FireEvent, FireEventDetail, FireEventOptions } from './testing.types.js'

export const FIRE_EVENT = 'fire_event'

export const useFireEvent = (trigger: Trigger) => {
  /**
   * Asynchronously dispatches DOM events with configurable options.
   * Supports both native and custom events with detail data.
   *
   * @template T Element type (defaults to HTMLElement | SVGElement)
   * @param element Target element for event
   * @param eventName Event type to dispatch
   * @param options Event configuration (defaults to bubbling and composed)
   * @returns Promise<void> Resolves after event dispatch
   *
   * @example Basic Event
   * ```ts
   * // Fire click event
   * await fireEvent(button, 'click');
   *
   * // Fire custom event
   * await fireEvent(element, 'custom-event');
   * ```
   *
   * @example With Custom Data
   * ```ts
   * // Fire event with detail
   * await fireEvent(element, 'update', {
   *   detail: { value: 42 }
   * });
   * ```
   *
   * @example Configuration
   * ```ts
   * // Configure event behavior
   * await fireEvent(element, 'change', {
   *   bubbles: false,
   *   cancelable: true,
   *   detail: { data: 'value' }
   * });
   * ```
   *
   * Default Options:
   * - bubbles: true
   * - composed: true
   * - cancelable: true
   *
   * Features:
   * - Support for CustomEvent
   * - Configurable bubbling
   * - Shadow DOM composition
   * - Event cancellation
   * - Type safety
   * - Async operation
   *
   * @remarks
   * - Uses requestAnimationFrame for timing
   * - Automatically selects Event vs CustomEvent
   * - Maintains event defaults
   * - Type-safe element handling
   * - Returns Promise for async operations
   *
   */
  const fireEvent: FireEvent = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
    element: T,
    eventName: string,
    options: FireEventOptions = {
      bubbles: true,
      composed: true,
      cancelable: true,
    },
  ): Promise<void> => {
    trigger<FireEventDetail>({ type: FIRE_EVENT, detail: [element, eventName, options] })
    const createEvent = (): Event => {
      if (options?.detail) {
        return new CustomEvent(eventName, options)
      } else {
        return new Event(eventName, options)
      }
    }

    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        const event = createEvent()
        element.dispatchEvent(event)
        resolve()
      })
    })
  }
  return fireEvent
}
