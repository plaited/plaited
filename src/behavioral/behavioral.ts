import { ueid } from '../utils/ueid.ts'
import {
  BTHREAD_ID_PREFIX,
  EVENT_SOURCES,
  FRONTIER_STATUS,
  SNAPSHOT_MESSAGE_KINDS,
  TRIGGER_ID_PREFIX,
} from './behavioral.constants.ts'
import type { BPEvent, FeedbackError, SelectionBid, SnapshotMessage, ThreadReference } from './behavioral.schemas.ts'
import {
  advanceRunningToPending,
  computeFrontier,
  isListeningFor,
  resumePendingThreadsForSelectedEvent,
} from './behavioral.shared.ts'
import type {
  AddHandler,
  AddThread,
  Behavioral,
  CandidateBid,
  PendingBid,
  RunningBid,
  Sync,
  Trigger,
  UseSnapshot,
} from './behavioral.types.ts'

/**
 * @internal
 * Creates a simple publish-subscribe mechanism for event distribution.
 *
 * This function creates a publisher that maintains a set of listeners and provides methods
 * to publish values to all listeners and to subscribe/unsubscribe listeners.
 *
 * @template T - Type of values published through this mechanism.
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
 * Formats the current state (pending bids, candidates, selected event) into a SnapshotMessage array.
 *
 * This function analyzes the relationships between threads (blocking, interruption), determines
 * which event was selected, and creates a comprehensive view of the current execution step.
 * The resulting array is sorted by priority to show higher priority events first.
 */
const formatSnapshotBids = ({
  candidates,
  pending,
  selectedEvent,
}: {
  candidates: CandidateBid[]
  pending: Map<string, PendingBid>
  selectedEvent?: CandidateBid
}) => {
  const resolveThreadSnapshotMeta = (id: string): ThreadReference => {
    const label = pending.get(id)!.label
    return {
      label,
      id,
    }
  }
  const resolveThreadReference = (thread?: string) => (thread ? resolveThreadSnapshotMeta(thread) : undefined)

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

  const ruleSets: SelectionBid[] = []
  for (const bid of candidates) {
    const blockedBy = blockingThreads.find(({ block }) => isListeningFor(bid)(block))?.thread
    const interrupts = interruptedThreads.find(({ interrupt }) => isListeningFor(bid)(interrupt))?.thread
    const message: SelectionBid = {
      thread: resolveThreadSnapshotMeta(bid.thread),
      source: bid.source,
      type: bid.type,
      selected: selectedEvent ? selectedEvent.thread === bid.thread : false,
      priority: bid.priority,
      detail: bid.detail,
      blockedBy: resolveThreadReference(blockedBy),
      interrupts: resolveThreadReference(interrupts),
    }
    ruleSets.push(message)
  }
  return ruleSets.sort((a, b) => a.priority - b.priority)
}

const snapshotFormatter = ({
  candidates,
  selectedEvent,
  pending,
}: {
  candidates: CandidateBid[]
  selectedEvent: CandidateBid
  pending: Map<string, PendingBid>
}) => {
  return {
    kind: SNAPSHOT_MESSAGE_KINDS.selection,
    bids: formatSnapshotBids({ candidates, selectedEvent, pending }),
  }
}

const buildThreadReferences = ({ threads }: { threads: Array<ThreadReference | undefined> }) => {
  const seenPairs = new Set<string>()
  const references: ThreadReference[] = []

  for (const thread of threads) {
    if (!thread) {
      continue
    }
    const dedupeKey = JSON.stringify([thread.label, thread.id ?? null])
    if (seenPairs.has(dedupeKey)) {
      continue
    }
    seenPairs.add(dedupeKey)
    references.push(thread)
  }
  return references
}

const deadlockSnapshotFormatter = ({
  candidates,
  pending,
}: {
  candidates: CandidateBid[]
  pending: Map<string, PendingBid>
}) => {
  const bids = formatSnapshotBids({ candidates, pending }).map((bid) => ({
    ...bid,
    selected: false as const,
    reason: 'blocked' as const,
  }))
  const blockedCount = bids.filter((bid) => Boolean(bid.blockedBy?.label)).length

  return {
    kind: SNAPSHOT_MESSAGE_KINDS.deadlock,
    bids,
    summary: {
      candidateCount: bids.length,
      blockedCount,
      unblockedCount: bids.length - blockedCount,
      blockers: buildThreadReferences({
        threads: bids.map((bid) => bid.blockedBy),
      }),
      interrupters: buildThreadReferences({
        threads: bids.map((bid) => bid.interrupts),
      }),
    },
  }
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
 * @template Details - Type map for event payloads, mapping event types to detail payload types.
 * @returns Immutable API for interacting with the behavioral program.
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
 */
export const behavioral: Behavioral = () => {
  /**
   * @internal
   * Map of threads that have yielded and are waiting for event selection.
   *
   * Key: threadId (string for named threads)
   * Value: PendingBid containing the thread's generator and yielded Idioms.
   * These threads have reached a synchronization point and declared their behavioral intentions.
   */
  const pending = new Map<string, PendingBid>()

  /**
   * @internal
   * Map of threads whose generators are ready to run (or have just been triggered).
   *
   * Key: threadId (string for named threads)
   * Value: RunningBid containing the thread's generator.
   * These threads are about to execute until they yield at their next synchronization point.
   */
  const running = new Map<string, RunningBid>()

  /**
   * @internal
   * Publisher for selected events, consumed by `useFeedback`.
   * This is the mechanism by which selected events are delivered to external handlers.
   */
  const actionPublisher = createPublisher<BPEvent>()

  /**
   * @internal
   * Publisher for state snapshots, consumed by `useSnapshot`.
   * Always exists — subscribers are added/removed via `useSnapshot` which delegates to `subscribe`.
   */
  const snapshotPublisher = createPublisher<SnapshotMessage>()

  const step = () => {
    if (running.size) {
      advanceRunningToPending(running, pending)
      selectNextEvent()
    }
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
   * 5. If an event is selected, publishes a snapshot and proceeds to the next step
   * 6. If no event is selected, the super-step ends (program pauses until external trigger)
   */
  function selectNextEvent() {
    const frontier = computeFrontier({ pending })

    if (frontier.status === FRONTIER_STATUS.ready) {
      /** @internal Priority Queue BPEvent Selection Strategy */
      const selectedEvent = frontier.enabled.sort(
        ({ priority: priorityA }, { priority: priorityB }) => priorityA - priorityB,
      )[0]!
      snapshotPublisher(snapshotFormatter({ candidates: frontier.candidates, selectedEvent, pending }))
      nextStep(selectedEvent)
      return
    }
    if (frontier.status === FRONTIER_STATUS.deadlock) {
      snapshotPublisher(deadlockSnapshotFormatter({ candidates: frontier.candidates, pending }))
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
   * @param selectedEvent - Event candidate selected for this step.
   */
  function nextStep(selectedEvent: CandidateBid) {
    resumePendingThreadsForSelectedEvent({
      selectedEvent,
      running,
      pending,
    })
    actionPublisher({ type: selectedEvent.type, detail: selectedEvent.detail })

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
    step()
  }

  /**
   * @internal
   * Implementation of the public `trigger` function.
   */
  const trigger: Trigger = (event) => {
    const thread = function* () {
      yield {
        request: event,
      }
    }
    const threadId = ueid(TRIGGER_ID_PREFIX)
    running.set(threadId, {
      priority: 0,
      source: EVENT_SOURCES.trigger,
      generator: thread(),
      ingress: true,
      label: event.type,
    })

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
    step()
  }

  /**
   * @internal
   * Implementation of the public `useFeedback` hook.
   *
   * Subscribes the provided handlers to the action publisher, invoking the
   * appropriate handler whenever a matching event is selected.
   * Returns a disconnect function that removes the subscription when called.
   *
   * @remarks
   * The subscriber is async so both sync and async handlers are caught by
   * the try/catch. Errors are published as `feedback_error` snapshot messages
   * and logged to console. The publisher still fire-and-forgets the returned
   * promise via `void cb(value)`, so the BP engine loop is never blocked.
   *
   * The generic type parameter `Details` enables type-safe handler mapping,
   * where each handler receives its correctly-typed detail payload.
   */
  const addHandler: AddHandler = (type, handler, once) => {
    const disconnect = actionPublisher.subscribe(async (data: BPEvent) => {
      if (data.type === type) {
        try {
          if (once) disconnect()
          await handler(data.detail as Parameters<typeof handler>[0], disconnect)
        } catch (error) {
          const message: FeedbackError = {
            kind: SNAPSHOT_MESSAGE_KINDS.feedback_error,
            type,
            detail: data.detail,
            error: error instanceof Error ? error.message : String(error),
          }
          snapshotPublisher(message)
        }
      }
    })
    return disconnect
  }

  const addThread: AddThread = (label: string, thread: ReturnType<Sync>) => {
    const threadId = ueid(BTHREAD_ID_PREFIX)
    running.set(threadId, {
      priority: running.size + 1,
      source: EVENT_SOURCES.request,
      generator: thread(),
      label,
    })
  }
  /**
   * @internal
   * Implementation of the public `useSnapshot` hook.
   * Delegates directly to the snapshot publisher's subscribe method.
   */
  const useSnapshot: UseSnapshot = (listener) => snapshotPublisher.subscribe(listener)

  /**
   * @internal
   * Return the frozen public API object.
   *
   * Object.freeze ensures the API surface is immutable, preventing accidental
   * modification of the program's interface. This provides a stable and
   * predictable API for consumers of the behavioral program.
   */
  return Object.freeze({
    /** Add thread to program. */
    addThread,
    /** Function to inject external events into the program. */
    trigger,

    addHandler,
    /** Hook to subscribe to internal state snapshots for monitoring/debugging. */
    useSnapshot,
  })
}
