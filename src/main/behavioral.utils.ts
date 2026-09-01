import Ajv2020 from 'ajv/dist/2020'
import { isTypeOf } from '../utils.ts'
import { FRONTIER_STATUS, IDIOMS } from './behavioral.constants.ts'
import type { BPEvent, Idioms, JsonObject, RegisteredBPListener, RegisteredIdioms } from './behavioral.schemas.ts'
import type { CandidateBid, Frontier, PendingBid, RulesFunction, RunningBid, UseThread } from './behavioral.types.ts'

/**
 * Shared Ajv instance for compiling JSON Schema validators.
 * Uses draft 2020-12 (current JSON Schema standard), backwards-compatible with
 * the draft-07-common subset used by detailSchema, for parity with a Rust
 * jsonschema consumer. detailSchema is always a JSON object schema over
 * BPEvent.detail; non-JSON values never reach this validator. Strict mode is disabled because author-provided JSON Schema may
 * include unknown keywords or custom extensions.
 */
const ajv = new Ajv2020({ strict: false })

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
 * Compiles a JSON Schema object into an Ajv validator function.
 * Returns a function that returns `true` when the value conforms to the schema.
 * Throws if the schema is un-compilable — caller is responsible for
 * handling the error and surfacing it as a trace.
 */
export const compileValidator = (schema: JsonObject): ((detail: unknown) => boolean) => {
  const validate = ajv.compile(schema)
  return (detail: unknown) => {
    if (!isTypeOf<Record<string, unknown>>(detail, 'object') && detail !== undefined) {
      return false
    }
    return validate(detail) as boolean
  }
}

/**
 * @internal
 * Creates a checker function to determine if a given BPListener matches a CandidateBid.
 */
export const isListeningFor = ({ type, detail, topic }: CandidateBid) => {
  return (listener: RegisteredBPListener): boolean => {
    const topicMatches = listener.topic ? topic === listener.topic : true
    const schemaMatches = listener.detailSchema ? listener.validate(detail) : true
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
}: {
  running: Set<RunningBid>
  pending: Set<PendingBid>
  selectedEvent: CandidateBid
}) => {
  for (const bid of pending) {
    const { waitFor, request, generator, interrupt } = bid
    const isInterrupted = interrupt?.some(isListeningFor(selectedEvent))
    const isWaitedFor = waitFor?.some(isListeningFor(selectedEvent))
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

const compileValidators = <T extends { detailSchema?: JsonObject }>(
  listeners: T[],
): (T & { validate: (detail: unknown) => boolean })[] =>
  listeners.map((listener) => ({
    ...listener,
    validate: listener.detailSchema ? compileValidator(listener.detailSchema) : () => true,
  }))

export const generateRulesFunctions = (rules: Idioms[], topic?: string): RulesFunction[] => {
  const syncs: RulesFunction[] = []
  for (const { request, waitFor, block, interrupt } of rules) {
    const registeredIdioms: RegisteredIdioms = {}
    if (request) {
      registeredIdioms[IDIOMS.request] = {
        type: request.type,
        topic,
        detail: request.detail,
      }
    }
    if (block) {
      registeredIdioms[IDIOMS.block] = compileValidators(
        block.map((listener) => ({
          ...listener,
          topic,
        })),
      )
    }
    if (waitFor) {
      registeredIdioms[IDIOMS.waitFor] = compileValidators(
        waitFor.map((listener) => ({
          ...listener,
          topic,
        })),
      )
    }
    if (interrupt) {
      registeredIdioms[IDIOMS.interrupt] = compileValidators(
        interrupt.map((listener) => ({
          ...listener,
          topic,
        })),
      )
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
