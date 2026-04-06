import { isTypeOf } from '../utils.ts'
import type {
  BPEvent,
  BPEventTemplate,
  BPListener,
  CandidateBid,
  EventSource,
  Frontier,
  PendingBid,
} from './behavioral.types.ts'
import { isBPMatchListener } from './behavioral.utils.ts'

/**
 * @internal
 * Utility function to ensure a value is an array.
 */
export const ensureArray = <T>(obj: T | T[] = []) => (Array.isArray(obj) ? obj : [obj])

/**
 * @internal
 * Creates a checker function to determine if a given BPListener matches a CandidateBid.
 */
export const isListeningFor = ({ type, detail, trigger }: CandidateBid) => {
  return (listener: BPListener): boolean => {
    if (isTypeOf<string>(listener, 'string')) {
      return listener === type
    }
    if (isBPMatchListener(listener)) {
      const source: EventSource = trigger === true ? 'trigger' : 'request'
      return (
        listener.type === type &&
        listener.sourceSchema.safeParse(source).success &&
        listener.detailSchema.safeParse(detail).success
      )
    }
    return listener({
      detail,
      type,
    })
  }
}

/**
 * @internal
 * Checks if a pending request (Idiom['request']) matches the selected event candidate.
 */
export const isPendingRequest = (selectedEvent: CandidateBid, event: BPEvent | BPEventTemplate) =>
  isTypeOf<BPEventTemplate>(event, 'function') ? event === selectedEvent?.template : event.type === selectedEvent.type

/**
 * @internal
 * Computes the execution frontier from pending bids.
 *
 * The frontier captures:
 * - all requested candidates
 * - the subset enabled after applying block listeners
 * - a scheduler-facing status classification
 */
export const computeFrontier = ({ pending }: { pending: Map<string | symbol, PendingBid> }): Frontier => {
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

  const enabled: CandidateBid[] = []
  const length = candidates.length
  for (let i = 0; i < length; i++) {
    const candidate = candidates[i]!
    if (!blocked.some(isListeningFor(candidate))) {
      enabled.push(candidate)
    }
  }

  if (enabled.length > 0) {
    return { candidates, enabled, status: 'ready' }
  }
  if (candidates.length > 0) {
    return { candidates, enabled, status: 'deadlock' }
  }
  return { candidates, enabled, status: 'idle' }
}
