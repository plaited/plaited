/**
 * Configuration options for DOM event dispatch.
 * Used to customize event behavior and include additional data.
 *
 * @typedef {Object} EventArguments
 * @property {boolean} [bubbles] - Whether the event bubbles up through the DOM tree. Defaults to true
 * @property {boolean} [composed] - Whether the event can cross shadow DOM boundaries. Defaults to true
 * @property {boolean} [cancelable] - Whether the event can be canceled. Defaults to true
 * @property {Record<string, unknown>} [detail] - Custom data to be included with the event. When provided, creates a CustomEvent
 *
 * @example
 * ```ts
 * const options: EventArguments = {
 *   bubbles: true,
 *   composed: true,
 *   detail: { value: 'test' }
 * };
 * ```
 */
type EventArguments = {
  bubbles?: boolean
  composed?: boolean
  cancelable?: boolean
  detail?: Record<string, unknown>
}

/**
 * Type definition for the event dispatching utility function.
 * Provides a type-safe way to dispatch both standard DOM events and custom events.
 *
 * @template T - Element type that will receive the event. Defaults to HTMLElement | SVGElement
 *
 * @param element - Target DOM element that will receive the event
 * @param eventName - The name/type of the event to dispatch (e.g., 'click', 'custom-event')
 * @param options - Optional configuration for the event {@link EventArguments}
 * @returns Promise that resolves after the event has been dispatched
 *
 * @example Dispatching a standard DOM event
 * ```ts
 * // Fire a click event on a button
 * const button = document.querySelector('button');
 * await fireEvent(button, 'click');
 * ```
 *
 * @example Dispatching a custom event with data
 * ```ts
 * // Fire a custom event with detail data
 * const element = document.getElementById('target');
 * await fireEvent(element, 'my-custom-event', {
 *   detail: {
 *     value: 42,
 *     name: 'test'
 *   }
 * });
 * ```
 *
 * @example Working with Shadow DOM
 * ```ts
 * // Fire event that crosses shadow DOM boundaries
 * await fireEvent(shadowRoot.querySelector('.btn'), 'change', {
 *   composed: true,  // Allow event to cross shadow DOM boundary
 *   detail: { updated: true }
 * });
 * ```
 *
 * @remarks
 * This type ensures type safety when:
 * - Working with different element types (HTML/SVG)
 * - Configuring event options
 * - Handling custom event data
 *
 * The implementation uses requestAnimationFrame for proper event timing
 * and returns a Promise for async operation handling.
 */
export type FireEvent = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  element: T,
  eventName: string,
  options?: EventArguments,
) => Promise<void>

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
export const fireEvent: FireEvent = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  element: T,
  eventName: string,
  options: EventArguments = {
    bubbles: true,
    composed: true,
    cancelable: true,
  },
): Promise<void> => {
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
