import { deepEqual, isTypeOf } from '../utils.ts'
import { FRONTIER_STATUS, THREAD_IDENTIFIER } from './behavioral.constants.ts'
import type { BPEvent, BPListener } from './behavioral.schemas.ts'
import type { CandidateBid, Frontier, PendingBid, RunningBid, Sync, Thread } from './behavioral.types.ts'

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
export const isListeningFor = ({ type, detail, page }: CandidateBid) => {
  return (listener: BPListener): boolean => {
    const pageMatches = listener.page ? page === listener.page : true
    const schemaMatches = listener.detailSchema ? listener.detailSchema.safeParse(detail).success : true
    const detailMatches = listener.detailMatch === 'invalid' ? !schemaMatches : schemaMatches
    return listener.type === type && pageMatches && detailMatches
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

  for (const { request, priority, block, ingress, page } of pending) {
    block && blocked.push(...ensureArray(block))
    request &&
      candidates.push({
        priority,
        ingress,
        page,
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
    const { generator, priority, label, ingress, page } = bid
    const { value, done } = generator.next()
    !done &&
      pending.add({
        priority,
        ingress,
        label,
        generator,
        page,
        ...value,
      })
    running.delete(bid)
  }
}

const eventMatchesCandidate = (request: BPEvent, selectedEvent: CandidateBid) => {
  if (selectedEvent.type !== request.type) return false
  if (selectedEvent.page && selectedEvent.page !== request.page) return false
  return deepEqual(request.detail, selectedEvent.detail)
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

/**
 * Composes multiple synchronization rules into a single behavioral thread generator.
 *
 * The returned generator function is branded with `{ $: THREAD_IDENTIFIER }` via
 * `Object.assign`, enabling runtime discrimination between plain rule generators
 * and composed thread generators using {@link isThread}.
 *
 * @param rules - Array of rule generators (typically created with {@link sync}) to compose.
 * @param once - When `true`, the thread runs through the rules once and completes.
 *               When omitted, the thread loops the rules indefinitely.
 * @returns A branded generator function that yields the idioms from each rule in sequence.
 *
 * @remarks
 * - The `once` flag controls repetition semantics for the behavioral scheduler.
 * - Empty rule arrays complete immediately (the generator is `done` on first call).
 * - The brand property `$` is non-enumerable and does not affect iteration behavior.
 *
 * @see {@link sync} for creating individual synchronization rules
 * @see {@link isThread} for the runtime type guard
 * @see {@link THREAD_IDENTIFIER} for the brand constant
 */
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
    { $: THREAD_IDENTIFIER },
  )

/**
 * Runtime type guard that distinguishes behavioral thread generators from plain rule generators.
 *
 * Checks that the value is a function bearing the `{ $: THREAD_IDENTIFIER }` brand
 * attached by the {@link thread} function.
 *
 * @param value - Value to test.
 * @returns `true` if the value is a branded thread generator function.
 *
 * @remarks
 * - Plain generators created directly with {@link sync} will NOT match.
 * - Only generators created through the {@link thread} compose function carry the brand.
 *
 * @see {@link thread} for the function that produces branded generators
 * @see {@link THREAD_IDENTIFIER} for the brand constant
 *
 * @internal
 */
export const isThread = (value: unknown): value is ReturnType<Thread> =>
  isTypeOf<(...args: unknown[]) => unknown>(value, 'generatorfunction') && '$' in value && value.$ === THREAD_IDENTIFIER
