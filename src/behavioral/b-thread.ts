import { isTypeOf } from '../utils/is-type-of.ts'

type Repeat = true | ((ctx?: (id: string) => unknown) => boolean)
export type BPEvent<T = unknown> = { type: string; detail?: T }
export type BPEventTemplate<T = unknown> = () => BPEvent<T>
export type BPListener<T = unknown> = string | ((args: { type: string; detail: T }) => boolean)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Idioms<T = any> = {
  waitFor?: BPListener<T> | BPListener<T>[]
  interrupt?: BPListener<T> | BPListener<T>[]
  request?: BPEvent<T> | BPEventTemplate<T>
  block?: BPListener<T> | BPListener<T>[]
}
export type RulesFunction = () => Generator<Idioms, void, undefined>
export type BSync = <T>(arg: Idioms<T>) => () => Generator<Idioms, void, unknown>
export type BThread = (rules: RulesFunction[], repeat?: Repeat) => RulesFunction

/** BPEvent type guard */
export const isBPEvent = (data: unknown): data is BPEvent => {
  return isTypeOf<{ [key: string]: unknown }>(data, 'object') && 'type' in data && isTypeOf<string>(data.type, 'string')
}

/**
 * Creates a Rule Function from synchronization points.
 *
 * @param {...RulesFunction} args - An arbitrary number synchronization sets.
 * @returns {RulesFunction} A new behavioral thread that combines the provided synchronization sets.
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
 * Creates a synchronization bSync for a behavioral thread. At synchronization points,
 * each behavioral thread specifies three sets of parameters: request, waitFor, and block.
 *
 * @param {BSync} options - An object containing three properties: request, waitFor, and block. See [`BSync`](libs/behavioral/src/types.ts).
 * @param {BPEvent[] | BPEventTemplate} options.request - A behavioral program event or event template that the thread proposes. See [`BPEvent`](libs/behavioral/src/types.ts), [`BPEventTemplate`](libs/behavioral/src/types.ts).
 * @param {BPListener[] | BPListener} options.waitFor - An array of behavioral program listeners or a single listener that is waiting for a specific event or event who satisfies it's callback. See [`BPListener`](libs/behavioral/src/types.ts).
 * @param {BPListener[] | BPListener} options.blocked - An array of behavioral program listeners or a single listener that is blocking a specific event or event who satisfies it's callback. See [`BPListener`](libs/behavioral/src/types.ts).
 * @returns {RulesFunction} Synchronization set used for applying the execution of rules to the behavioral program. See [`RulesFunction`](libs/behavioral/src/types.ts).
 */
export const bSync: BSync = (syncPoint) =>
  function* () {
    yield syncPoint
  }
