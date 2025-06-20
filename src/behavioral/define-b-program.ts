import { type BSync, type BThread, bThread, bSync } from './b-thread.js'
import {
  type EventDetails,
  type UseSnapshot,
  type BThreads,
  bProgram,
  type Disconnect,
  type Handlers,
} from './b-program.js'
import { getPlaitedTrigger, type PlaitedTrigger } from './get-plaited-trigger.js'
import { getPublicTrigger } from './get-public-trigger.js'

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

export const defineBProgram = <
  A extends EventDetails,
  C extends { [key: string]: unknown } = { [key: string]: unknown },
>(args: {
  publicEvents?: string[]
  bProgram: (
    args: {
      bSync: BSync
      bThread: BThread
      bThreads: BThreads
      disconnect: Disconnect
      trigger: PlaitedTrigger
      useSnapshot: UseSnapshot
    } & C,
  ) => Handlers<A> | Promise<Handlers<A>>
}) => {
  const { trigger, useFeedback, ...rest } = bProgram()
  const disconnectSet = new Set<Disconnect>()
  const disconnect = () => {
    disconnectSet.forEach((disconnect) => disconnect())
  }
  return async (ctx: C) => {
    const handlers = await args.bProgram({
      ...ctx,
      bSync,
      bThread,
      disconnect,
      trigger: getPlaitedTrigger(trigger, disconnectSet),
      ...rest,
    })
    useFeedback(handlers)
    return getPublicTrigger({ trigger, publicEvents: args?.publicEvents })
  }
}
