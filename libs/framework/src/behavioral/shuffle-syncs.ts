import type { SynchronizationPoint } from './types.js'

/** @description Shuffle sync statements */
export const shuffleSyncs = (...syncs: SynchronizationPoint[]) => {
  for (let i = syncs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[syncs[i], syncs[j]] = [syncs[j], syncs[i]]
  }
  return syncs
}
