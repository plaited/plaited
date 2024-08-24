import { isTypeOf } from '@plaited/utils'
import type { SynchronizationPoint, Synchronize } from './types.js'

/**
 * Creates a Rule Function from synchronization points.
 *
 * @param {...RulesFunction} args - An arbitrary number synchronization sets.
 * @returns {RulesFunction} A new behavioral thread that combines the provided synchronization sets.
 */
export const sync: Synchronize = (rules, repeat) => {
  return repeat ?
      function* () {
        while (isTypeOf<boolean>(repeat, 'boolean') ? repeat : repeat()) {
          const length = rules.length
          for (let i = 0; i < length; i++) {
            yield* rules[i]()
          }
        }
      }
    : function* () {
        const length = rules.length
        for (let i = 0; i < length; i++) {
          yield* rules[i]()
        }
      }
}

/**
 * Creates a synchronization point for a behavioral thread. At synchronization points,
 * each behavioral thread specifies three sets of parameters: request, waitFor, and block.
 *
 * @param {SynchronizationPoint} options - An object containing three properties: request, waitFor, and block. See [`SynchronizationPoint`](libs/behavioral/src/types.ts).
 * @param {BPEvent[] | BPEventTemplate} options.request - A behavioral program event or event template that the thread proposes. See [`BPEvent`](libs/behavioral/src/types.ts), [`BPEventTemplate`](libs/behavioral/src/types.ts).
 * @param {BPListener[] | BPListener} options.waitFor - An array of behavioral program listeners or a single listener that is waiting for a specific event or event who satisfies it's callback. See [`BPListener`](libs/behavioral/src/types.ts).
 * @param {BPListener[] | BPListener} options.blocked - An array of behavioral program listeners or a single listener that is blocking a specific event or event who satisfies it's callback. See [`BPListener`](libs/behavioral/src/types.ts).
 * @returns {RulesFunction} Synchronization set used for applying the execution of rules to the behavioral program. See [`RulesFunction`](libs/behavioral/src/types.ts).
 */
export const point: SynchronizationPoint = (syncPoint) =>
  function* () {
    yield syncPoint
  }
