// deno-lint-ignore-file no-explicit-any
import { RuleSet, RulesFunc } from './types.ts'

/**
 * @description
 * creates a bThread from loops, sets, and/or other bThreads
 */
export const bThread = (...gens: RulesFunc<any>[]): RulesFunc<any> =>
  function* () {
    for (const gen of gens) {
      yield* gen()
    }
  }
/**
 * @description
 * loops a bThread or sets infinitely or until some condition true
 * like a mode change open -> close. This function returns a bThread
 */
export const loop = (
  gen: RulesFunc<any>,
  condition = () => true,
): RulesFunc<any> =>
  function* () {
    while (condition()) {
      yield* gen()
    }
  }
/**
 * @description
 * At synchronization points, each bThread specifies three sets of events:
 * requested events: the bThread proposes that these be considered for triggering,
 * and asks to be notified when any of them occurs; waitFor events: the bThread does not request these, but
 * asks to be notified when any of them is triggered; and blocked events: the
 * bThread currently forbids triggering
 * any of these events.
 */
export const sync = <T extends Record<string, unknown>>(
  set: RuleSet<T>,
): RulesFunc<T> =>
  function* () {
    yield set
  }
