/**
 * Creates a new publisher object.
 * A publisher object is a function that can be called with a value of type T,
 * which will notify all subscribed listeners with that value.
 * It also has a `subscribe` method that allows listeners to subscribe to the publisher.
 * @returns A new publisher object.
 */
export const publisher = <T>() => {
  const listeners = new Set<(value: T) => void>()

  function createPublisher(value: T) {
    for (const cb of listeners) {
      cb(value)
    }
  }

  /**
   * Subscribes a listener to the publisher.
   * @param listener - The listener function to subscribe.
   * @returns A function that can be called to unsubscribe the listener.
   */
  createPublisher.subscribe = (listener: (msg: T) => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return createPublisher
}
