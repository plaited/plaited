type EventArguments = {
  bubbles?: boolean
  composed?: boolean
  cancelable?: boolean
  detail?: Record<string, unknown>
}

export const fireEvent = (
  element: HTMLElement | SVGElement,
  eventName: string,
  options: EventArguments = {
    bubbles: true,
    composed: true,
    cancelable: true,
  },
): Promise<void> => {
  const createEvent = (type: string): Event => {
    if (options?.detail) {
      return new CustomEvent(type, options)
    } else {
      return new Event(type, options)
    }
  }

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const event = createEvent(eventName)
      element.dispatchEvent(event)
      resolve()
    })
  })
}
