type EventArguments = {
  bubbles?: boolean
  composed?: boolean
  cancelable?: boolean
  detail?: Record<string, unknown>
}

export const fireEvent = <T extends (HTMLElement | SVGElement) = (HTMLElement | SVGElement)>(
  element: T,
  eventName: string,
  options: EventArguments = {
    bubbles: true,
    composed: true,
    cancelable: true,
  }
): Promise<void> => {
  const createEvent = (): Event => {
    if (options?.detail) {
      return new CustomEvent(eventName, options)
    } else {
      return new Event(eventName, options)
    }
  }

  return new Promise(resolve => {
    requestAnimationFrame(() => {
      const event = createEvent()
      element.dispatchEvent(event)
      resolve()
    })
  })
}
