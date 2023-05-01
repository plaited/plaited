import { RuleSet, RulesFunc } from './types.js';
/**
 * @description
 * creates a behavioral thread from synchronization sets and/or other  behavioral threads
 */
export declare const thread: (...rules: RulesFunc<any>[]) => RulesFunc<any>;
/**
 * @description
 * A behavioral thread that loops infinitely or until some callback condition is false
 * like a mode change open -> close. This function returns a threads
 */
export declare const loop: (rules: RulesFunc<any>[], condition?: () => boolean) => RulesFunc<any>;
/**
 * @description
 * At synchronization points, each behavioral thread specifies three sets of events:
 * requested events: the threads proposes that these be considered for triggering,
 * and asks to be notified when any of them occurs; waitFor events: the threads does not request these, but
 * asks to be notified when any of them is triggered; and blocked events: the
 * threads currently forbids triggering
 * any of these events.
 */
export declare const sync: <T extends unknown>(set: RuleSet<T>) => RulesFunc<T>;
