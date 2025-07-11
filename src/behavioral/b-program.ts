/**
 * @internal
 * @module b-program
 *
 * Purpose: Factory pattern for creating reusable behavioral program configurations
 * Architecture: Higher-order function that encapsulates bProgram setup with lifecycle management
 * Dependencies: b-thread for BP primitives, b-program for core, get-plaited-trigger for cleanup
 * Consumers: Component frameworks, standalone BP applications, testing utilities
 *
 * Maintainer Notes:
 * - This module enables the "define once, use many times" pattern for behavioral programs
 * - Key benefit is separating BP definition from instantiation context
 * - Public events filtering prevents internal event exposure in component APIs
 * - Disconnect callbacks are managed centrally for proper cleanup
 * - The returned init function is async to support async handler setup
 * - Context injection allows external dependencies without global state
 *
 * Common modification scenarios:
 * - Adding middleware: Intercept in the returned init function
 * - Supporting multiple instances: Already supported via factory pattern
 * - Adding event validation: Extend getPublicTrigger usage
 * - Resource pooling: Add instance tracking in outer scope
 *
 * Performance considerations:
 * - Each init() call creates new bProgram instance - no sharing
 * - DisconnectSet grows with registered callbacks - clean up properly
 * - Public trigger adds minimal overhead with Set lookup
 * - Async init may delay component readiness
 *
 * Known limitations:
 * - No built-in instance limiting or pooling
 * - Context type must be known at definition time
 * - No runtime modification of public events list
 * - Disconnect is synchronous only
 */
import {
  type EventDetails,
  type UseSnapshot,
  type BThreads,
  behavioral,
  type Disconnect,
  type Handlers,
  type BSync,
  type BThread,
  bThread,
  bSync,
} from './behavioral.js'
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
 * @param args Configuration object for the behavioral program definition.
 * @param args.publicEvents An optional array of event type strings that define the public API of this bProgram instance.
 *                          Only these events can be triggered via the returned public trigger.
 * @param args.bProgram The function that defines the threads and feedback handlers.
 * @returns An initialization function (`init`) tailored for this specific bProgram definition.
 *          - The `init` function accepts an optional context object (`C`) which is passed to the `bProgram` callback.
 *          - Calling `init` sets up the b-program, registers feedback handlers, and returns a restricted public `Trigger`.
 *          - Cleanup functions can be registered using the `disconnect` callback provided to the bProgram function.
 * @example
 * const createMyBProgram = defineBProgram<MyHandlers, { service: MyService }>({
 *   publicEvents: ['DO_ACTION', 'CANCEL'],
 *   bProgram: ({ bThreads, trigger, service, bSync, bThread, disconnect }) => {
 *     // Define b-threads using bThreads.set(...)
 *     bThreads.set({
 *       myThread: bThread([...])
 *     });
 *
 *     // Register cleanup if needed:
 *     const subscription = service.subscribe();
 *     disconnect(() => subscription.unsubscribe());
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
 * const publicTrigger = await createMyBProgram({ service: myServiceInstance });
 *
 * // Use the public trigger:
 * publicTrigger({ type: 'DO_ACTION', detail: { id: 1 } }); // Allowed
 * // publicTrigger({ type: 'INTERNAL_EVENT' }); // Disallowed (throws error)
 */

export const bProgram = <A extends EventDetails, C extends { [key: string]: unknown } = { [key: string]: unknown }>({
  publicEvents,
  bProgram,
}: {
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
  /**
   * @internal
   * Create base behavioral program instance that will be reused.
   * Extract core functionality that doesn't depend on context.
   */
  const { trigger, useFeedback, ...rest } = behavioral()

  /**
   * @internal
   * Shared disconnect callback registry for lifecycle management.
   * Populated during init, cleared on disconnect.
   */
  const disconnectSet = new Set<Disconnect>()

  /**
   * @internal
   * Master cleanup function that runs all registered callbacks.
   * Called during component unmount or explicit cleanup.
   */
  const disconnect = () => {
    disconnectSet.forEach((disconnect) => void disconnect())
  }

  /**
   * @internal
   * Returned init function captures definition args in closure.
   * Each invocation creates isolated bProgram instance with context.
   * Async to support initialization that requires I/O or setup.
   */
  return async (ctx: C) => {
    /**
     * @internal
     * Execute user's bProgram function with full context.
     * Merges behavioral primitives, lifecycle, and user context.
     * PlaitedTrigger enables automatic cleanup registration.
     */
    const handlers = await bProgram({
      ...ctx,
      bSync,
      bThread,
      disconnect,
      trigger: getPlaitedTrigger(trigger, disconnectSet),
      ...rest,
    })

    /**
     * @internal
     * Connect handlers to behavioral program feedback loop.
     * Enables request/waitFor/block event handling.
     */
    useFeedback(handlers)

    /**
     * @internal
     * Return filtered trigger that only accepts public events.
     * This creates the component's public API surface.
     */
    return getPublicTrigger({ trigger, publicEvents })
  }
}
