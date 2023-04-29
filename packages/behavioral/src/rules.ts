import { Detail, RuleSet, RulesFunc } from "./types.js";

/**
 * @description
 * creates a behavioral thread from synchronization sets and/or other  behavioral threads
 */
export const thread = (...rules: RulesFunc<any>[]): RulesFunc<any> =>
  function* () {
    for (const rule of rules) {
      yield* rule();
    }
  };
/**
 * @description
 * A behavioral thread that loops infinitely or until some callback condition is false
 * like a mode change open -> close. This function returns a threads
 */
export const loop = (
  rules: RulesFunc<any>[],
  condition = () => true,
): RulesFunc<any> =>
  function* () {
    while (condition()) {
      for (const rule of rules) {
        yield* rule();
      }
    }
  };
/**
 * @description
 * At synchronization points, each behavioral thread specifies three sets of events:
 * requested events: the threads proposes that these be considered for triggering,
 * and asks to be notified when any of them occurs; waitFor events: the threads does not request these, but
 * asks to be notified when any of them is triggered; and blocked events: the
 * threads currently forbids triggering
 * any of these events.
 */
export const sync = <T extends Detail>(
  set: RuleSet<T>,
): RulesFunc<T> =>
  function* () {
    yield set;
  };
