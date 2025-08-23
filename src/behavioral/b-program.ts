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
 * Higher-order factory for creating reusable behavioral program configurations.
 * Encapsulates setup, lifecycle management, and provides a clean component API.
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
 * @example Component with behavioral program
 * ```tsx
 * // Define reusable program configuration
 * const createFormProgram = bProgram<{
 *   VALIDATION_PASSED: () => void;
 *   VALIDATION_FAILED: (errors: string[]) => void;
 *   SUBMIT_SUCCESS: (data: any) => void;
 * }, {
 *   api: ApiClient;
 *   formId: string;
 * }>({
 *   publicEvents: ['VALIDATE', 'SUBMIT', 'RESET'],
 *
 *   bProgram({ bThreads, trigger, api, formId, bSync, bThread }) {
 *     // Define validation logic
 *     bThreads.set({
 *       'validator': bThread([
 *         bSync({ waitFor: 'VALIDATE' }),
 *         bSync({ request: { type: 'RUN_VALIDATION' } })
 *       ], true),
 *
 *       'submitter': bThread([
 *         bSync({ waitFor: 'SUBMIT', block: 'VALIDATE' }),
 *         bSync({ request: { type: 'SUBMIT_FORM' } })
 *       ], true)
 *     });
 *
 *     // Return handlers
 *     return {
 *       async RUN_VALIDATION() {
 *         const errors = await validateForm(formId);
 *         trigger({
 *           type: errors.length ? 'VALIDATION_FAILED' : 'VALIDATION_PASSED',
 *           detail: errors
 *         });
 *       },
 *
 *       async SUBMIT_FORM(data) {
 *         const result = await api.submit(formId, data);
 *         trigger({ type: 'SUBMIT_SUCCESS', detail: result });
 *       },
 *
 *       VALIDATION_PASSED: () => enableSubmitButton(),
 *       VALIDATION_FAILED: (errors) => showErrors(errors),
 *       SUBMIT_SUCCESS: (data) => showSuccess(data)
 *     };
 *   }
 * });
 *
 * // Use in component
 * const MyForm = bElement({
 *   tag: 'my-form',
 *   async bProgram({ trigger }) {
 *     const api = new ApiClient();
 *     const publicTrigger = await createFormProgram({
 *       api,
 *       formId: 'user-form'
 *     });
 *
 *     return {
 *       'form/submit': () => publicTrigger({ type: 'SUBMIT' }),
 *       'input/change': () => publicTrigger({ type: 'VALIDATE' })
 *     };
 *   }
 * });
 * ```
 *
 * @example Service with behavioral coordination
 * ```tsx
 * const createDataSync = bProgram<{
 *   SYNC_COMPLETE: (stats: SyncStats) => void;
 *   SYNC_ERROR: (error: Error) => void;
 * }, {
 *   database: Database;
 *   remote: RemoteAPI;
 * }>({
 *   publicEvents: ['START_SYNC', 'STOP_SYNC'],
 *
 *   bProgram({ bThreads, database, remote, bSync, bThread, disconnect }) {
 *     const interval = setInterval(() => {
 *       trigger({ type: 'SYNC_TICK' });
 *     }, 5000);
 *
 *     disconnect(() => clearInterval(interval));
 *
 *     bThreads.set({
 *       'syncLoop': bThread([
 *         bSync({ waitFor: ['START_SYNC', 'SYNC_TICK'] }),
 *         bSync({ request: { type: 'PERFORM_SYNC' } })
 *       ], true)
 *     });
 *
 *     return {
 *       async PERFORM_SYNC() {
 *         try {
 *           const local = await database.getChanges();
 *           const result = await remote.sync(local);
 *           await database.applyChanges(result);
 *
 *           return { type: 'SYNC_COMPLETE', detail: result.stats };
 *         } catch (error) {
 *           return { type: 'SYNC_ERROR', detail: error };
 *         }
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @remarks
 * - Factory pattern enables reusability across components
 * - Public events provide API security boundary
 * - Automatic cleanup via disconnect callbacks
 * - Async initialization supports dynamic setup
 * - Context injection enables dependency injection
 *
 * @see {@link getPublicTrigger} for event filtering
 * @see {@link getPlaitedTrigger} for lifecycle management
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
