import type { Trigger, Disconnect } from '../behavioral/b-program.js'

/**
 * Extended trigger type that includes cleanup callback registration.
 * Combines the base Trigger functionality with the ability to add disconnect handlers.
 */
export type PlaitedTrigger = Trigger & {
  addDisconnectCallback: (disconnect: Disconnect) => void
}
/**
 * Creates an enhanced trigger with disconnect callback support.
 * @param trigger Base trigger function to be extended
 * @param disconnectSet Set to store cleanup callbacks
 * @returns A PlaitedTrigger that can register cleanup functions
 */
export const getPlaitedTrigger = (trigger: Trigger, disconnectSet: Set<Disconnect>) => {
  Object.assign(trigger, {
    addDisconnectCallback: (cb: Disconnect) => disconnectSet.add(cb),
  })
  return trigger as PlaitedTrigger
}
