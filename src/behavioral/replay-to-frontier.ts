import { computeFrontier, ensureArray, isListeningFor, isPendingRequest } from './behavioral.frontier.ts'
import type {
  BSyncReplaySafe,
  CandidateBid,
  Frontier,
  PendingBid,
  ReplayEvent,
  RunningBid,
} from './behavioral.types.ts'

/**
 * @internal
 * Replay-safe thread factories keyed by stable thread labels.
 */
type ReplayThreadFactories = Record<string, ReturnType<BSyncReplaySafe>>

/**
 * @internal
 * Reconstructed replay result for downstream explorer slices.
 */
type ReplayToFrontierResult = {
  pending: Map<string | symbol, PendingBid>
  frontier: Frontier
}

/**
 * @internal
 * Advances all currently running threads to their next yielded sync declaration.
 * Mirrors the runtime `step()` transition from running -> pending.
 */
const advanceRunningToPending = ({
  pending,
  running,
}: {
  pending: Map<string | symbol, PendingBid>
  running: Map<string | symbol, RunningBid>
}) => {
  for (const [thread, bid] of running) {
    const { generator, priority, source, label } = bid
    const { value, done } = generator.next()
    if (!done) {
      pending.set(thread, {
        priority,
        source,
        ...(label && { label }),
        generator,
        ...value,
      })
    }
    running.delete(thread)
  }
}

/**
 * @internal
 * Reconstructs pending state and frontier from replay-safe thread factories and selected-event history.
 *
 * Replay semantics intentionally mirror current runtime execution:
 * - instantiate fresh generators
 * - advance each generator once to first sync
 * - for each selected event, resume only affected pending threads with plain `.next()`
 * - recompute frontier from reconstructed pending after history is exhausted
 */
export const replayToFrontier = ({
  history,
  threads,
}: {
  threads: ReplayThreadFactories
  history: ReplayEvent[]
}): ReplayToFrontierResult => {
  const pending = new Map<string | symbol, PendingBid>()

  const bootstrapRunning = new Map<string | symbol, RunningBid>()
  let priority = 1
  for (const thread in threads) {
    bootstrapRunning.set(thread, {
      priority,
      source: 'request',
      generator: threads[thread]!(),
    })
    priority++
  }
  advanceRunningToPending({ pending, running: bootstrapRunning })

  for (const event of history) {
    const selectedEvent: CandidateBid = {
      priority: 0,
      thread: Symbol(event.type),
      source: event.source ?? 'request',
      type: event.type,
      detail: event.detail,
    }
    const running = new Map<string | symbol, RunningBid>()

    for (const [thread, bid] of pending) {
      const { waitFor, request, generator, interrupt } = bid
      const isInterrupted = ensureArray(interrupt).some(isListeningFor(selectedEvent))
      const isWaitedFor = ensureArray(waitFor).some(isListeningFor(selectedEvent))
      const hasPendingRequest = Boolean(request && isPendingRequest(selectedEvent, request))

      if (isInterrupted) {
        generator.return?.()
      }
      if (hasPendingRequest || isInterrupted || isWaitedFor) {
        running.set(thread, bid)
        pending.delete(thread)
      }
    }

    advanceRunningToPending({ pending, running })
  }

  return {
    pending,
    frontier: computeFrontier({ pending }),
  }
}
