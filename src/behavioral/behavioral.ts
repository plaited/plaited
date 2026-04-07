import { ueid } from '../utils/ueid.ts'
import { isTypeOf } from '../utils.ts'
import { SNAPSHOT_MESSAGE_KINDS } from './behavioral.constants.ts'
import { computeFrontier, ensureArray, isListeningFor, isPendingRequest } from './behavioral.frontier.ts'
import type { SelectionBid, SnapshotMessage, ThreadReference } from './behavioral.schemas.ts'
import type {
  Behavioral,
  BPEvent,
  BThreads,
  CandidateBid,
  Emit,
  EventDetails,
  EventSource,
  PendingBid,
  ReportSnapshot,
  RunningBid,
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
  pending: Map<string | symbol, PendingBid>
  selectedEvent?: CandidateBid
}) => {
  const resolveThreadSnapshotMeta = (thread: string | symbol): ThreadReference => {
    if (isTypeOf<symbol>(thread, 'symbol')) {
      return { label: thread.toString() }
    }
    const label = pending.get(thread)?.label
    if (label) {
      return {
        label,
        id: thread,
      }
    }
    return { label: thread }
  }
  const resolveThreadReference = (thread?: string | symbol): ThreadReference | undefined => {
    if (!thread) {
      return undefined
    }
    return resolveThreadSnapshotMeta(thread)
  }

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
    const threadMeta = resolveThreadSnapshotMeta(bid.thread)
    const blockedByMeta = resolveThreadReference(blockedBy)
    const interruptsMeta = resolveThreadReference(interrupts)
    const message: SelectionBid = {
      thread: threadMeta,
      source: bid.source,
      trigger: bid.source === 'trigger',
      type: bid.type,
      selected: selectedEvent ? isPendingRequest(selectedEvent, bid) : false,
      priority: bid.priority,
      detail: bid.detail,
      blockedBy: blockedByMeta,
      interrupts: interruptsMeta,
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
  pending: Map<string | symbol, PendingBid>
}) => {
  return {
    kind: SNAPSHOT_MESSAGE_KINDS.selection,
    bids: formatSnapshotBids({ candidates, selectedEvent, pending }),
  }
}

const deadlockSnapshotFormatter = ({
  candidates,
  pending,
}: {
  candidates: CandidateBid[]
  pending: Map<string | symbol, PendingBid>
}) => {
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

  const bids = formatSnapshotBids({ candidates, pending }).map((bid) => ({
    ...bid,
    selected: false as const,
    reason: 'blocked' as const,
  }))
  const blockers = buildThreadReferences({
    threads: bids.map((bid) => bid.blockedBy),
  })
  const interruptors = buildThreadReferences({
    threads: bids.map((bid) => bid.interrupts),
  })
  const blockedCount = bids.filter((bid) => Boolean(bid.blockedBy?.label)).length
  const unblockedCount = bids.length - blockedCount

  return {
    kind: SNAPSHOT_MESSAGE_KINDS.deadlock,
    bids,
    summary: {
      candidateCount: bids.length,
      blockedCount,
      unblockedCount,
      blockers,
      interruptors,
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
export const behavioral: Behavioral = <Details extends EventDetails = EventDetails>() => {
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
   * Publisher for state snapshots, consumed by `useSnapshot`.
   * Always exists — subscribers are added/removed via `useSnapshot` which delegates to `subscribe`.
   */
  const snapshotPublisher = createPublisher<SnapshotMessage>()

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
      const { generator, priority, source, label } = bid
      const { value, done } = generator.next()
      !done &&
        pending.set(thread, {
          priority,
          source,
          ...(label && { label }),
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
   * 5. If an event is selected, publishes a snapshot and proceeds to the next step
   * 6. If no event is selected, the super-step ends (program pauses until external trigger)
   */
  function selectNextEvent() {
    const frontier = computeFrontier({ pending })

    if (frontier.status === 'ready') {
      /** @internal Priority Queue BPEvent Selection Strategy */
      const selectedEvent = frontier.enabled.sort(
        ({ priority: priorityA }, { priority: priorityB }) => priorityA - priorityB,
      )[0]!
      snapshotPublisher(snapshotFormatter({ candidates: frontier.candidates, selectedEvent, pending }))
      nextStep(selectedEvent)
      return
    }
    if (frontier.status === 'deadlock') {
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
    actionPublisher({ type: selectedEvent.type, detail: selectedEvent.detail })
    running.size && step()
  }

  const enqueueIngress = ({ event, source }: { event: BPEvent; source: EventSource }) => {
    const thread = function* () {
      yield {
        request: event as BPEvent,
        waitFor: [triggerWaitFor],
      }
    }
    running.set(Symbol(event.type), {
      priority: 0,
      source,
      generator: thread(),
    })
    running.size && step()
  }

  /**
   * @internal
   * Implementation of the public `trigger` function.
   */
  const trigger: Trigger = (request) => {
    enqueueIngress({
      event: request,
      source: 'trigger',
    })
  }

  /**
   * @internal
   * Implementation of the module ingress `emit` function.
   */
  const emit: Emit = (request) => {
    enqueueIngress({
      event: request,
      source: 'emit',
    })
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
  const useFeedback: UseFeedback<Details> = (handlers) => {
    const disconnect = actionPublisher.subscribe(async (data: BPEvent) => {
      const { type, detail } = data
      if (Object.hasOwn(handlers, type)) {
        try {
          await handlers[type]!(detail)
        } catch (error) {
          const message = {
            kind: SNAPSHOT_MESSAGE_KINDS.feedback_error,
            type,
            detail,
            error: error instanceof Error ? error.message : String(error),
          }
          snapshotPublisher(message)
        }
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
        if (running.has(thread) || pending.has(thread)) {
          const message = {
            kind: SNAPSHOT_MESSAGE_KINDS.bthreads_warning,
            thread,
            warning: `Thread "${thread}" already exists and cannot be replaced. Use the 'interrupt' idiom to terminate threads explicitly.`,
          }
          snapshotPublisher(message)
          console.warn(message)
          continue
        }
        running.set(thread, {
          priority: running.size + 1,
          source: 'request',
          generator: threads[thread]!(),
        })
      }
    },
    spawn: ({ label, thread }) => {
      const threadId = ueid('bt_')
      running.set(threadId, {
        priority: running.size + 1,
        source: 'request',
        generator: thread(),
        label,
      })
      return threadId
    },
    has: (thread) => ({
      running: running.has(thread),
      pending: pending.has(thread),
    }),
  }

  /**
   * @internal
   * Implementation of the public `useSnapshot` hook.
   * Delegates directly to the snapshot publisher's subscribe method.
   */
  const useSnapshot: UseSnapshot = (listener) => snapshotPublisher.subscribe(listener)
  const reportSnapshot: ReportSnapshot = (message) => snapshotPublisher(message)

  /**
   * @internal
   * Return the frozen public API object.
   *
   * Object.freeze ensures the API surface is immutable, preventing accidental
   * modification of the program's interface. This provides a stable and
   * predictable API for consumers of the behavioral program.
   */
  return Object.freeze({
    /** Provides methods to manage behavioral threads (`set`, `spawn`, `has`). */
    bThreads,
    /** Function to inject external events into the program. */
    trigger,
    /** Function to inject module-origin events into the program. */
    emit,
    /** Hook to subscribe to selected events with feedback handlers. */
    useFeedback,
    /** Hook to subscribe to internal state snapshots for monitoring/debugging. */
    useSnapshot,
    /** Host/runtime seam for publishing structured diagnostics to snapshot subscribers. */
    reportSnapshot,
  })
}
