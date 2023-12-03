import { BPEvent, BPEventTemplate, Strategy, Publisher } from './types.js'
import { publisher as _publisher } from './publisher.js'

/** @description RandomEvent Event template selects a random event from a list of events */
export const randomEvent: BPEventTemplate = (...events: BPEvent[]) =>
  events[Math.floor(Math.random() * Math.floor(events.length))]

/** @description Chaos BPEvent Selection Strategy */
export const chaosStrategy: Strategy = (filteredEvents) =>
  filteredEvents[Math.floor(Math.random() * Math.floor(filteredEvents.length))]

/** @description Priority Queue BPEvent Selection Strategy */
export const priorityStrategy: Strategy = (filteredEvents) =>
  filteredEvents.sort(({ priority: priorityA }, { priority: priorityB }) => priorityA - priorityB)[0]

/**
 * @description  Creates a new BPEvent publisher.
 * A publisher object is a function that can be called with a value of type BPEvent,
 * which will notify all subscribed listeners with that value.
 * It also has a `subscribe` method that allows listeners to subscribe to the publisher.
 * @returns A new publisher object.
 **/
export const publisher = <T extends BPEvent = BPEvent>(): Publisher<T> => _publisher<T>()
