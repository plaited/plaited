import { defineBProgram, type DefineBProgramProps } from '../behavioral/define-b-program.js'
import type { BPEvent } from '../behavioral/b-thread.js'
import type { Disconnect, Handlers } from '../behavioral/b-program.js'

type WorkerContext = {
  send(data: BPEvent): void
  disconnect: Disconnect
}
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
 * @example Image Processing Worker
 * ```tsx
 * // image-worker.ts
 * defineWorker<{
 *   processImage: (args: { imageData: ImageData, filters: FilterOptions }) => void
 * }>({
 *   publicEvents: ['processImage'],
 *   bProgram({ send }) {
 *     return {
 *       processImage({ imageData, filters }) {
 *         // Process image in chunks to show progress
 *         const chunks = splitIntoChunks(imageData);
 *         chunks.forEach((chunk, index) => {
 *           const processed = applyFilters(chunk, filters);
 *
 *           // Report progress
 *           send({
 *             type: 'PROGRESS_UPDATE',
 *             detail: {
 *               progress: ((index + 1) / chunks.length) * 100,
 *               chunk: processed
 *             }
 *           });
 *         });
 *
 *         send({
 *           type: 'PROCESS_COMPLETE',
 *           detail: { success: true }
 *         });
 *       }
 *     };
 *   }
 * });
 *
 * // Usage in component:
 * const ImageEditor = defineElement({
 *   tag: 'image-editor',
 *   shadowDom: (
 *     <div>
 *       <canvas p-target="canvas" />
 *       <div p-target="progress">0%</div>
 *       <button
 *         p-target="processBtn"
 *         p-trigger={{ click: 'START_PROCESSING' }}
 *       >
 *         Apply Filters
 *       </button>
 *     </div>
 *   ),
 *   bProgram({ $, trigger }) {
 *     const [canvas] = $<HTMLCanvasElement>('canvas');
 *     const [progress] = $('progress');
 *     const sendToWorker = useWorker(trigger, './image-worker.ts');
 *
 *     return {
 *       START_PROCESSING() {
 *         const ctx = canvas.getContext('2d');
 *         const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
 *
 *         sendToWorker({
 *           type: 'processImage',
 *           detail: {
 *             imageData,
 *             filters: { brightness: 1.2, contrast: 1.1 }
 *           }
 *         });
 *       },
 *
 *       PROGRESS_UPDATE({ detail }) {
 *         progress.render(`${Math.round(detail.progress)}%`);
 *         // Update canvas with processed chunk...
 *       },
 *
 *       PROCESS_COMPLETE() {
 *         progress.render('Processing complete!');
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @example Data Analysis Worker
 * ```tsx
 * // analysis-worker.ts
 * defineWorker<{
 *   analyze: (args: { dataset: DataPoint[] }) => void
 * }>({
 *   publicEvents: ['analyze'],
 *   bProgram({ send }) {
 *     const computeMetrics = (data: DataPoint[]) => {
 *       // Expensive calculations...
 *       return { mean, median, stdDev };
 *     };
 *
 *     return {
 *       analyze({ dataset }) {
 *         // Break down analysis into steps
 *         send({
 *           type: 'STATUS_UPDATE',
 *           detail: { status: 'Validating data...' }
 *         });
 *
 *         const metrics = computeMetrics(dataset);
 *
 *         send({
 *           type: 'ANALYSIS_COMPLETE',
 *           detail: { metrics }
 *         });
 *       }
 *     };
 *   }
 * });
 * ```
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
export const defineWorker = <A extends Handlers>({
  bProgram,
  publicEvents,
}: {
  bProgram: (args: DefineBProgramProps & WorkerContext) => A
  publicEvents: string[]
}) => {
  const disconnectSet = new Set<Disconnect>()
  const context = self
  const send = (data: BPEvent) => context.postMessage(data)
  const init = defineBProgram<A, WorkerContext>({
    publicEvents,
    disconnectSet,
    bProgram,
  })
  const publicTrigger = init({
    send,
    disconnect: () => disconnectSet.forEach((disconnect) => disconnect()),
  })
  const eventHandler = ({ data }: { data: BPEvent }) => {
    publicTrigger(data)
  }
  init.addDisconnectCallback(() => {
    context.removeEventListener('message', eventHandler)
    disconnectSet.clear()
  })
  context.addEventListener('message', eventHandler, false)
}
