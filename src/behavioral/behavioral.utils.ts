import { isTypeOf } from '../utils.ts'
import { FRONTIER_STATUS } from './behavioral.constants.ts'
import type { BPEvent, BPListener } from './behavioral.schemas.ts'
import type { CandidateBid, Frontier, PendingBid, RunningBid, Sync, Thread } from './behavioral.types.ts'
import { deepEqual } from './deep-equal.ts'

/**
 * @internal
 * Type guard to check if an unknown value conforms to the `BPEvent` structure.
 */
export const isBPEvent = (data: unknown): data is BPEvent => {
  return (
    isTypeOf<{ [key: string]: unknown }>(data, 'object') &&
    Object.hasOwn(data, 'type') &&
    isTypeOf<string>(data.type, 'string')
  )
}

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
    const schemaMatches = listener.detailSchema ? listener.detailSchema.safeParse(detail).success : true
    const detailMatches = listener.detailMatch === 'invalid' ? !schemaMatches : schemaMatches
    return listener.type === type && detailMatches
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
export const computeFrontier = ({ pending }: { pending: Set<PendingBid> }): Frontier => {
  const blocked: BPListener[] = []
  const candidates: CandidateBid[] = []

  for (const { request, priority, block, ingress } of pending) {
    block && blocked.push(...ensureArray(block))
    request &&
      candidates.push({
        priority,
        ingress,
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

export const advanceRunningToPending = (running: Set<RunningBid>, pending: Set<PendingBid>) => {
  for (const bid of running) {
    const { generator, priority, label, ingress } = bid
    const { value, done } = generator.next()
    !done &&
      pending.add({
        priority,
        ingress,
        label,
        generator,
        ...value,
      })
    running.delete(bid)
  }
}

const eventMatchesCandidate = (request: BPEvent, selectedEvent: CandidateBid) => {
  return request.type === selectedEvent.type && deepEqual(request.detail, selectedEvent.detail)
}

export const resumePendingThreadsForSelectedEvent = ({
  running,
  pending,
  selectedEvent,
}: {
  running: Set<RunningBid>
  pending: Set<PendingBid>
  selectedEvent: CandidateBid
}) => {
  for (const bid of pending) {
    const { waitFor, request, generator, interrupt } = bid
    const isInterrupted = ensureArray(interrupt).some(isListeningFor(selectedEvent))
    const isWaitedFor = ensureArray(waitFor).some(isListeningFor(selectedEvent))
    const hasPendingRequest = request && eventMatchesCandidate(request, selectedEvent)
    if (isInterrupted) {
      generator.return?.()
      pending.delete(bid)
      continue
    }
    if (hasPendingRequest || isWaitedFor) {
      running.add({ ...bid })
      pending.delete(bid)
    }
  }
}

export const sync: Sync = (syncPoint) =>
  function* () {
    yield syncPoint
  }

export const isBehavioralRule = (value: unknown): value is ReturnType<Sync> =>
  isTypeOf<(...args: unknown[]) => unknown>(value, 'function')

export const thread: Thread = (rules, once) =>
  Object.assign(
    once
      ? function* () {
          const length = rules.length
          for (let i = 0; i < length; i++) {
            yield* rules[i]!()
          }
        }
      : function* () {
          while (true) {
            const length = rules.length
            for (let i = 0; i < length; i++) {
              yield* rules[i]!()
            }
          }
        },
  )
