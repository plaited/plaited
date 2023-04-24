import { DevCallback, Strategy, Trigger } from '../behavioral/mod.ts';
export declare const useBehavioral: ({ id, connect, dev, strategy, context, }: {
    /** sets a behavioral program for island to dev and captures reactive stream logs */
    dev?: DevCallback;
    /** Set the island's behavioral program strategy */
    strategy?: Strategy;
    /** wires the messenger connect to the behavioral programs trigger */
    connect?: (recipient: string, trigger: Trigger) => () => void;
    /** optional and useful for when you're making a new primitive like a datepicker
     *  where there can be multiple on the screen, use this instead of the tag name to connect to messenger
     * If an id attribute is missing the island will console.error
     */
    id?: boolean;
    /** reference to the node instance of the Island HTMLElement calling this hook */
    context: HTMLElement;
}) => {
    addThreads: (threads: Record<string, import("../behavioral/types").RulesFunc>) => void;
    feedback: import("../behavioral/types").Feedback;
    loop: (rules: import("../behavioral/types").RulesFunc<any>[], condition?: () => boolean) => import("../behavioral/types").RulesFunc<any>;
    sync: <T extends unknown>(set: import("../behavioral/types").RuleSet<T>) => import("../behavioral/types").RulesFunc<T>;
    thread: (...rules: import("../behavioral/types").RulesFunc<any>[]) => import("../behavioral/types").RulesFunc<any>;
    trigger: Trigger;
    disconnect: any;
};
