import type { BPEvent } from './b-thread.js'
import type { Disconnect, Handlers, EventDetails } from './b-program.js'
import { bProgram, type BProgram } from './b-program.js'
import { getPublicTrigger } from './get-public-trigger.js'
import { getPlaitedTrigger } from './get-plaited-trigger.js'

type BProgramArgs = {
  send(data: BPEvent): void
  disconnect: Disconnect
} & Omit<ReturnType<BProgram>, 'useFeedback'>
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
export const defineWorker = async <A extends EventDetails>(args: {
  bProgram: (args: BProgramArgs) => Handlers<A> | Promise<Handlers<A>>
  publicEvents: string[]
}) => {
  const context = self
  // Initiate  a Behanvioral Program
  const { useFeedback, trigger, ...rest } = bProgram()

  // Public trigger  to receive events from main thread
  const publicTrigger = getPublicTrigger({
    trigger,
    publicEvents: args?.publicEvents,
  })
  // Event handler that for events from main thread
  const eventHandler = ({ data }: { data: BPEvent }) => publicTrigger(data)

  const disconnectSet = new Set<Disconnect>()
  disconnectSet.add(() => {
    context.removeEventListener('message', eventHandler)
    disconnectSet.clear()
  })

  // Callback for sending events to the main window
  const send = (data: BPEvent) => context.postMessage(data)
  // Disconnect callback can be used to disconnect listeners and close worker
  const disconnect = () => {
    disconnectSet.forEach((disconnect) => void disconnect())
    self.close()
  }

  // BProgram callback returning handlers to be passed to useFeedback
  useFeedback(
    await args.bProgram({
      ...rest,
      send,
      disconnect,
      trigger: getPlaitedTrigger(trigger, disconnectSet),
    }),
  )
  // Attach event listeners for events from main thread
  context.addEventListener('message', eventHandler, false)
}
