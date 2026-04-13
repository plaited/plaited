import * as z from 'zod'
import { FRONTIER_STATUS } from './behavioral.constants.ts'
import type { BPListener, CandidateBid, Frontier, PendingBid, RunningBid } from './behavioral.types.ts'

/**
 * @internal
 * Utility function to ensure a value is an array.
 */
export const ensureArray = <T>(obj: T | T[] = []) => (Array.isArray(obj) ? obj : [obj])

/**
 * @internal
 * Creates a checker function to determine if a given BPListener matches a CandidateBid.
 */
export const isListeningFor = ({ type, detail }: CandidateBid) => {
  return (listener: BPListener): boolean => {
    return listener.type === type && listener.detailSchema.safeParse(detail).success
  }
}

/**
 * @internal
 * Computes the execution frontier from pending bids.
 *
 * The frontier captures:
 * - all requested candidates
 * - the subset enabled after applying block listeners
 * - a scheduler-facing status classification
 */
export const computeFrontier = ({ pending }: { pending: Map<string, PendingBid> }): Frontier => {
  const blocked: BPListener[] = []
  const candidates: CandidateBid[] = []

  for (const [thread, { request, priority, block, source }] of pending) {
    block && blocked.push(...ensureArray(block))
    request &&
      candidates.push({
        priority,
        source,
        thread,
        ...request,
      })
  }

  const enabled: CandidateBid[] = []
  const length = candidates.length
  for (let i = 0; i < length; i++) {
    const candidate = candidates[i]!
    if (!blocked.some(isListeningFor(candidate))) {
      enabled.push(candidate)
    }
  }

  if (enabled.length > 0) {
    return { candidates, enabled, status: FRONTIER_STATUS.ready }
  }
  if (candidates.length > 0) {
    return { candidates, enabled, status: FRONTIER_STATUS.deadlock }
  }
  return { candidates, enabled, status: FRONTIER_STATUS.idle }
}

export const advanceRunningToPending = (running: Map<string, RunningBid>, pending: Map<string, PendingBid>) => {
  for (const [thread, bid] of running) {
    const { generator, priority, source, label, ingress } = bid
    const { value, done } = generator.next()
    !done &&
      pending.set(thread, {
        priority,
        source,
        ingress,
        label,
        generator,
        ...value,
      })
    running.delete(thread)
  }
}

export const resumePendingThreadsForSelectedEvent = ({
  running,
  pending,
  selectedEvent,
}: {
  running: Map<string, RunningBid>
  pending: Map<string, PendingBid>
  selectedEvent: CandidateBid
}) => {
  for (const [thread, bid] of pending) {
    const { waitFor, request, generator, interrupt, ingress } = bid
    const isInterrupted = ensureArray(interrupt).some(isListeningFor(selectedEvent))
    const isWaitedFor = ensureArray(waitFor).some(isListeningFor(selectedEvent))
    const hasPendingRequest = Boolean(request) && thread === selectedEvent.thread
    isInterrupted && generator.return?.()
    if (hasPendingRequest || isInterrupted || isWaitedFor || ingress) {
      running.set(thread, bid)
      pending.delete(thread)
    }
  }
}

export const notSchema = (schema: z.ZodTypeAny): z.ZodType<unknown> =>
  z.unknown().refine((value) => !schema.safeParse(value).success)
