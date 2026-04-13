import { isTypeOf } from '../utils.ts'
import { FRONTIER_STATUS } from './behavioral.constants.ts'
import type {
  BPEvent,
  BPListener,
  BSync,
  BThread,
  CandidateBid,
  Frontier,
  PendingBid,
  RunningBid,
} from './behavioral.types.ts'

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
export const isListeningFor = ({ type, detail, source }: CandidateBid) => {
  return (listener: BPListener): boolean => {
    const sourceMatches = listener.sourceSchema ? listener.sourceSchema.safeParse(source).success : true
    return listener.type === type && sourceMatches && listener.detailSchema.safeParse(detail).success
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

export const bSync: BSync = (syncPoint) =>
  function* () {
    yield syncPoint
  }

export const isBehavioralRule = (value: unknown): value is ReturnType<BSync> =>
  isTypeOf<(...args: unknown[]) => unknown>(value, 'function')

export const bThread: BThread = (rules, repeat) => {
  const shouldRepeat = repeat === true
  return Object.assign(
    shouldRepeat
      ? function* () {
          while (shouldRepeat) {
            const length = rules.length
            for (let i = 0; i < length; i++) {
              yield* rules[i]!()
            }
          }
        }
      : function* () {
          const length = rules.length
          for (let i = 0; i < length; i++) {
            yield* rules[i]!()
          }
        },
  )
}
