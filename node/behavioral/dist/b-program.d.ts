import { strategies } from './constants.js';
import { DevCallback, Feedback, RulesFunc, Strategy, Trigger } from './types.js';
export declare const bProgram: ({ strategy, dev, }?: {
    strategy?: "randomized" | "priority" | "chaos" | Strategy | undefined;
    dev?: DevCallback | undefined;
}) => Readonly<{
    /** add thread function to behavioral program */
    addThreads: (threads: Record<string, RulesFunc>) => void;
    /** connect action function to behavioral program */
    feedback: Feedback;
    /** trigger a run and event on behavioral program */
    trigger: Trigger;
    /**
     * A behavioral thread that loops infinitely or until some callback condition is false
     * like a mode change open -> close. This function returns a threads
     */
    loop: (rules: RulesFunc<any>[], condition?: () => boolean) => RulesFunc<any>;
    /**
     * At synchronization points, each behavioral thread specifies three sets of events:
     * requested events: the threads proposes that these be considered for triggering,
     * and asks to be notified when any of them occurs; waitFor events: the threads does not request these, but
     * asks to be notified when any of them is triggered; and blocked events: the
     * threads currently forbids triggering
     * any of these events.
     */
    sync: <T extends unknown>(set: import("./types.js").RuleSet<T>) => RulesFunc<T>;
    /**
     * creates a behavioral thread from synchronization sets and/or other  behavioral threads
     */
    thread: (...rules: RulesFunc<any>[]) => RulesFunc<any>;
}>;
