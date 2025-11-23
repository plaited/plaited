import { isTypeOf } from '../utils.ts'
import type {
  Behavioral,
  BPEvent,
  BPEventTemplate,
  BPListener,
  BThreads,
  CandidateBid,
  PendingBid,
  RunningBid,
  SnapshotFormatter,
  SnapshotMessage,
  Trigger,
  UseFeedback,
  UseSnapshot,
} from './behavioral.types.ts'

/**
 * @internal
 * A simple listener function that always returns true, used for triggered events.
 * This allows externally triggered events to satisfy the waitFor condition in the trigger thread.
 */
const triggerWaitFor = () => true

/**
 * @internal
 * Creates a simple publish-subscribe mechanism for event distribution.
 *
 * This function creates a publisher that maintains a set of listeners and provides methods
 * to publish values to all listeners and to subscribe/unsubscribe listeners.
 *
 * @template T The type of values that will be published through this mechanism.
 * @returns A publisher function with a `subscribe` method attached.
 */
const createPublisher = <T>() => {
  const listeners = new Set<(value: T) => void | Promise<void>>()
  function publisher(value: T) {
    for (const cb of listeners) {
      void cb(value)
    }
  }
  publisher.subscribe = (listener: (msg: T) => void | Promise<void>) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
  return publisher
}

/**
 * @internal
 * Utility function to ensure a value is an array.
 *
 * If the input is already an array, it is returned unchanged.
 * If the input is not an array, it is wrapped in an array.
 *
 * @template T The type of elements in the array.
 * @param obj The value to ensure is an array. Defaults to an empty array if undefined.
 * @returns An array containing the input value(s).
 */
const ensureArray = <T>(obj: T | T[] = []) => (Array.isArray(obj) ? obj : [obj])

/**
 * @internal
 * Creates a checker function to determine if a given BPListener matches a CandidateBid.
 *
 * This is used to check if an event matches waitFor, block, or interrupt declarations.
 *
 * @param type The event type to check against.
 * @param detail The event detail payload to check against.
 * @returns A function that takes a BPListener and returns true if it matches the event.
 */
const isListeningFor = ({ type, detail }: CandidateBid) => {
  return (listener: BPListener): boolean =>
    isTypeOf<string>(listener, 'string')
      ? listener === type
      : listener({
          detail,
          type,
        })
}

/**
 * @internal
 * Checks if a pending request (Idiom['request']) matches the selected event candidate.
 *
 * This is used to determine if a thread's request was the one selected during event selection.
 *
 * @param selectedEvent The event candidate that was selected.
 * @param event The request from a thread's Idioms to check against the selected event.
 * @returns True if the request matches the selected event, false otherwise.
 */
const isPendingRequest = (selectedEvent: CandidateBid, event: BPEvent | BPEventTemplate) =>
  isTypeOf<BPEventTemplate>(event, 'function') ? event === selectedEvent?.template : event.type === selectedEvent.type

/**
 * @internal
 * Formats the current state (pending bids, candidates, selected event) into a SnapshotMessage array.
 *
 * This function analyzes the relationships between threads (blocking, interruption), determines
 * which event was selected, and creates a comprehensive view of the current execution step.
 * The resulting array is sorted by priority to show higher priority events first.
 */
const snapshotFormatter: SnapshotFormatter = ({ candidates, selectedEvent, pending }) => {
  const blockingThreads = [...pending].flatMap(([thread, { block }]) =>
    block && Array.isArray(block)
      ? block.map((listener) => ({ block: listener, thread }))
      : block
        ? [{ block, thread }]
        : [],
  )
  const interruptedThreads = [...pending].flatMap(([thread, { interrupt }]) =>
    interrupt && Array.isArray(interrupt)
      ? interrupt.map((listener) => ({ interrupt: listener, thread }))
      : interrupt
        ? [{ interrupt, thread }]
        : [],
  )

  const ruleSets: {
    thread: string
    trigger: boolean
    selected: boolean
    type: string
    detail?: unknown
    priority: number
    blockedBy?: string
    interrupts?: string
  }[] = []
  for (const bid of candidates) {
    const blockedBy = blockingThreads.find(({ block }) => isListeningFor(bid)(block))?.thread
    const interrupts = interruptedThreads.find(({ interrupt }) => isListeningFor(bid)(interrupt))?.thread
    const thread = bid.thread
    const message: SnapshotMessage[number] = {
      thread: isTypeOf<symbol>(thread, 'symbol') ? thread?.toString() : thread,
      trigger: bid.trigger ?? false,
      type: bid.type,
      selected: isPendingRequest(selectedEvent, bid),
      priority: bid.priority,
      detail: bid.detail,
      blockedBy: isTypeOf<symbol>(blockedBy, 'symbol') ? blockedBy?.toString() : blockedBy,
      interrupts: isTypeOf<symbol>(interrupts, 'symbol') ? interrupts?.toString() : interrupts,
    }
    ruleSets.push(message)
  }
  return ruleSets.sort((a, b) => a.priority - b.priority)
}
/**
 * Creates and manages a behavioral program instance, orchestrating the execution of b-threads.
 * This function implements the core logic of the Behavioral Programming execution model (super-steps).
 *
 * The behavioral program is the central coordination mechanism that manages a collection of
 * behavioral threads (b-threads) and orchestrates their synchronized execution according to
 * the BP paradigm. It maintains the state of all active threads, processes their synchronization
 * statements, selects events, and handles the publication of events to external subscribers.
 *
 * @returns An immutable object (`BProgramAPI`) containing functions to interact with the program.
 *
 * @remarks
 * The execution follows these general steps (super-step):
 *
 * 1. **Run Active Threads:** Advance all threads currently in the 'running' state to their next `yield`.
 *    This is where threads actually execute their code until they reach a synchronization point.
 *
 * 2. **Collect Bids:** Gather `request`, `waitFor`, and `block` declarations (`Idioms`) from all
 *    threads now in the 'pending' state. These declarations represent what each thread wants to
 *    do next.
 *
 * 3. **Select Event:** Identify candidate events (from `request` declarations). Filter out any
 *    candidates blocked by `block` declarations. Select the highest priority candidate event
 *    among the remaining ones.
 *
 * 4. **Notify & Update:**
 *    - If an event is selected:
 *      - Publish a snapshot if a listener is attached (for debugging/monitoring).
 *      - Identify threads waiting for, requesting, or interrupted by the selected event.
 *        Move these threads back to the 'running' state.
 *      - Publish the selected event via the `actionPublisher` (for `useFeedback` handlers).
 *      - Start the next super-step (`run()`).
 *    - If no event is selected (deadlock or program end), the execution halts until a new
 *      event is triggered externally.
 *
 * The program's execution is driven by events - either requested by threads or triggered
 * externally. It will continue executing super-steps as long as there are events to select
 * and threads to run. If no events can be selected (either because all requests are blocked
 * or there are no requests), the program will pause until an external event is triggered.
 *
 */
export const behavioral: Behavioral = () => {
  /**
   * @internal
   * Map of threads that have yielded and are waiting for event selection.
   *
   * Key: threadId (string for named threads, Symbol for trigger-originated threads)
   * Value: PendingBid containing the thread's generator and yielded Idioms.
   * These threads have reached a synchronization point and declared their behavioral intentions.
   */
  const pending = new Map<string | symbol, PendingBid>()

  /**
   * @internal
   * Map of threads whose generators are ready to run (or have just been triggered).
   *
   * Key: threadId (string for named threads, Symbol for trigger-originated threads)
   * Value: RunningBid containing the thread's generator.
   * These threads are about to execute until they yield at their next synchronization point.
   */
  const running = new Map<string | symbol, RunningBid>()

  /**
   * @internal
   * Publisher for selected events, consumed by `useFeedback`.
   * This is the mechanism by which selected events are delivered to external handlers.
   */
  const actionPublisher = createPublisher<BPEvent>()

  /**
   * @internal
   * Publisher for state snapshots, consumed by `useSnapshot`. Lazily initialized.
   * This is only created when a snapshot listener is registered, to avoid unnecessary overhead.
   */
  let snapshotPublisher:
    | {
        (value: SnapshotMessage): void
        subscribe(listener: (msg: SnapshotMessage) => void | Promise<void>): () => void
      }
    | undefined

  /**
   * @internal
   * Initiates a super-step if there are running threads.
   * This is the entry point for the behavioral program's execution cycle.
   * It checks if there are any threads ready to run, and if so, advances them.
   */
  function run() {
    running.size && step()
  }

  /**
   * @internal
   * Executes one part of the super-step: advancing running threads to their next yield.
   *
   * This function:
   * 1. Iterates through all running threads
   * 2. Advances each thread's generator to its next yield point
   * 3. Captures the yielded Idioms (synchronization declarations)
   * 4. Moves the thread from 'running' to 'pending' state
   * 5. Proceeds to the event selection phase
   */
  function step() {
    for (const [thread, bid] of running) {
      const { generator, priority, trigger } = bid
      const { value, done } = generator.next()
      !done &&
        pending.set(thread, {
          priority,
          ...(trigger && { trigger }),
          generator,
          ...value,
        })
      running.delete(thread)
    }
    selectNextEvent()
  }

  /**
   * @internal
   * Executes the event selection part of the super-step.
   *
   * This function:
   * 1. Collects all block declarations from pending threads
   * 2. Collects all request declarations as candidate events
   * 3. Filters out candidates that are blocked
   * 4. Selects the highest priority remaining candidate
   * 5. If an event is selected and there is a defined snapshot publisher, publishes a snapshot and proceeds to the next step
   * 6. If no event is selected, the super-step ends (program pauses until external trigger)
   */
  function selectNextEvent() {
    const blocked: BPListener[] = []
    const candidates: CandidateBid[] = []
    for (const [thread, { request, priority, block, trigger }] of pending) {
      block && blocked.push(...ensureArray(block))
      request &&
        candidates.push({
          priority,
          trigger,
          thread,
          ...(isTypeOf<BPEventTemplate>(request, 'function') ? { template: request, ...request() } : request),
        })
    }
    const filteredBids: CandidateBid[] = []
    const length = candidates.length
    for (let i = 0; i < length; i++) {
      const candidate = candidates[i]
      if (!blocked.some(isListeningFor(candidate))) {
        filteredBids.push(candidate)
      }
    }
    /** @internal Priority Queue BPEvent Selection Strategy */
    const selectedEvent = filteredBids.sort(
      ({ priority: priorityA }, { priority: priorityB }) => priorityA - priorityB,
    )[0]
    if (selectedEvent) {
      snapshotPublisher?.(snapshotFormatter({ candidates, selectedEvent, pending }))
      nextStep(selectedEvent)
    }
  }

  /**
   * @internal
   * Processes the selected event, updates thread states, and triggers the next cycle.
   *
   * This function:
   * 1. Identifies threads waiting for, requesting, or interrupted by the selected event
   * 2. Terminates threads that were interrupted
   * 3. Moves affected threads from 'pending' back to 'running' state
   * 4. Publishes the selected event to feedback handlers
   * 5. Initiates the next super-step
   *
   * @param selectedEvent The event candidate that was selected for this step
   */
  function nextStep(selectedEvent: CandidateBid) {
    for (const [thread, bid] of pending) {
      const { waitFor, request, generator, interrupt } = bid
      const isInterrupted = ensureArray(interrupt).some(isListeningFor(selectedEvent))
      const isWaitedFor = ensureArray(waitFor).some(isListeningFor(selectedEvent))
      const hasPendingRequest = request && isPendingRequest(selectedEvent, request)
      isInterrupted && generator.return?.()
      if (hasPendingRequest || isInterrupted || isWaitedFor) {
        running.set(thread, bid)
        pending.delete(thread)
      }
    }
    /**
     * @internal
     * To avoid infinite loop with calling trigger from feedback always publish select event
     * after checking if request(s) is waitList and before our next run
     */
    actionPublisher({ type: selectedEvent.type, detail: selectedEvent.detail })
    run()
  }

  /**
   * @internal
   * Implementation of the public `trigger` function.
   *
   * This creates a special temporary thread with highest priority (0) that:
   * 1. Requests the specified event
   * 2. Waits for any event (using triggerWaitFor which always returns true)
   * 3. Terminates after the event is processed
   *
   * The thread is identified by a Symbol based on the event type for uniqueness.
   */
  const trigger: Trigger = (request) => {
    const thread = function* () {
      yield {
        request,
        waitFor: [triggerWaitFor],
      }
    }
    running.set(Symbol(request.type), {
      priority: 0,
      trigger: true,
      generator: thread(),
    })
    run()
  }

  /**
   * @internal
   * Implementation of the public `useFeedback` hook.
   *
   * This subscribes the provided handlers to the action publisher, which will
   * invoke the appropriate handler whenever a matching event is selected.
   * It returns a disconnect function that removes the subscription when called.
   */
  const useFeedback: UseFeedback = (handlers) => {
    const disconnect = actionPublisher.subscribe((data: BPEvent) => {
      const { type, detail } = data
      if (Object.hasOwn(handlers, type)) {
        void handlers[type](detail)
      }
    })
    return disconnect
  }

  /**
   * @internal
   * Implementation of the public `bThreads` utility.
   *
   * This provides methods to add/replace threads and check thread status.
   * The implementation ensures proper thread initialization and state tracking.
   */
  const bThreads: BThreads = {
    set: (threads) => {
      for (const thread in threads) {
        running.set(thread, {
          priority: running.size + 1,
          generator: threads[thread](),
        })
      }
    },
    has: (thread) => ({
      running: running.has(thread),
      pending: pending.has(thread),
    }),
  }

  /**
   * @internal
   * Implementation of the public `useSnapshot` hook.
   *
   * This lazily initializes the snapshot publisher if needed, then
   * subscribes the provided listener to receive state snapshots.
   * It returns a disconnect function that removes the subscription when called.
   */
  const useSnapshot: UseSnapshot = (listener) => {
    if (snapshotPublisher === undefined) snapshotPublisher = createPublisher<SnapshotMessage>()
    const unsubscribe = snapshotPublisher.subscribe(listener)
    return () => {
      unsubscribe()
      snapshotPublisher = undefined
    }
  }

  /**
   * @internal
   * Return the frozen public API object.
   *
   * Object.freeze ensures the API surface is immutable, preventing accidental
   * modification of the program's interface. This provides a stable and
   * predictable API for consumers of the behavioral program.
   */
  return Object.freeze({
    /** Provides methods to manage behavioral threads (`set`, `has`). */
    bThreads,
    /** Function to inject external events into the program. */
    trigger,
    /** Hook to subscribe to selected events with feedback handlers. */
    useFeedback,
    /** Hook to subscribe to internal state snapshots for monitoring/debugging. */
    useSnapshot,
  })
}
