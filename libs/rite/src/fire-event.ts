/**
 * The arguments for the event.
 */
type EventArguments = {
  bubbles?: boolean
  composed?: boolean
  cancelable?: boolean
  detail?: Record<string, unknown>
}

/**
 * Fires an event on the given element.
 * @param element The element to fire the event on.
 * @param eventName The name of the event to fire.
 * @param options The options for the event.
 * @returns A promise that resolves when the event has been fired.
 */
export const fireEvent = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
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
