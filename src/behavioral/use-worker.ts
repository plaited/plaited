import { type BPEvent, isBPEvent } from './b-thread.js'
import { type Trigger } from './b-program.js'
import { type PlaitedTrigger, isPlaitedTrigger } from './get-plaited-trigger.js'

/**
 * Creates a type-safe interface for Web Worker communication within Plaited components.
 * Seamlessly integrates workers with Plaited's event system and handles lifecycle management.
 *
 * @param trigger - Event trigger function for handling worker responses
 * @param path - Path to the worker module file
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
  const handleMessage = (event: MessageEvent<BPEvent>) => {
    isBPEvent(event.data) && trigger(event.data)
  }

  worker.addEventListener('message', handleMessage)
  const post = (args: BPEvent) => worker?.postMessage(args)
  const disconnect = () => {
    worker?.removeEventListener('message', handleMessage)
    worker?.terminate()
  }
  isPlaitedTrigger(trigger) && trigger.addDisconnectCallback(disconnect)
  post.disconnect = disconnect
  return post
}
