import { isTypeOf } from '../utils/is-type-of.js'

type Repeat = true | ((ctx?: (id: string) => unknown) => boolean)
/**
 * Represents a behavioral event with a type identifier and optional detail data.
 * @template T Type of the detail data
 */
export type BPEvent<T = unknown> = { type: string; detail?: T }
/**
 * Factory function that creates behavioral events.
 * @template T Type of the detail data
 * @returns A behavioral event object
 */
export type BPEventTemplate<T = unknown> = () => BPEvent<T>
/**
 * Defines a listener pattern for behavioral events.
 * Can be either a string matching the event type or a predicate function.
 * @template T Type of the detail data in the event
 */
export type BPListener<T = unknown> = string | ((args: { type: string; detail: T }) => boolean)
/**
 * Configuration object defining behavioral programming synchronization points.
 * Specifies event handling patterns including waiting, interrupting, requesting, and blocking.
 * @template T Type of the event detail data
 * @property waitFor - Events to wait for before proceeding
 * @property interrupt - Events that can interrupt the current flow
 * @property request - Events to be requested for execution
 * @property block - Events to be prevented from occurring
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Idioms<T = any> = {
  waitFor?: BPListener<T> | BPListener<T>[]
  interrupt?: BPListener<T> | BPListener<T>[]
  request?: BPEvent<T> | BPEventTemplate<T>
  block?: BPListener<T> | BPListener<T>[]
}
/**
 * A function that defines the behavioral rules using generator syntax.
 * Yields synchronization points (Idioms) during execution.
 */
export type RulesFunction = () => Generator<Idioms, void, undefined>
/**
 * Factory function that creates a behavioral synchronization point.
 * @template T Type of the event detail data
 * @param arg Configuration object defining the synchronization behavior
 * @returns A generator function representing the synchronization point
 */
export type BSync = <T>(arg: Idioms<T>) => () => Generator<Idioms, void, unknown>
/**
 * Factory function that creates a behavioral thread from a collection of rules.
 * @param rules Array of rule functions defining thread behavior
 * @param repeat Optional configuration for thread repetition can be true or a
 * @returns A rules function representing the complete thread behavior
 */
export type BThread = (rules: RulesFunction[], repeat?: Repeat) => RulesFunction

/** Type guard to verify if an unknown object is a behavioral event (BPEvent) */
export const isBPEvent = (data: unknown): data is BPEvent => {
  return isTypeOf<{ [key: string]: unknown }>(data, 'object') && 'type' in data && isTypeOf<string>(data.type, 'string')
}

/**
 * Creates a behavioral thread (bthread) from a sequence of synchronization points.
 *
 * @param rules - Array of synchronization points that define the thread's behavior
 * @param repeat - Controls the looping behavior of the thread:
 *                - If true: Thread will loop indefinitely
 *                - If function: Thread loops while function returns true
 *                - If false/undefined: Thread executes once
 *
 * Synchronization points allow bthreads to coordinate by specifying:
 * - Events to request
 * - Events to wait for
 * - Events to block
 *
 * @example
 * bthread([
 *    bSync({ request: { type: 'hot' } })
 *    bSync({ request: { type: 'hot' } }),
 * ], true) // Creates an loop that runs the rules on each execution of the program
 */
export const bThread: BThread = (rules, repeat) => {
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
 * Creates a synchronization point where behavioral threads coordinate their execution.
 * At each sync point, threads declare their event preferences through three sets:
 * - request: Events the thread wants to trigger
 * - waitFor: Events the thread is willing to synchronize on
 * - block: Events the thread prevents from occurring
 *
 * This mechanism enables declarative event selection and coordination between multiple threads.
 */
export const bSync: BSync = (syncPoint) =>
  function* () {
    yield syncPoint
  }
