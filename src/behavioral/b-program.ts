import type { BPEvent, BPEventTemplate, BPListener, Idioms, RulesFunction } from './b-thread.js'
import { isTypeOf } from '../utils/is-type-of.js'

type RunningBid = {
  trigger?: true | 'object' | 'person'
  priority: number
  generator: IterableIterator<Idioms>
}
type PendingBid = Idioms & RunningBid

type CandidateBid = {
  thread: string
  priority: number
  type: string
  detail?: unknown
  trigger?: true | 'object' | 'person'
  template?: BPEventTemplate
}
/**
 * Represents a cleanup function that removes listeners or handlers.
 * Used for disconnecting from event streams, removing observers, or cleaning up resources.
 * @returns void - Performs cleanup when called
 * @example
 * const disconnect = someListener(handler);
 * // Later, when cleanup is needed:
 * disconnect();
 */
export type Disconnect = () => void

/**
 * Represents a diagnostic message containing the state of behavioral threads at runtime.
 * Each array element describes a thread's status including:
 * - The thread identifier
 * - Whether it was selected for execution in the current step
 * - The event type requested or waited for by the thread
 * - Optional event details associated with the request or wait
 * - The priority level of the thread's bid
 * - Optional identifier of a thread that is blocking this thread's request
 */
export type SnapshotMessage = {
  /** The unique identifier for the behavioral thread. */
  thread: string
  /** Indicates if the thread's bid was selected for execution in the current step. */
  selected: boolean
  /** The type of event the thread is requesting or waiting for. */
  type: string
  /** Optional data associated with the event. */
  detail?: unknown
  /** The priority level assigned to the thread's bid. Lower numbers indicate higher priority. */
  priority: number
  /** If blocked, the identifier of the thread causing the block; otherwise, undefined. */
  blockedBy?: string
}[]

/** @internal Formats the internal state into a SnapshotMessage. */
type SnapshotFormatter = (args: {
  pending: Map<string, PendingBid>
  selectedEvent: CandidateBid
  candidates: CandidateBid[]
}) => SnapshotMessage

/**
 * A callback function invoked with a snapshot of the behavioral program's state at each step.
 * Useful for debugging, logging, or monitoring the execution flow and thread interactions.
 * The listener receives an array (`SnapshotMessage`) detailing the status of each active thread.
 *
 * @param msg An array representing the state of behavioral threads during a step.
 * @returns Can be synchronous (`void`) or asynchronous (`Promise<void>`).
 * @example
 * const listener: SnapshotListener = (snapshot) => {
 *   console.log('Current step snapshot:', snapshot);
 * };
 * useSnapshot(listener);
 */
export type SnapshotListener = (msg: SnapshotMessage) => void | Promise<void>

/**
 * @internal Defines the basic structure for event handlers used in `useFeedback`.
 * A record where keys are event types (strings) and values are functions
 * that handle the event's detail payload.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DefaultHandlers = Record<string, (detail: any) => void | Promise<void>>

/**
 * Represents a collection of callback functions (handlers) keyed by event type.
 * These handlers are executed when a corresponding event is selected and published by the b-program.
 * Handlers can perform synchronous or asynchronous operations based on the event's detail.
 *
 * @template T Allows extending the base `DefaultHandlers` with more specific handler types.
 * @example
 * type MyHandlers = Handlers<{
 *   'user/login': (credentials: { user: string }) => void;
 *   'data/load': (params: { id: number }) => Promise<void>;
 * }>;
 *
 * const myHandlers: MyHandlers = {
 *   'user/login': ({ user }) => console.log(`${user} logged in`),
 *   'data/load': async ({ id }) => { await fetchData(id); },
 * };
 */
export type Handlers<T = DefaultHandlers> = DefaultHandlers & T

/**
 * A hook for subscribing to events published by the behavioral program.
 * It allows external code to react to the events selected during the program's execution cycle.
 * Provide an object where keys are event types and values are the corresponding handler functions.
 *
 * @template T The type definition for the handlers object, extending `DefaultHandlers`.
 * @param handlers An object mapping event types (string) to handler functions.
 *                 Each handler receives the `detail` payload of the selected event.
 * @returns A `Disconnect` function. Call this function to unsubscribe the handlers and stop receiving events.
 * @example
 * const disconnect = useFeedback({
 *   'ui/button-click': (detail) => console.log('Button clicked:', detail),
 *   'api/response': async (data) => {
 *     await processApiResponse(data);
 *   }
 * });
 *
 * // To stop listening:
 * // disconnect();
 */
export type UseFeedback = <T = DefaultHandlers>(handlers: Handlers<T>) => Disconnect

/**
 * A hook for registering a `SnapshotListener` to observe the internal state of the b-program at each step.
 * This is primarily used for debugging and monitoring purposes.
 *
 * @param listener The callback function (`SnapshotListener`) that will receive the `SnapshotMessage` array.
 * @returns A `Disconnect` function. Call this function to unregister the listener.
 * @example
 * const snapshotListener: SnapshotListener = (snapshot) => {
 *   // Log the snapshot or send it to a monitoring tool
 *   console.table(snapshot);
 * };
 * const disconnectSnapshot = useSnapshot(snapshotListener);
 *
 * // To stop monitoring:
 * // disconnectSnapshot();
 */
export type UseSnapshot = (listener: SnapshotListener) => Disconnect

/**
 * Utility for managing behavioral threads within a program.
 * @property has - Checks if a thread exists and its execution status
 * @property set - Registers new behavioral threads with their rule functions
 */
export type BThreads = {
  has: (thread: string) => { running: boolean; pending: boolean }
  set: (threads: Record<string, RulesFunction>) => void
}
/**
 * Function for triggering events in the behavioral program.
 * Initiates the processing of a behavioral event through the program's threads.
 * @param args The event data to be processed by the behavioral program
 */
export type Trigger = <T>(args: BPEvent<T>) => void
/**
 * Factory function that creates a behavioral program instance.
 * Returns an immutable object containing core utilities for managing the program:
 * - bThreads: For thread management
 * - trigger: For event dispatching
 * - useFeedback: For registering feedback listeners
 * - useSnapshot: For monitoring program state
 * @returns Readonly object containing behavioral program utilities
 */
export type BProgram = () => Readonly<{
  bThreads: BThreads
  trigger: Trigger
  useFeedback: UseFeedback
  useSnapshot: UseSnapshot
}>

const triggerWaitFor = () => true

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

const ensureArray = <T>(obj: T | T[] = []) => (Array.isArray(obj) ? obj : [obj])

const isListeningFor = ({ type, detail }: CandidateBid) => {
  return (listener: BPListener): boolean =>
    typeof listener !== 'string' ?
      listener({
        detail,
        type,
      })
    : listener === type
}

const isPendingRequest = (selectedEvent: CandidateBid, event: BPEvent | BPEventTemplate) =>
  isTypeOf<BPEventTemplate>(event, 'function') ? event === selectedEvent?.template : event.type == selectedEvent.type

const snapshotFormatter: SnapshotFormatter = ({ candidates, selectedEvent, pending }) => {
  const blockingThreads = [...pending].flatMap(([thread, { block }]) =>
    block && Array.isArray(block) ? block.map((listener) => ({ block: listener, thread }))
    : block ? [{ block, thread }]
    : [],
  )
  const ruleSets: {
    thread: string
    selected: boolean
    type: string
    detail?: unknown
    priority: number
    blockedBy?: string
    trigger?: true | 'object' | 'person'
  }[] = []
  for (const bid of candidates) {
    const blockedCB = isListeningFor(bid)
    ruleSets.push({
      thread: bid.thread,
      selected: isPendingRequest(selectedEvent, bid),
      type: bid.type,
      priority: bid.priority,
      detail: bid.detail,
      blockedBy: blockingThreads.find(({ block }) => blockedCB(block))?.thread,
      trigger: bid.trigger,
    })
  }
  return ruleSets.sort((a, b) => a.priority - b.priority)
}
/**
 * Creates a behavioral program that orchestrates the execution of behavioral threads.
 * A behavioral program coordinates multiple threads, managing their event selection,
 * synchronization, and interaction to implement complex system behaviors.
 *
 * @remarks
 * Behavioral programs follow the Behavioral Programming paradigm, where system behavior
 * emerges from the interaction of independent threads that can request, wait for,
 * or block events.
 */
export const bProgram: BProgram = () => {
  const pending = new Map<string, PendingBid>()
  const running = new Map<string, RunningBid>()

  const actionPublisher = createPublisher<BPEvent>()
  let snapshotPublisher:
    | {
        (value: SnapshotMessage): void
        subscribe(listener: (msg: SnapshotMessage) => void | Promise<void>): () => void
      }
    | undefined
  function run() {
    running.size && step()
  }

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
  // Select next event
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
  // Queue up bids for next step of super step
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

  const trigger: Trigger = (request) => {
    const thread = function* () {
      yield {
        request,
        waitFor: [triggerWaitFor],
      }
    }
    running.set(request.type, {
      priority: 0,
      trigger: true,
      generator: thread(),
    })
    run()
  }

  const useFeedback: UseFeedback = (handlers) => {
    const disconnect = actionPublisher.subscribe((data: BPEvent) => {
      const { type, detail = {} } = data
      if (Object.hasOwn(handlers, type)) {
        void handlers[type](detail)
      }
    })
    return disconnect
  }

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

  const useSnapshot: UseSnapshot = (listener) => {
    if (snapshotPublisher === undefined) snapshotPublisher = createPublisher<SnapshotMessage>()
    return snapshotPublisher.subscribe(listener)
  }

  return Object.freeze({
    /** add threads functions to behavioral program and verify if there still active */
    bThreads,
    /** trigger a run and event on behavioral program */
    trigger,
    /** connect action function to behavioral program */
    useFeedback,
    /** connect a listener that receives state snapshots for each step of a running behavioral program */
    useSnapshot,
  })
}
