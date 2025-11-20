/**
 * @internal
 * @module b-worker
 *
 * Purpose: Enables behavioral programming within Web Worker contexts for background processing
 * Architecture: Adapts WorkerGlobalScope to support full bProgram lifecycle and event communication
 * Dependencies: b-program for core BP, get-public-trigger for security, get-plaited-trigger for lifecycle
 * Consumers: Worker script files that need behavioral programming capabilities
 *
 * Maintainer Notes:
 * - This is the worker-side counterpart to useWorker for main thread
 * - Creates a full behavioral program inside the worker thread
 * - Bidirectional event flow: main thread ↔ worker via postMessage
 * - Public events filter incoming messages for security
 * - Automatic cleanup on worker termination via disconnectSet
 * - Async initialization supports dynamic handler setup
 *
 * Common modification scenarios:
 * - Supporting SharedWorker: Adapt message routing for multiple connections
 * - Adding initialization data: Pass config through first message
 * - Error boundaries: Wrap handlers in try-catch for resilience
 * - Performance monitoring: Track handler execution times
 *
 * Performance considerations:
 * - Worker initialization is async - may delay first message handling
 * - Message serialization overhead for all events
 * - DisconnectSet grows with each registered cleanup
 * - Public event filtering adds minimal overhead
 *
 * Known limitations:
 * - No access to DOM APIs in worker context
 * - Cannot share memory directly with main thread
 * - Transferable objects not supported in current implementation
 * - Worker must be in separate file for proper execution
 */

import { behavioral } from './behavioral.js'
import type { Behavioral, BPEvent, Disconnect, EventDetails, Handlers } from './behavioral.types.js'
import { usePlaitedTrigger } from './use-plaited-trigger.js'
import { usePublicTrigger } from './use-public-trigger.js'

/**
 * @internal
 * Extended arguments passed to the worker's bProgram function.
 * Includes worker-specific capabilities like send() for messaging main thread.
 */
type BProgramArgs = {
  send(data: BPEvent): void
  disconnect: Disconnect
} & Omit<ReturnType<Behavioral>, 'useFeedback'>
/**
 * Creates a behavioral program worker with type-safe message handling and lifecycle management.
 * Integrates Web Workers with Plaited's behavioral programming system for efficient background processing.
 *
 * @template A Type extending Handlers for event handling
 *
 * @param options Configuration object
 * @param options.bProgram Function defining worker behavior and event handlers
 * @param options.publicEvents Array of allowed event types for message filtering
 *
 * @remarks
 * Worker Configuration:
 * - Must be defined in a separate file
 * - Runs in isolated thread context
 * - Has access to WorkerGlobalScope
 * - Cannot access DOM directly
 *
 * Message Handling:
 * - Type-safe message passing via generics
 * - Automatic event filtering based on publicEvents
 * - Built-in error handling
 * - Structured response format
 *
 * Best Practices:
 * 1. Worker Tasks:
 *    - CPU-intensive calculations
 *    - Data processing/analysis
 *    - Image/video processing
 *    - Complex algorithms
 *
 * 2. Communication:
 *    - Use typed messages
 *    - Send progress updates
 *    - Handle errors gracefully
 *    - Clean up resources
 *
 * 3. Performance:
 *    - Break large tasks into chunks
 *    - Report progress regularly
 *    - Consider data transfer costs
 *    - Use appropriate data structures
 */
export const bWorker = async <A extends EventDetails>({
  bProgram,
  publicEvents,
}: {
  bProgram: (args: BProgramArgs) => Handlers<A> | Promise<Handlers<A>>
  publicEvents: string[]
}) => {
  /**
   * @internal
   * Reference to WorkerGlobalScope for event handling.
   * Using 'self' directly can cause issues in some bundlers.
   */
  const context = self

  /**
   * @internal
   * Initialize a Behavioral Program instance within the worker.
   * This provides the core BP infrastructure for the worker thread.
   */
  const { useFeedback, trigger, ...rest } = behavioral()

  /**
   * @internal
   * Create filtered trigger that only accepts whitelisted events from main thread.
   * This prevents arbitrary event injection from compromising worker behavior.
   */
  const publicTrigger = usePublicTrigger({
    trigger,
    publicEvents,
  })

  /**
   * @internal
   * Message handler that forwards valid events from main thread to the behavioral program.
   * Type safety is enforced by publicTrigger's filtering.
   */
  const eventHandler = ({ data }: { data: BPEvent }) => publicTrigger(data)

  /**
   * @internal
   * Manages cleanup callbacks for proper resource disposal.
   * Pre-populated with message listener cleanup to prevent leaks.
   */
  const disconnectSet = new Set<Disconnect>()
  disconnectSet.add(() => {
    context.removeEventListener('message', eventHandler)
    disconnectSet.clear()
  })

  /**
   * @internal
   * Send function for communicating back to main thread.
   * Wraps postMessage for consistent event-based interface.
   */
  const send = (data: BPEvent) => context.postMessage(data)

  /**
   * @internal
   * Master disconnect that runs all cleanup callbacks and terminates worker.
   * Called on worker shutdown or explicit disconnect request.
   */
  const disconnect = () => {
    disconnectSet.forEach((disconnect) => void disconnect())
    self.close()
  }

  /**
   * @internal
   * Execute user-provided bProgram to get event handlers.
   * Await supports async initialization (e.g., loading resources).
   * Enhanced trigger enables automatic cleanup registration.
   */
  useFeedback(
    await bProgram({
      ...rest,
      send,
      disconnect,
      trigger: usePlaitedTrigger(trigger, disconnectSet),
    }),
  )

  /**
   * @internal
   * Start listening for messages from main thread.
   * This completes the bidirectional communication setup.
   */
  context.addEventListener('message', eventHandler, false)
}
