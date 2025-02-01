import type { BSync } from './b-thread.js'

/** @summary Shuffle synchronization bSync statements */
export const shuffleSyncs = (...syncs: BSync[]) => {
  for (let i = syncs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[syncs[i], syncs[j]] = [syncs[j], syncs[i]]
  }
  return syncs
}
