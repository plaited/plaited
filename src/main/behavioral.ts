import { ueid } from '../utils.ts'
import { FRONTIER_STATUS, TRACE_MESSAGE_KINDS } from './behavioral.constants.ts'
import { type Trace, validateBPEvent, validateThread } from './behavioral.schemas.ts'
import type {
  CandidateBid,
  PendingBid,
  RunningBid,
  SendTrace,
  UseAddThread,
  UseTrace,
  UseTrigger,
} from './behavioral.types.ts'
import {
  advanceRunningToPending,
  computeFrontier,
  generateRulesFunctions,
  resumePendingThreadsForSelectedEvent,
  useThread,
} from './behavioral.utils.ts'

/**
 * @internal
 * Serializes the pending set into a trace-friendly thread list.
 */
const serializePending = (pending: Set<PendingBid>) =>
  Array.from(pending).map(({ waitFor, block, interrupt, request, transform, generator: _gen, ...rest }) => ({
    ...rest,
    // request is field-picked to { type, detail } so non-trace fields never
    // enter any SnapshotMessage (frontier-analysis invariant).
    ...(request && {
      request: {
        type: request.type,
        ...(request.detail === undefined ? {} : { detail: request.detail }),
      },
    }),
    ...(waitFor && { waitFor }),
    ...(block && { block }),
    ...(interrupt && { interrupt }),
    ...(transform && { transform }),
  }))

/**
 * @internal
 * Projects a {@link CandidateBid} to the JSON-only trace shape (`priority`,
 * `type`, `detail`, `ingress`, `space`).
 *
 * Frontiers must stay JSON so frontier analysis (trace replay/matching) and the
 * visited-set key never observe non-serializable values.
 */
const toCandidateSnapshot = ({ priority, type, detail, ingress, space }: CandidateBid) => ({
  priority,
  type,
  ...(detail === undefined ? {} : { detail }),
  ...(ingress === undefined ? {} : { ingress }),
  ...(space === undefined ? {} : { space }),
})

/**
 * @internal
 * Projects the selected candidate to the JSON-only {@link SnapshotEvent} shape
 * (`type`, `detail`, `ingress`, `space`).
 */
const toSelectedSnapshot = ({ type, detail, ingress, space }: CandidateBid) => ({
  type,
  ...(detail === undefined ? {} : { detail }),
  ...(ingress === undefined ? {} : { ingress }),
  ...(space === undefined ? {} : { space }),
})

const createSubject = (): SendTrace => {
  const listeners = new Set<(value: Trace) => void | Promise<void>>()
  function publisher(value: Trace) {
    for (const cb of listeners) {
      try {
        // Promise.resolve passes native promises through unchanged and absorbs
        // non-native thenables, so every listener return value gets a rejection
        // handler without awaiting or yielding the event loop.
        void Promise.resolve(cb(value)).catch((error) =>
          console.error('[behavioral] trace listener rejected:', value.kind, error),
        )
      } catch (error) {
        console.error('[behavioral] trace listener threw:', value.kind, error)
      }
    }
  }
  publisher.subscribe = (listener: (msg: Trace) => void | Promise<void>) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
  return publisher
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
 *      - Publish a trace if a listener is attached (for debugging/monitoring).
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
export const behavioral = (options?: { instanceId?: string }) => {
  const instanceId = options?.instanceId ?? ueid('bp_')
  /**
   * @internal
   * Set of threads that have yielded and are waiting for event selection.
   *
   * Each entry is a PendingBid containing the thread's generator and yielded idioms.
   * These threads have reached a synchronization point and declared their behavioral intentions.
   */
  const pending = new Set<PendingBid>()

  /**
   * @internal
   * Set of threads whose generators are ready to run (or have just been triggered).
   *
   * Each entry is a RunningBid containing the thread's generator.
   * These threads are about to execute until they yield at their next synchronization point.
   */
  const running = new Set<RunningBid>()

  /**
   * @internal
   * Publisher for state traces, consumed by `useTrace`.
   * Always exists — subscribers are added/removed via `useTrace` which delegates to `subscribe`.
   */
  const sendTrace = createSubject()
  let stepId = 0

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
   * 5. If an event is selected, publishes a trace and proceeds to the next step
   * 6. If no event is selected, the super-step ends (program pauses until external trigger)
   */
  function selectNextEvent() {
    const step = stepId++

    sendTrace({
      kind: TRACE_MESSAGE_KINDS.pending_bids,
      timestamp: Date.now(),
      step,
      instanceId,
      threads: serializePending(pending),
    })

    const frontier = computeFrontier({ pending })
    const { enabled, candidates } = frontier
    sendTrace({
      kind: TRACE_MESSAGE_KINDS.frontier,
      timestamp: Date.now(),
      step,
      instanceId,
      status: frontier.status,
      candidates: candidates.map(toCandidateSnapshot),
      enabled: enabled.map(toCandidateSnapshot),
    })

    if (frontier.status === FRONTIER_STATUS.ready) {
      /** @internal Priority Queue BPEvent Selection Strategy */
      const selected = frontier.enabled.sort(
        ({ priority: priorityA }, { priority: priorityB }) => priorityA - priorityB,
      )[0]!
      nextStep(selected, step)
      return
    }
    if (frontier.status === FRONTIER_STATUS.deadlock) {
      sendTrace({
        kind: TRACE_MESSAGE_KINDS.deadlock,
        timestamp: Date.now(),
        step,
        instanceId,
      })
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
  function nextStep(selectedEvent: CandidateBid, stepId: number) {
    resumePendingThreadsForSelectedEvent({
      selectedEvent,
      running,
      pending,
      sendTrace,
      instanceId,
      step: stepId,
    })
    sendTrace({
      kind: TRACE_MESSAGE_KINDS.selection,
      timestamp: Date.now(),
      step: stepId,
      instanceId,
      selected: toSelectedSnapshot(selectedEvent),
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
   * Implementation of the public `trigger` function.
   */
  const useTrigger: UseTrigger = (space) => (event) => {
    if (!validateBPEvent(event)) {
      return sendTrace({
        kind: TRACE_MESSAGE_KINDS.trigger_error,
        timestamp: Date.now(),
        instanceId,
        error: validateBPEvent.errors ?? [],
        space,
      })
    }
    const thread = function* () {
      yield {
        request: event,
      }
    }
    running.add({
      space,
      priority: 0,
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

  const useAddThread: UseAddThread = (space) => (args) => {
    if (validateThread(args)) {
      const { label, rules, once } = args
      try {
        const syncPoints = generateRulesFunctions(rules, space)
        const thread = useThread(syncPoints, once)
        running.add({
          priority: running.size + 1,
          generator: thread(),
          label,
        })
      } catch (err) {
        sendTrace({
          kind: TRACE_MESSAGE_KINDS.add_thread_error,
          timestamp: Date.now(),
          instanceId,
          error: [err instanceof Error ? err.message : String(err)],
          space,
        })
      }
    } else {
      sendTrace({
        kind: TRACE_MESSAGE_KINDS.add_thread_error,
        timestamp: Date.now(),
        instanceId,
        error: validateThread.errors ?? [],
        space,
      })
    }
  }
  /**
   * @internal
   * Implementation of the public `useTrace` hook.
   * Delegates directly to the trace publisher's subscribe method.
   */
  const useTrace: UseTrace = (listener) => sendTrace.subscribe(listener)

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
    useAddThread,
    /** Function to inject external events into the program. */
    useTrigger,
    /** Hook to subscribe to internal state traces for monitoring/debugging. */
    useTrace,
  })
}
