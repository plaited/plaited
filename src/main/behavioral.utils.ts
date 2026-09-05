import * as z from 'zod'
import { isTypeOf } from '../utils.ts'
import { FRONTIER_STATUS, IDIOMS, TRACE_MESSAGE_KINDS } from './behavioral.constants.ts'
import type {
  BPEvent,
  Idioms,
  RegisteredBPListener,
  RegisteredIdioms,
  RegisteredTransformListener,
} from './behavioral.schemas.ts'
import type {
  CandidateBid,
  Frontier,
  PendingBid,
  RulesFunction,
  RunningBid,
  SendTrace,
  UseThread,
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
 * Creates a checker function to determine if a given BPListener matches a CandidateBid.
 */
export const isListeningFor = ({ type, detail, topic }: CandidateBid) => {
  return (listener: RegisteredBPListener | RegisteredTransformListener): boolean => {
    const topicMatches = listener.topic ? topic === listener.topic : true
    const schemaMatches = listener.detailSchema ? listener.detailSchema.safeParse(detail).success : true
    const detailMatches = listener.detailMatch === 'invalid' ? !schemaMatches : schemaMatches
    return listener.type === type && topicMatches && detailMatches
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
  const blocked: RegisteredBPListener[] = []
  const candidates: CandidateBid[] = []

  for (const { request, priority, block, ingress, topic } of pending) {
    block && blocked.push(...block)
    request &&
      candidates.push({
        priority,
        ingress,
        topic,
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
    const { generator, priority, label, ingress, topic } = bid
    const { value, done } = generator.next()
    !done &&
      pending.add({
        priority,
        ingress,
        label,
        generator,
        topic,
        ...value,
      })
    running.delete(bid)
  }
}

const eventMatchesCandidate = (request: BPEvent, selectedEvent: CandidateBid) => {
  if (selectedEvent.type !== request.type) return false
  if (selectedEvent.topic && selectedEvent.topic !== request.topic) return false
  return Bun.deepEquals(request.detail, selectedEvent.detail)
}

export const resumePendingThreadsForSelectedEvent = ({
  running,
  pending,
  selectedEvent,
  sendTrace,
  instanceId,
  step,
}: {
  running: Set<RunningBid>
  pending: Set<PendingBid>
  selectedEvent: CandidateBid
  sendTrace?: SendTrace
  instanceId: string
  step: number
}) => {
  for (const bid of pending) {
    const { waitFor, request, generator, interrupt, transform, label } = bid
    const isInterrupted = interrupt?.some(isListeningFor(selectedEvent))
    const isWaitedFor = waitFor?.some(isListeningFor(selectedEvent))
    const isTransform = transform?.filter(isListeningFor(selectedEvent))
    const hasPendingRequest = request && eventMatchesCandidate(request, selectedEvent)
    if (isInterrupted) {
      generator.return?.()
      pending.delete(bid)
      sendTrace?.({
        kind: TRACE_MESSAGE_KINDS.interrupt,
        timestamp: Date.now(),
        step,
        instanceId,
        selected: selectedEvent,
        threadLabel: label,
      })
      continue
    }
    if (hasPendingRequest || isWaitedFor || isTransform?.length) {
      running.add({ ...bid })
      pending.delete(bid)
    }
    if (isTransform?.length) {
      sendTrace?.({
        kind: TRACE_MESSAGE_KINDS.transform,
        timestamp: Date.now(),
        step,
        instanceId,
        // Zod schema → JSON Schema at the trace boundary; traces stay JSON-only.
        transform: isTransform.map(({ detailSchema, ...rest }) => ({
          ...rest,
          ...(detailSchema && { detailSchema: z.toJSONSchema(detailSchema) }),
        })),
        selected: selectedEvent,
        threadLabel: label,
      })
    }
  }
}

export const generateRulesFunctions = (rules: Idioms[], topic?: string): RulesFunction[] => {
  // Fail fast on unrepresentable detailSchemas: z.toJSONSchema throws here, so
  // useAddThread's try/catch surfaces it as add_thread_error — never at trace
  // time inside the engine loop.
  for (const { waitFor, block, interrupt, transform } of rules) {
    for (const listener of [...(waitFor ?? []), ...(block ?? []), ...(interrupt ?? []), ...(transform ?? [])]) {
      if (listener.detailSchema) z.toJSONSchema(listener.detailSchema)
    }
  }
  const syncs: RulesFunction[] = []
  for (const { request, waitFor, block, interrupt, transform } of rules) {
    const registeredIdioms: RegisteredIdioms = {}
    if (request) {
      registeredIdioms[IDIOMS.request] = {
        type: request.type,
        topic,
        detail: request.detail,
      }
    }
    if (block) {
      registeredIdioms[IDIOMS.block] = block.map((listener) => ({
        ...listener,
        topic,
      }))
    }
    if (waitFor) {
      registeredIdioms[IDIOMS.waitFor] = waitFor.map((listener) => ({
        ...listener,
        topic,
      }))
    }
    if (interrupt) {
      registeredIdioms[IDIOMS.interrupt] = interrupt.map((listener) => ({
        ...listener,
        topic,
      }))
    }
    if (transform) {
      registeredIdioms[IDIOMS.transform] = transform.map((listener) => ({
        ...listener,
        topic,
      }))
    }
    syncs.push(function* () {
      yield registeredIdioms
    })
  }
  return syncs
}

/**
 * Composes an ordered array of rule generators into a single behavioral thread generator.
 *
 * @param rules - Rule generators (each yielding one `RegisteredIdioms`) to compose.
 * @param once - When `true`, the thread runs through the rules once and completes.
 *               When omitted, the thread loops the rules indefinitely.
 * @returns A generator function yielding the idioms from each rule in sequence.
 *
 * @remarks
 * - The `once` flag controls repetition semantics for the behavioral scheduler.
 * - Empty rule arrays complete immediately (the generator is `done` on first call).
 *
 * @see {@link generateRulesFunctions} for building the rule array from author-facing `Idioms`.
 */
export const useThread: UseThread = (rules: RulesFunction[], once?: true) =>
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
      }
