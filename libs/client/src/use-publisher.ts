import { BPEvent, Trigger } from '@plaited/behavioral'
import { onlyObservedTriggers } from './only-observed-triggers.js'
import { Publisher, PlaitedElement } from '@plaited/types'
/**
 * @description  Creates a new BPEvent publisher.
 * A publisher object is a function that can be called with a value of type BPEvent,
 * which will notify all subscribed listeners with that value.
 * Listeners use the `subscribe` method connect to the publisher.
 * @returns A new publisher object.
 **/
export const usePublisher = (): Publisher => {
  const listeners = new Set<(value: BPEvent) => void>()

  function createPublisher(value: BPEvent) {
    for (const cb of listeners) {
      cb(value)
    }
  }

  /**
   * Subscribes a listener to the publisher.
   * @param listener - The listener function to connect.
   * @returns A function that can be called to unsubscribe the listener.
   */
  createPublisher.connect = (trigger: Trigger, observedTriggers: string[] | PlaitedElement) => {
    const _trigger = onlyObservedTriggers(trigger, observedTriggers)
    listeners.add(_trigger)
    return () => {
      listeners.delete(_trigger)
    }
  }

  createPublisher.type = 'publisher' as const

  return createPublisher
}
