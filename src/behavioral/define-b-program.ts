import { type BSync, type BThread, bThread, bSync } from './b-thread.js'
import { type Handlers, type UseSnapshot, type BThreads, bProgram, type Disconnect } from './b-program.js'
import { getPublicTrigger } from './get-public-trigger.js'
import { getPlaitedTrigger, type PlaitedTrigger } from './get-plaited-trigger.js'

/**
 * Defines the properties passed to the `BProgramCallback` function.
 * This object bundles the core utilities and the enhanced `PlaitedTrigger`
 * needed to define behavior and feedback mechanisms.
 * 
 * @property bSync - Factory for creating synchronization points that define wait conditions, request events,
 *   block events, and interrupt logic for behavioral threads
 * @property bThread - Factory for creating behavioral threads that encapsulate reactive logic sequences
 * @property bThreads - Utility for managing behavioral threads, including adding, removing, and checking status
 * @property trigger - An enhanced trigger function that allows registering disconnect callbacks for cleanup
 * @property useSnapshot - Hook for registering a snapshot listener to monitor program state changes
 */
export type DefineBProgramProps = {
  /** Factory for creating synchronization points. */
  bSync: BSync
  /** Factory for creating behavioral threads. */
  bThread: BThread
  /** Utility for managing behavioral threads (adding/checking status). */
  bThreads: BThreads
  /** An enhanced trigger function that allows registering disconnect callbacks. */
  trigger: PlaitedTrigger
  /** Hook for registering a snapshot listener to monitor program state. */
  useSnapshot: UseSnapshot
}
/**
 * A callback function responsible for setting up the behavioral logic and feedback handlers
 * for a specific behavioral program instance.
 *
 * It receives the core behavioral programming utilities (`DefineBProgramProps`)
 * along with any additional context (`C`) provided during initialization.
 * It must return an object containing the feedback handlers (`Handlers`) for the program.
 *
 * @template A The specific type of the `Handlers` object returned by the callback.
 * @template C An optional type for additional context or dependencies passed during initialization.
 * @param props An object containing the core utilities (`DefineBProgramProps`) merged with the optional context (`C`).
 * @returns An object conforming to `Handlers<A>`, mapping event types to their handler functions.
 */
type BProgramCallback<A extends Handlers, C extends Record<string, unknown> = Record<string, unknown>> = (
  props: DefineBProgramProps & C,
) => A
/**
 * A higher-order function factory for creating and configuring behavioral programs,
 * particularly suited for integration within frameworks or components that manage lifecycle and cleanup.
 * It simplifies the setup by encapsulating the creation of the bProgram instance,
 * feedback handler registration, public event filtering, and disconnect callback management.
 *
 * @template A The type of the `Handlers` object defining the feedback logic.
 * @template C An optional type for additional context passed to the `bProgram` callback during initialization.
 * @param config Configuration object for the behavioral program definition.
 * @param config.publicEvents An array of event type strings that define the public API of this bProgram instance.
 *                            Only these events can be triggered via the returned public trigger.
 * @param config.disconnectSet An optional `Set` to store cleanup functions (`Disconnect`). If not provided, a new Set is created.
 *                             This set should be managed externally and invoked upon teardown.
 * @param config.bProgram The `BProgramCallback` function that defines the threads and feedback handlers.
 * @returns An initialization function (`init`) tailored for this specific bProgram definition.
 *          - The `init` function accepts an optional context object (`C`) which is passed to the `bProgram` callback.
 *          - Calling `init` sets up the b-program, registers feedback handlers, and returns a restricted public `Trigger`.
 *          - The `init` function also has an `addDisconnectCallback` method attached, allowing external code
 *            to register cleanup logic associated with this bProgram instance.
 * @example
 * const myBProgram = defineBProgram<{ MyHandlers }, { service: MyService }>({
 *   publicEvents: ['DO_ACTION', 'CANCEL'],
 *   bProgram: ({ bThreads, trigger, service, bSync, bThread }) => {
 *     // Define b-threads using bThreads.set(...)
 *     bThreads.set({
 *       myThread: bThread([...])
 *     });
 *
 *     // Return feedback handlers
 *     return {
 *       ACTION_COMPLETE: (detail) => service.handleComplete(detail),
 *       // ... other handlers
 *     };
 *   }
 * });
 *
 * // In component setup:
 * const myServiceInstance = new MyService();
 * const publicTrigger = myBProgram({ service: myServiceInstance });
 *
 * // Register cleanup if needed:
 * const subscription = myServiceInstance.subscribe(publicTrigger);
 * myBProgram.addDisconnectCallback(() => subscription.unsubscribe());
 *
 * // Use the public trigger:
 * publicTrigger({ type: 'DO_ACTION', detail: { id: 1 } }); // Allowed
 * // publicTrigger({ type: 'INTERNAL_EVENT' }); // Disallowed (warning logged)
 *
 * // In component teardown:
 * // Invoke cleanup logic stored in the disconnectSet used (or created) by defineBProgram.
 */
export const defineBProgram = <A extends Handlers, C extends Record<string, unknown> = Record<string, unknown>>({
  disconnectSet = new Set<Disconnect>(),
  ...args
}: {
  /** 
   * Defines the public event interface for this bProgram instance.
   * Only events listed here can be triggered through the public trigger.
   */
  publicEvents: string[]
  /** 
   * Optional Set to manage cleanup callbacks associated with this instance.
   * All disconnect callbacks will be added to this set for centralized cleanup.
   */
  disconnectSet?: Set<Disconnect>
  /** 
   * The callback function defining the bProgram's threads and feedback handlers.
   * This function contains the core behavioral logic of the program.
   */
  bProgram: BProgramCallback<A, C>
}) => {
  const { useFeedback, trigger, ...rest } = bProgram()
  const init = (ctx?: C) => {
    const { bProgram, publicEvents } = args
    const handlers = bProgram({
      ...rest,
      trigger: getPlaitedTrigger(trigger, disconnectSet),
      bSync,
      bThread,
      ...(ctx ?? ({} as C)),
    })
    useFeedback(handlers)
    return getPublicTrigger({ trigger, publicEvents })
  }
  init.addDisconnectCallback = (cb: Disconnect) => disconnectSet.add(cb)
  return init
}
