import { DevCallback, Strategy, Trigger } from "@plaited/behavioral";
export declare const useBehavioral: ({ id, connect, dev, strategy, context }: {
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
  addThreads: (
    threads: Record<string, import("@plaited/behavioral").RulesFunc>,
  ) => void;
  feedback: import("@plaited/behavioral").Feedback;
  loop: (
    rules: import("@plaited/behavioral").RulesFunc<any>[],
    condition?: () => boolean,
  ) => import("@plaited/behavioral").RulesFunc<any>;
  sync: <T extends unknown>(
    set: import("@plaited/behavioral").RuleSet<T>,
  ) => import("@plaited/behavioral").RulesFunc<T>;
  thread: (
    ...rules: import("@plaited/behavioral").RulesFunc<any>[]
  ) => import("@plaited/behavioral").RulesFunc<any>;
  trigger: Trigger;
  disconnect: any;
};
