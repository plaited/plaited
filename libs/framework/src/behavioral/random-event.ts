import type { BPEvent } from './types.js'

/** @description RandomEvent Event template selects a random event from a list of events */
export const randomEvent = (...events: BPEvent[]) => events[Math.floor(Math.random() * Math.floor(events.length))]
