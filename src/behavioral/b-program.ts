import type { BPEvent, BPEventTemplate, BPListener, Idioms, RulesFunction } from './b-thread.js'
import { isTypeOf } from '../utils/is-type-of.js'

/** @internal Represents a b-thread that is currently executing its generator function. */
type RunningBid = {
  /** Internal flag indicating if this bid originated from an external trigger. */
  trigger?: true
  /** The priority level of the thread. */
  priority: number
  /** The generator iterator representing the thread's execution state. */
  generator: IterableIterator<Idioms>
}
/** @internal Represents a b-thread that has yielded and is waiting for the next event selection. Includes the yielded Idioms. */
type PendingBid = Idioms & RunningBid

/** @internal Represents a potential event candidate derived from a pending thread's request. */
type CandidateBid = {
  /** The identifier of the thread proposing the event. */
  thread: string | symbol
  /** The priority of the thread proposing the event. */
  priority: number
  /** The type of the requested event. */
  type: string
  /** Optional detail payload of the requested event. */
  detail?: unknown
  /** Internal flag indicating if this bid originated from an external trigger. */
  trigger?: true
  /** If the request was a template function, this holds the template. */
  template?: BPEventTemplate
}
/**
 * Represents a cleanup function, typically returned by subscription or registration mechanisms.
 * Calling this function should perform the necessary cleanup actions, such as removing listeners,
 * clearing timeouts, or releasing resources.
 *
 * @returns void - Performs the cleanup action when called.
 * @example
 * const listener = (data) => console.log(data);
 * eventEmitter.subscribe(listener);
 * const disconnect = () => eventEmitter.unsubscribe(listener);
 *
 * // Later...
 * disconnect(); // Removes the listener.
 */
export type Disconnect = () => void

/**
 * Represents a snapshot of the behavioral program's state at a specific step (super-step).
 * It's an array where each element describes the status of an active b-thread.
 * Useful for debugging, monitoring, and understanding the program's execution flow.
 *
 * @property thread - The unique identifier of the thread associated with this bid (stringified if from `trigger()`).
 * @property trigger - Indicates if this bid originated from external `trigger()` (true) vs thread's `request` (false).
 * @property selected - Indicates if this bid was selected for execution in the current step.
 * @property type - The event type the thread is currently requesting or waiting for.
 * @property detail - Optional data associated with the event.
 * @property priority - The priority level of the thread's bid. Lower numbers = higher priority.
 * @property blockedBy - If this thread's request is blocked, ID of the blocking thread.
 * @property interrupts - If this bid interrupts another thread, ID of the interrupted thread.
 */
export type SnapshotMessage = {
  /** The unique identifier of the thread associated with this bid (stringified if this bid originated from an external `trigger()` as they use a Symbol identifier). */
  thread: string
  /** Indicates if this bid originated from an external `trigger()` call (`true`) rather than a thread's `request` (`false`). */
  trigger: boolean
  /** Indicates if this specific bid (request) was the one selected for execution in the current step. */
  selected: boolean
  /** The type of event the thread is requesting or waiting for. */
  type: string
  /** Optional data associated with the event. */
  detail?: unknown
  /** The priority level assigned to the thread's bid. Lower numbers indicate higher priority. */
  priority: number
  /** If blockedBy, the identifier of the thread causing the block; otherwise, undefined. */
  blockedBy?: string
  /** If interrupts, the identifier of the thread interrupted by the selected event; otherwise, undefined. */
  interrupts?: string
}[]

/** @internal A function type responsible for formatting the internal state of the bProgram into a `SnapshotMessage`. */
type SnapshotFormatter = (args: {
  /** Map of threads currently in a pending state (yielded). */
  pending: Map<string | symbol, PendingBid>
  /** The event candidate selected for execution in the current step. */
  selectedEvent: CandidateBid
  /** All event candidates considered in the current step. */
  candidates: CandidateBid[]
}) => SnapshotMessage

/**
 * A callback function invoked with a snapshot (`SnapshotMessage`) of the behavioral program's state
 * after each event selection step (super-step). Allows for observing the program's internal execution.
 *
 * @param msg An array (`SnapshotMessage`) detailing the status of each active thread during the step.
 * @returns May return `void` or a `Promise<void>` for asynchronous listeners.
 * @example
 * const mySnapshotListener: SnapshotListener = (snapshot) => {
 *   console.log(`Step completed. Selected: ${snapshot.find(s => s.selected)?.type}`);
 *   console.table(snapshot);
 * };
 * useSnapshot(mySnapshotListener);
 */
export type SnapshotListener = (msg: SnapshotMessage) => void | Promise<void>

/**
 * @internal Defines the basic structure for event handlers used in `useFeedback`.
 * A record where keys are event types (strings) and values are functions
 * that handle the event's detail payload. Handlers can be sync or async.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DefaultHandlers = Record<string, (detail: any) => void | Promise<void>>

/**
 * Represents a collection of callback functions (handlers) keyed by event type,
 * used with `useFeedback` to react to selected events.
 * When a `bProgram` selects an event, the corresponding handler in this collection is invoked
 * with the event's `detail` payload.
 *
 * @template T Allows extending the base `DefaultHandlers` with more specific, typed handlers.
 * @example
 * type AppHandlers = Handlers<{
 *   'user:login': (credentials: { user: string }) => void;
 *   'data:load': (params: { id: number }) => Promise<void>;
 * }>;
 *
 * const appHandlers: AppHandlers = {
 *   'user:login': ({ user }) => console.log(`${user} logged in`),
 *   'data:load': async ({ id }) => { await loadData(id); },
 *   // Can also include handlers for any event type implicitly via DefaultHandlers
 *   'generic:event': (detail) => console.log('Generic event:', detail),
 * };
 */
export type Handlers<T = DefaultHandlers> = DefaultHandlers & T

/**
 * A hook for subscribing to the events selected and published by the behavioral program.
 * This allows external code (like UI components or services) to react to the program's activity.
 *
 * @template T The specific type definition for the `handlers` object, extending `DefaultHandlers`.
 * @param handlers An object where keys are event type strings and values are the corresponding handler functions.
 *                 Each handler receives the `detail` payload of the selected event.
 * @returns A `Disconnect` function. Call this function to unsubscribe the provided handlers and stop receiving events.
 * @example
 * const { useFeedback } = bProgram();
 * const disconnect = useFeedback({
 *   'ui:button-click': (detail) => console.log('Button clicked:', detail),
 *   'api:response': async (data) => { await processApiResponse(data); }
 * });
 *
 * // To stop listening later:
 * // disconnect();
 */
export type UseFeedback = <T = DefaultHandlers>(handlers: Handlers<T>) => Disconnect

/**
 * A hook for registering a `SnapshotListener` to monitor the internal state transitions of the b-program.
 * Primarily intended for debugging, logging, observation, or creating development tools.
 *
 * @param listener The `SnapshotListener` callback function that will receive the `SnapshotMessage` array at each step.
 * @returns A `Disconnect` function. Call this function to unregister the snapshot listener.
 * @example
 * const { useSnapshot } = bProgram();
 * const snapshotListener: SnapshotListener = (snapshot) => { console.table(snapshot); };
 * const disconnectSnapshot = useSnapshot(snapshotListener);
 *
 * // To stop monitoring later:
 * // disconnectSnapshot();
 */
export type UseSnapshot = (listener: SnapshotListener) => Disconnect

/**
 * Provides methods for managing the b-threads within a `bProgram` instance.
 *
 * @property has - Checks if a thread with the given identifier exists and reports its status (running or pending).
 *                 - `running`: The thread's generator is currently executing (between yields).
 *                 - `pending`: The thread has yielded and is waiting for the next event selection.
 * @property set - Adds new b-threads to the program or replaces existing ones. Takes an object where keys are thread identifiers
 *                 and values are the corresponding `RulesFunction` (generator functions).
 */
export type BThreads = {
  /** Checks the status of a specific thread. */
  has: (thread: string) => { running: boolean; pending: boolean }
  /** Adds or replaces threads in the program. */
  set: (threads: Record<string, RulesFunction>) => void
}
/**
 * A function used to inject external events into the behavioral program.
 * Triggering an event initiates a new execution cycle (super-step) starting with this event.
 *
 * @template T The type of the `detail` payload for the event being triggered.
 * @param args The `BPEvent<T>` object to trigger.
 * @example
 * trigger({ type: 'USER_INPUT', detail: { value: 'hello' } });
 */
export type Trigger = <T>(args: BPEvent<T>) => void
/**
 * Factory function that creates and initializes a new behavioral program instance.
 * It returns an immutable object containing the core API for interacting with the program.
 *
 * @returns A readonly object containing:
 *  - `bThreads`: For managing threads (`set`, `has`).
 *  - `trigger`: For injecting external events.
 *  - `useFeedback`: For subscribing to selected events with handlers.
 *  - `useSnapshot`: For subscribing to internal state snapshots.
 * @example
 * const { bThreads, trigger, useFeedback, useSnapshot } = bProgram();
 */
export type BProgram = () => Readonly<{
  bThreads: BThreads
  trigger: Trigger
  useFeedback: UseFeedback
  useSnapshot: UseSnapshot
}>

/** @internal A simple listener function that always returns true, used for triggered events. */
const triggerWaitFor = () => true

/** @internal Creates a simple publish-subscribe mechanism. */
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

/** @internal Utility function to ensure a value is an array. */
const ensureArray = <T>(obj: T | T[] = []) => (Array.isArray(obj) ? obj : [obj])

/** @internal Creates a checker function to see if a given BPListener matches a CandidateBid. */
const isListeningFor = ({ type, detail }: CandidateBid) => {
  return (listener: BPListener): boolean =>
    typeof listener !== 'string' ?
      listener({
        detail,
        type,
      })
    : listener === type
}

/** @internal Checks if a pending request (Idiom['request']) matches the selected event candidate. */
const isPendingRequest = (selectedEvent: CandidateBid, event: BPEvent | BPEventTemplate) =>
  isTypeOf<BPEventTemplate>(event, 'function') ? event === selectedEvent?.template : event.type == selectedEvent.type

/** @internal Formats the current state (pending bids, candidates, selected event) into a SnapshotMessage array. */
const snapshotFormatter: SnapshotFormatter = ({ candidates, selectedEvent, pending }) => {
  const blockingThreads = [...pending].flatMap(([thread, { block }]) =>
    block && Array.isArray(block) ? block.map((listener) => ({ block: listener, thread }))
    : block ? [{ block, thread }]
    : [],
  )
  const interruptedThreads = [...pending].flatMap(([thread, { interrupt }]) =>
    interrupt && Array.isArray(interrupt) ? interrupt.map((listener) => ({ interrupt: listener, thread }))
    : interrupt ? [{ interrupt, thread }]
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
 * @returns An immutable object (`BProgramAPI`) containing functions to interact with the program.
 * @remarks
 * The execution follows these general steps (super-step):
 * 1. **Run Active Threads:** Advance all threads currently in the 'running' state to their next `yield`.
 * 2. **Collect Bids:** Gather `request`, `waitFor`, and `block` declarations (`Idioms`) from all threads now in the 'pending' state.
 * 3. **Select Event:** Identify candidate events (from `request` declarations). Filter out any candidates blocked by `block` declarations. Select the highest priority candidate event among the remaining ones.
 * 4. **Notify & Update:**
 *    - If an event is selected:
 *      - Publish a snapshot if a listener is attached.
 *      - Identify threads waiting for, requesting, or interrupted by the selected event. Move these threads back to the 'running' state.
 *      - Publish the selected event via the `actionPublisher` (for `useFeedback` handlers).
 *      - Start the next super-step (`run()`).
 *    - If no event is selected (deadlock or program end), the execution halts until a new event is triggered externally.
 */
export const bProgram: BProgram = () => {
  /** @internal Map of threads that have yielded and are waiting for event selection. Key: threadId */
  const pending = new Map<string | symbol, PendingBid>()
  /** @internal Map of threads whose generators are ready to run (or have just been triggered). Key: threadId */
  const running = new Map<string | symbol, RunningBid>()

  /** @internal Publisher for selected events, consumed by `useFeedback`. */
  const actionPublisher = createPublisher<BPEvent>()
  /** @internal Publisher for state snapshots, consumed by `useSnapshot`. Lazily initialized. */
  let snapshotPublisher:
    | {
        (value: SnapshotMessage): void
        subscribe(listener: (msg: SnapshotMessage) => void | Promise<void>): () => void
      }
    | undefined

  /** @internal Initiates a super-step if there are running threads. */
  function run() {
    running.size && step()
  }

  /** @internal Executes one part of the super-step: advancing running threads to their next yield. */
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

  /** @internal Executes the event selection part of the super-step. */
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(isTypeOf<BPEventTemplate<any>>(request, 'function') ? { template: request, ...request() } : request),
        })
    }
    const filteredBids: CandidateBid[] = []
    const length = candidates.length
    for (let i = 0; i < length; i++) {
      const candidate = candidates[i]
      // Are we blocking the the candidate event
      if (!blocked.some(isListeningFor(candidate))) {
        filteredBids.push(candidate)
      }
    }
    /** @summary Priority Queue BPEvent Selection Strategy */
    const selectedEvent = filteredBids.sort(
      ({ priority: priorityA }, { priority: priorityB }) => priorityA - priorityB,
    )[0]
    if (selectedEvent) {
      snapshotPublisher && snapshotPublisher(snapshotFormatter({ candidates, selectedEvent, pending }))
      nextStep(selectedEvent)
    }
  }

  /** @internal Processes the selected event, updates thread states, and triggers the next cycle. */
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
    // To avoid infinite loop with calling trigger from feedback always publish select event
    // after checking if request(s) is waitList and before our next run
    actionPublisher({ type: selectedEvent.type, detail: selectedEvent.detail })
    run()
  }

  /** @internal Implementation of the public `trigger` function. */
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

  /** @internal Implementation of the public `useFeedback` hook. */
  const useFeedback: UseFeedback = (handlers) => {
    const disconnect = actionPublisher.subscribe((data: BPEvent) => {
      const { type, detail = {} } = data
      if (Object.hasOwn(handlers, type)) {
        void handlers[type](detail)
      }
    })
    return disconnect
  }

  /** @internal Implementation of the public `bThreads` utility. */
  const bThreads: BThreads = {
    set: (threads) => {
      for (const thread in threads) {
        running.set(thread, {
          priority: running.size + 1,
          generator: threads[thread](),
        })
      }
    },
    has: (thread) => ({ running: running.has(thread), pending: pending.has(thread) }),
  }

  /** @internal Implementation of the public `useSnapshot` hook. */
  const useSnapshot: UseSnapshot = (listener) => {
    if (snapshotPublisher === undefined) snapshotPublisher = createPublisher<SnapshotMessage>()
    return snapshotPublisher.subscribe(listener)
  }

  /** @internal Return the frozen public API object. */
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
