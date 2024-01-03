/* eslint-disable @typescript-eslint/no-explicit-any */
import { isTypeOf } from '@plaited/utils'
import { Sync, RulesFunc, Loop, Thread } from './types.js'

/**
 * Creates a behavioral thread from synchronization sets.
 *
 * @param {...RulesFunc} args - An arbitrary number synchronization sets.
 * @returns {RulesFunc} A new behavioral thread that combines the provided synchronization sets.
 */
export const thread: Thread = (...rules) =>
  function* () {
    const length = rules.length
    for (let i = 0; i < length; i++) {
      yield* rules[i]()
    }
  }
/**
 * Creates a behavioral thread that runs each time the behavioral program runs or until a specified condition is met.
 * This function is typically used to model repetitive behavior or modes of operation that
 * continue until a certain condition is met, such as a state change from 'open' to 'close'.
 *
 * @param {RulesFunc | (() => boolean)} firstArg - The first argument can be a behavioral rules to be executed in the loop
 *                                                 or an optional callback function that returns a boolean.
 *                                                 The loop continues as long as this function returns true.
 *                                                 If not provided, the loop runs each time the behavioral program runs.
 * @param {...RulesFunc[]} restArgs - An arbitrary number of additional behavioral rules to be executed in the loop.
 * @returns {RulesFunc} A behavioral thread that represents the looping behavior.
 */
export const loop: Loop = (ruleOrCallback, ...rules) => {
  let condition = () => true
  isTypeOf<RulesFunc<any>>(ruleOrCallback, 'generatorfunction') ?
    rules.unshift(ruleOrCallback)
  : (condition = ruleOrCallback)
  return function* () {
    while (condition()) {
      const length = rules.length
      for (let i = 0; i < length; i++) {
        yield* rules[i]()
      }
    }
  }
}

/**
 * Creates a synchronization set for a behavioral thread. At synchronization points,
 * each behavioral thread specifies three sets of parameters: request, waitFor, and block.
 *
 * @param {RuleSet} options - An object containing three properties: request, waitFor, and block. See [`RuleSet`](libs/behavioral/src/types.ts).
 * @param {BPEvent[] | BPEventTemplate} options.request - A behavioral program event or event template that the thread proposes. See [`BPEvent`](libs/behavioral/src/types.ts), [`BPEventTemplate`](libs/behavioral/src/types.ts).
 * @param {BPListener[] | BPListener} options.waitFor - An array of behavioral program listeners or a single listener that is waiting for a specific event or event who satisfies it's callback. See [`BPListener`](libs/behavioral/src/types.ts).
 * @param {BPListener[] | BPListener} options.blocked - An array of behavioral program listeners or a single listener that is blocking a specific event or event who satisfies it's callback. See [`BPListener`](libs/behavioral/src/types.ts).
 * @returns {RulesFunc} Synchronization set used for applying the execution of rules to the behavioral program. See [`RulesFunc`](libs/behavioral/src/types.ts).
 */
export const sync: Sync = (set) =>
  function* () {
    yield set
  }
