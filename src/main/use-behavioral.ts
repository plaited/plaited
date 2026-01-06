/**
 * @internal
 * Factory for creating reusable behavioral program configurations.
 * Encapsulates setup, lifecycle management, and public event filtering.
 */
import { behavioral } from './behavioral.ts'
import type {
  BSync,
  BThread,
  BThreads,
  Disconnect,
  EventDetails,
  Handlers,
  PlaitedTrigger,
  UseSnapshot,
} from './behavioral.types.ts'
import { bSync, bThread } from './behavioral.utils.ts'
import { usePlaitedTrigger } from './use-plaited-trigger.ts'
import { usePublicTrigger } from './use-public-trigger.ts'

/**
 * Higher-order factory for creating reusable behavioral program configurations.
 * Encapsulates setup, lifecycle management, and provides a clean element API.
 *
 * @template A Type of event handlers for feedback logic
 * @template C Type of context object passed during initialization
 *
 * @param args Configuration for the behavioral program
 * @param args.publicEvents Whitelist of events accessible via public trigger
 * @param args.bProgram Function defining threads and returning handlers
 *
 * @returns Async initialization function that creates configured program instance
 *
 * @remarks
 * **Factory Pattern Benefits:**
 * - Define behavioral program logic once, instantiate multiple times
 * - Separates BP definition from execution context
 * - Enables dependency injection via context parameter
 * - Each init() call creates isolated behavioral program instance
 *
 * **Public Events Security:**
 * - publicEvents array acts as API whitelist
 * - Only listed events can be triggered externally
 * - Prevents exposure of internal coordination events
 * - Returns filtered trigger function as public API
 *
 * **Lifecycle Management:**
 * - Automatic cleanup via disconnect callbacks
 * - Disconnect callbacks cleared when program instance ends
 * - Async initialization supports I/O and setup operations
 * - PlaitedTrigger integration for automatic resource cleanup
 *
 * **Context Injection:**
 * - Generic C type allows typed context objects
 * - Context merged with behavioral primitives (bThread, bSync, trigger)
 * - Enables external dependencies without global state
 * - Supports services, APIs, configuration objects
 *
 * **Performance:**
 * - Each init() creates new bProgram instance (no sharing)
 * - DisconnectSet grows with registered callbacks
 * - Public trigger adds minimal Set lookup overhead
 * - Async init may delay element readiness
 *
 * @see {@link usePublicTrigger} for event filtering
 * @see {@link usePlaitedTrigger} for lifecycle management
 * @see {@link behavioral} for core behavioral programming engine
 */

export const useBehavioral = <
  A extends EventDetails,
  C extends { [key: string]: unknown } = { [key: string]: unknown },
>({
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
   * Returned init function captures definition args in closure.
   * Each invocation creates isolated bProgram instance with context.
   * Async to support initialization that requires I/O or setup.
   * Creates a fresh behavioral program for complete isolation.
   */
  return async (ctx: C) => {
    /**
     * @internal
     * Create a NEW behavioral program instance for each call.
     * This ensures complete isolation between instances.
     */
    const { trigger, useFeedback, ...rest } = behavioral()

    /**
     * @internal
     * Instance-specific disconnect callback registry for lifecycle management.
     * Populated during init, cleared on disconnect.
     */
    const disconnectSet = new Set<Disconnect>()

    /**
     * @internal
     * Instance-specific cleanup function that runs all registered callbacks.
     * Called during custom element disconnection or explicit cleanup.
     */
    const disconnect = () => {
      disconnectSet.forEach((disconnect) => void disconnect())
    }

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
      trigger: usePlaitedTrigger(trigger, disconnectSet),
      ...rest,
    })

    /**
     * @internal
     * Connect handlers to behavioral program feedback loop.
     * Enables request/waitFor/block event handling.
     * Register the disconnect function for proper cleanup.
     */
    disconnectSet.add(useFeedback(handlers))

    /**
     * @internal
     * Return filtered trigger that only accepts public events.
     * This creates the element's public API surface.
     */
    return usePublicTrigger({ trigger, publicEvents })
  }
}
