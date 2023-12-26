import { BPEvent, BPEventTemplate, Publisher } from './types.js'
import { publisher as _publisher } from './publisher.js'
import { sync } from './rules.js'

/** @description RandomEvent Event template selects a random event from a list of events */
export const randomEvent: BPEventTemplate = (...events: BPEvent[]) =>
  events[Math.floor(Math.random() * Math.floor(events.length))]

/** @description Shuffle sync statements */
export const shuffleSyncs = (...syncs: (typeof sync)[]) => {
  for (let i = syncs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[syncs[i], syncs[j]] = [syncs[j], syncs[i]]
  }
  return syncs
}

/**
 * @description  Creates a new BPEvent publisher.
 * A publisher object is a function that can be called with a value of type BPEvent,
 * which will notify all subscribed listeners with that value.
 * Listeners use the `subscribe` method connect to the publisher.
 * @returns A new publisher object.
 **/
export const publisher = <T extends BPEvent = BPEvent>(): Publisher<T> => {
  const pub = _publisher<T>() as Publisher<T>
  pub.type = 'publisher'
  return pub
}

export { defaultLogger } from './default-logger.js'
