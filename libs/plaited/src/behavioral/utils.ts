import { BPEvent, BPEventTemplate } from '../types.js'
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

export { defaultLogger } from './default-logger.js'
