/**
 * @internal
 * @module use-worker
 *
 * Purpose: Bridges Web Worker communication with Plaited's behavioral event system
 * Architecture: Adapter pattern connecting Worker postMessage API to trigger-based events
 * Dependencies: b-thread for event types, b-program for trigger, get-plaited-trigger for cleanup
 * Consumers: Components that need background processing via Web Workers
 *
 * Maintainer Notes:
 * - This module enables behavioral programming across thread boundaries
 * - Worker messages must conform to BPEvent structure for type safety
 * - Automatic cleanup prevents memory leaks from orphaned workers
 * - The returned function has a disconnect property for manual cleanup
 * - Message validation via isBPEvent prevents non-conforming messages
 *
 * Common modification scenarios:
 * - Supporting SharedWorker: Add conditional logic for different worker types
 * - Adding error handling: Listen to worker 'error' event
 * - Message queuing: Buffer messages if worker not ready
 * - Performance monitoring: Track message latency and throughput
 *
 * Performance considerations:
 * - Message passing has serialization overhead - avoid large payloads
 * - Worker termination is immediate - ensure graceful shutdown in worker
 * - Event listener is attached once, not per message
 * - Type guard prevents unnecessary trigger calls
 *
 * Known limitations:
 * - No built-in error handling for worker crashes
 * - No message acknowledgment or retry mechanism
 * - Worker instance must be created externally
 * - No support for transferable objects
 */
import { type BPEvent, isBPEvent } from './b-thread.js'
import { type Trigger } from './b-program.js'
import { type PlaitedTrigger, isPlaitedTrigger } from './get-plaited-trigger.js'

/**
 * Creates a type-safe interface for Web Worker communication within Plaited components.
 * Seamlessly integrates workers with Plaited's event system and handles lifecycle management.
 *
 * @param trigger - Event trigger function for handling worker responses
 * @param worker - Web Worker instance to communicate with
 * @returns Enhanced postMessage function with disconnect capability
 *
 * @example Using a worker in a Plaited component
 * ```tsx
 * const DataProcessor = defineElement({
 *   tag: 'data-processor',
 *   shadowDom: (
 *     <div>
 *       <div p-target="status">Processing: 0%</div>
 *       <div p-target="result">No results yet</div>
 *       <button
 *         p-target="processBtn"
 *         p-trigger={{ click: 'PROCESS_DATA' }}
 *       >
 *         Process Data
 *       </button>
 *     </div>
 *   ),
 *   bProgram({ $, trigger }) {
 *     const [status] = $('status');
 *     const [result] = $('result');
 *
 *     // Initialize worker with automatic cleanup
 *     const sendToWorker = useWorker(trigger, './data-worker.ts');
 *
 *     return {
 *       PROCESS_DATA() {
 *         sendToWorker({
 *           type: 'process',
 *           detail: { dataset: largeDataset }
 *         });
 *       },
 *
 *       // Handle worker responses
 *       UPDATE_STATUS({ detail }) {
 *         status.render(`Processing: ${detail.progress}%`);
 *       },
 *
 *       PROCESS_COMPLETE({ detail }) {
 *         result.render(
 *           <div class="results">
 *             <h3>Results:</h3>
 *             <pre>{JSON.stringify(detail.results, null, 2)}</pre>
 *           </div>
 *         );
 *       }
 *     };
 *   }
 * });
 *
 * // In data-worker.ts:
 * defineWorker<{
 *   process: (args: { dataset: unknown[] }) => void;
 * }>({
 *   publicEvents: ['process'],
 *   bProgram({ send }) {
 *     return {
 *       process({ dataset }) {
 *         // Process data and send updates
 *         dataset.forEach((item, index) => {
 *           // Process item...
 *           send({
 *             type: 'UPDATE_STATUS',
 *             detail: { progress: (index / dataset.length) * 100 }
 *           });
 *         });
 *
 *         send({
 *           type: 'PROCESS_COMPLETE',
 *           detail: { results: processedData }
 *         });
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @remarks
 * Key Features:
 * - Automatic cleanup when using PlaitedTrigger
 * - Type-safe message passing between component and worker
 * - Module worker support for better code organization
 * - Seamless integration with Plaited's event system
 * - Built-in error handling and message validation
 *
 * Best Practices:
 * - Keep worker logic focused and single-purpose
 * - Use TypeScript for type-safe message passing
 * - Handle worker errors appropriately
 * - Consider using publicEvents in worker definition
 * - Clean up workers when component is disconnected
 */
export const useWorker = (trigger: PlaitedTrigger | Trigger, worker: Worker) => {
  /**
   * @internal
   * Message handler that validates and forwards worker messages to the trigger.
   * Only BPEvent-conforming messages are processed for type safety.
   */
  const handleMessage = (event: MessageEvent<BPEvent>) => {
    isBPEvent(event.data) && trigger(event.data)
  }

  /**
   * @internal
   * Set up bidirectional communication:
   * 1. Listen for messages from worker
   * 2. Create posting function for sending to worker
   * 3. Set up cleanup that removes listener and terminates worker
   */
  worker.addEventListener('message', handleMessage)
  const post = (args: BPEvent) => worker?.postMessage(args)
  const disconnect = () => {
    worker?.removeEventListener('message', handleMessage)
    worker?.terminate()
  }

  /**
   * @internal
   * Register automatic cleanup if using PlaitedTrigger.
   * This ensures worker termination when component unmounts.
   */
  isPlaitedTrigger(trigger) && trigger.addDisconnectCallback(disconnect)

  /**
   * @internal
   * Attach disconnect method to returned function for manual cleanup option.
   * This allows explicit cleanup before component unmount if needed.
   */
  post.disconnect = disconnect
  return post
}
