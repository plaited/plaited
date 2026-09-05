import type { JSONSchemaType } from 'ajv'
import Ajv2020 from 'ajv/dist/2020'
import { DETAIL_MATCH, type FRONTIER_STATUS, IDIOMS, type TRACE_MESSAGE_KINDS } from './behavioral.constants.ts'

/**
 * Shared Ajv instance for the behavioral kernel.
 *
 * Uses draft 2020-12 (the current JSON Schema standard) so thread authors and
 * model-generated threads author `detailSchema` as plain JSON Schema documents.
 * `strict: false` because author-provided schemas may include unknown keywords
 * or custom extensions; `validateSchema` makes Ajv reject structurally-broken
 * schemas at compile time (surfaced as `add_thread_error` by `useAddThread`).
 */
export const ajv = new Ajv2020({ strict: false, validateSchema: true })

/**
 * A JSON object value — kernel detail payloads are JSON values.
 * Plain structural type: Ajv validates payloads against per-listener schemas,
 * so no recursive validator is needed for the type itself.
 */
export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }

// ---------------------------------------------------------------------------
// Validating JSON Schema documents (registration-time)
// ---------------------------------------------------------------------------

/**
 * Draft 2020-12 meta-schema reference — validates that a `detailSchema` is
 * itself a structurally sound JSON Schema document (correct `type` keyword
 * values, object-shaped `properties`, etc.).
 */
const _META_SCHEMA_REF = { $ref: 'https://json-schema.org/draft/2020-12/schema' }

/**
 * Keywords whose presence distinguishes a real JSON Schema document from an
 * arbitrary object (a common mistake is passing a detail object where a
 * schema is expected). Meta-schema validation alone accepts such objects —
 * extra properties are allowed — so keyword presence is the belt-and-suspenders
 * check that the author intended a schema.
 */
const JSON_SCHEMA_KEYWORDS = new Set([
  'type',
  '$ref',
  '$schema',
  'enum',
  'const',
  'properties',
  'required',
  'items',
  'allOf',
  'anyOf',
  'oneOf',
  'not',
])

const isJsonSchemaDocument = (value: unknown): boolean => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.keys(value).some((key) => JSON_SCHEMA_KEYWORDS.has(key))
}

/**
 * Validates that a listener's `detailSchema` is a JSON Schema document:
 * keyword presence plus meta-schema conformance. Used at registration time;
 * failures surface as `add_thread_error` traces.
 */
export const validateDetailSchema = (schema: JsonObject): boolean => {
  if (!isJsonSchemaDocument(schema)) return false
  const valid = ajv.validateSchema(schema as object)
  return valid === true
}

// ---------------------------------------------------------------------------
// Core event shape
// ---------------------------------------------------------------------------

/**
 * An event that threads request, wait for, block, or transform.
 *
 * @property type - Event identifier; listeners match on this.
 * @property detail - JSON payload carried by the event.
 * @property space - Optional scope stamp; listeners only match events in the same space.
 *
 * @public
 */
export type BPEvent = {
  type: string
  detail?: JsonObject
  space?: string
}

export const BPEventSchema: JSONSchemaType<BPEvent> = {
  type: 'object',
  properties: {
    type: { type: 'string' },
    detail: { type: 'object', required: [], additionalProperties: true, nullable: true },
    space: { type: 'string', nullable: true },
  },
  required: ['type'],
  additionalProperties: false,
}

/** @internal */
export const validateBPEvent = ajv.compile(BPEventSchema)

/**
 * A listener declaration inside a thread rule.
 *
 * @property type - Event type to match.
 * @property detailSchema - Optional JSON Schema the event's `detail` must conform to.
 * @property detailMatch - `'valid'` matches conforming details; `'invalid'` matches non-conforming ones.
 *
 * @public
 */
export type BPListener = {
  type: string
  detailSchema?: JsonObject
  detailMatch?: (typeof DETAIL_MATCH)[keyof typeof DETAIL_MATCH]
}

export const BPListenerSchema: JSONSchemaType<BPListener> = {
  type: 'object',
  properties: {
    type: { type: 'string' },
    detailSchema: { type: 'object', required: [], nullable: true },
    detailMatch: { type: 'string', enum: Object.values(DETAIL_MATCH), nullable: true },
  },
  required: ['type'],
  additionalProperties: false,
}

/** @internal */
export const validateBPListener = ajv.compile(BPListenerSchema)

/**
 * A transform listener — a {@link BPListener} plus the declarative reshaping
 * contract executed by external code (the daemon): `query` (e.g. a jq
 * expression) is applied to the matched event's `detail`, and the result is
 * emitted as a `target` event.
 *
 * @public
 */
export type TransformListener = BPListener & {
  query: string
  target: string
}

export const TransformListenerSchema: JSONSchemaType<TransformListener> = {
  type: 'object',
  properties: {
    type: { type: 'string' },
    detailSchema: { type: 'object', required: [], nullable: true },
    detailMatch: { type: 'string', enum: Object.values(DETAIL_MATCH), nullable: true },
    query: { type: 'string' },
    target: { type: 'string' },
  },
  required: ['type', 'query', 'target'],
  additionalProperties: false,
}

/** @internal */
export const validateTransformListener = ajv.compile(TransformListenerSchema)

/**
 * Registered listener — a {@link BPListener} stamped with its thread's `space`
 * at registration time in {@link generateRulesFunctions}.
 *
 * @public
 */
export type RegisteredBPListener = BPListener & {
  space?: string
}

/**
 * Registered transform listener — a {@link TransformListener} with space
 * stamping, post-registration.
 *
 * @public
 */
export type RegisteredTransformListener = TransformListener & {
  space?: string
}

/**
 * Represents a synchronization statement yielded by a behavioral rule step.
 * This is the core mechanism through which b-threads communicate their behavioral intentions
 * to the behavioral program scheduler at each step of execution.
 *
 * @property request - Propose an event to be selected and triggered. Only one request per sync point.
 * @property waitFor - Wait for specific events. Thread pauses until a matching event is selected.
 * @property block - Prevent specific events from being selected. Higher precedence than requests.
 * @property interrupt - Events that terminate the thread's execution if selected.
 * @property transform - Events to match, hand off to external reshaping, and re-enter via `target`.
 *
 * @remarks
 * - Multiple listeners can be provided as arrays
 * - Blocked events have precedence over requested events
 * - Interrupts cause thread termination
 *
 * @see {@link ThreadSchema} for the tuple that embeds idiom rules
 * @see {@link UseAddThread} for registering a thread from `Idioms[]` rules
 */
export type Idioms = {
  [IDIOMS.waitFor]?: BPListener[]
  [IDIOMS.interrupt]?: BPListener[]
  [IDIOMS.block]?: BPListener[]
  [IDIOMS.request]?: BPEvent
  [IDIOMS.transform]?: TransformListener[]
}

export const IdiomSchema: JSONSchemaType<Idioms> = {
  type: 'object',
  properties: {
    [IDIOMS.waitFor]: { type: 'array', items: BPListenerSchema, nullable: true },
    [IDIOMS.interrupt]: { type: 'array', items: BPListenerSchema, nullable: true },
    [IDIOMS.block]: { type: 'array', items: BPListenerSchema, nullable: true },
    [IDIOMS.request]: { ...BPEventSchema, nullable: true },
    [IDIOMS.transform]: { type: 'array', items: TransformListenerSchema, nullable: true },
  },
  additionalProperties: false,
}

/** @internal */
export const validateIdioms = ajv.compile(IdiomSchema)

/**
 * Registered idioms — the internal, post-registration representation.
 *
 * @remarks
 * `detailSchema` stays a plain JSON object (it *is* JSON Schema), so registered
 * listeners serialize without conversion — traces and the frontier visited-set
 * key stay JSON-only by construction.
 */
export type RegisteredIdioms = {
  [IDIOMS.waitFor]?: RegisteredBPListener[]
  [IDIOMS.interrupt]?: RegisteredBPListener[]
  [IDIOMS.block]?: RegisteredBPListener[]
  [IDIOMS.request]?: BPEvent
  [IDIOMS.transform]?: RegisteredTransformListener[]
}

/**
 * A b-thread registration tuple.
 *
 * @property label - Unique-ish human label; appears in trace messages.
 * @property rules - The thread's synchronization statements, executed in order.
 * @property once - When `true`, the thread runs its rules once and completes.
 *
 * @public
 */
export type Thread = {
  label: string
  once?: true
  rules: Idioms[]
}

export const ThreadSchema: JSONSchemaType<Thread> = {
  type: 'object',
  properties: {
    label: { type: 'string', minLength: 1 },
    once: { type: 'boolean', enum: [true], nullable: true },
    rules: { type: 'array', items: IdiomSchema },
  },
  required: ['label', 'rules'],
  additionalProperties: false,
}

/** @internal */
export const validateThread = ajv.compile(ThreadSchema)

export type Threads = Thread[]

export type TraceEvent = BPEvent & {
  ingress?: true
}

export type TraceCandidate = {
  type: string
  detail?: JsonObject
  ingress?: true
  space?: string
  priority: number
}

/**
 * Structural contract for consumer-supplied trace extensions.
 *
 * @remarks
 * `Trace` variants happen to satisfy this shape (each spreads it), but consumers
 * should treat this as the contract their *extension* kinds must match when
 * parameterizing {@link behavioral} with a custom trace type — namely
 * `{ kind: string; timestamp: number }` plus kind-specific fields. Extension
 * kinds should use literal `kind` strings distinct from the engine's
 * `TRACE_MESSAGE_KINDS` so narrowing by `kind` remains unambiguous in the
 * unified `Trace | T` stream.
 *
 * @see {@link Trace} for the engine's closed trace union
 */
export type TraceBase = {
  kind: string
  timestamp: number
  instanceId: string
}

// ---------------------------------------------------------------------------
// Trace kinds
// ---------------------------------------------------------------------------

export type FrontierTrace = TraceBase & {
  kind: typeof TRACE_MESSAGE_KINDS.frontier
  step: number
  status: (typeof FRONTIER_STATUS)[keyof typeof FRONTIER_STATUS]
  candidates: TraceCandidate[]
  enabled: TraceCandidate[]
}

export type SelectionTrace = TraceBase & {
  kind: typeof TRACE_MESSAGE_KINDS.selection
  step: number
  selected: TraceEvent
}

export type DeadlockTrace = TraceBase & {
  kind: typeof TRACE_MESSAGE_KINDS.deadlock
  step: number
}

/**
 * Emitted when `useAddThread` receives arguments that fail `ThreadSchema`
 * validation or contain an un-compilable `detailSchema`.
 *
 * @property error - Ajv error objects (`ErrorObject[]`) describing the failure,
 * narrowed via `Array.isArray`.
 *
 * @public
 */
export type AddThreadError = TraceBase & {
  kind: typeof TRACE_MESSAGE_KINDS.add_thread_error
  error: unknown[]
  space?: string
}

export type SerializedThread = {
  label: string
  priority: number
  ingress?: true
  space?: string
  request?: Pick<BPEvent, 'type' | 'detail'>
  waitFor?: SerializedBPListener[]
  block?: SerializedBPListener[]
  interrupt?: SerializedBPListener[]
  transform?: SerializedTransformListener[]
}

/**
 * Listener shape as it appears in trace messages. With raw-JSON-Schema
 * `detailSchema`, registered listeners serialize without conversion — this is
 * structurally the same shape as {@link RegisteredBPListener}.
 */
export type SerializedBPListener = RegisteredBPListener

export type SerializedTransformListener = RegisteredTransformListener

export type PendingBidsTrace = TraceBase & {
  kind: typeof TRACE_MESSAGE_KINDS.pending_bids
  step: number
  threads: SerializedThread[]
}

export type TriggerError = TraceBase & {
  kind: typeof TRACE_MESSAGE_KINDS.trigger_error
  error: unknown[]
  space?: string
}

export type InterruptTrace = TraceBase & {
  kind: typeof TRACE_MESSAGE_KINDS.interrupt
  selected: TraceEvent
  threadLabel: string
  step: number
}

export type TransformTrace = TraceBase & {
  kind: typeof TRACE_MESSAGE_KINDS.transform
  selected: TraceEvent
  threadLabel: string
  step: number
  transform: SerializedTransformListener[]
}

/**
 * Discriminated union of all observable moments from the BP engine.
 * Consumers narrow by the `kind` field.
 *
 * @remarks
 * Hand-written (not derived from a validator) — Ajv has no discriminated-union
 * inference; the union is the type-level contract while the per-kind schemas
 * are the runtime contract.
 *
 * @see {@link SelectionTrace} for event selection observations
 * @see {@link DeadlockTrace} for blocked-candidate deadlock observations
 *
 * @public
 */
export type Trace =
  | TriggerError
  | FrontierTrace
  | DeadlockTrace
  | SelectionTrace
  | AddThreadError
  | PendingBidsTrace
  | InterruptTrace
  | TransformTrace

// ---------------------------------------------------------------------------
// Zod bridge for zod-composed consumers (message.schemas.ts)
// ---------------------------------------------------------------------------

import * as z from 'zod'

/**
 * Zod twin of {@link BPEventSchema} for consumers that compose schemas with
 * zod (e.g. message.schemas.ts). Runtime validation is delegated to the Ajv
 * compiled validator so the two stay behaviorally identical; the zod wrapper
 * only adapts the shape.
 */
export const BPEventZodSchema = z
  .object({ type: z.string(), detail: z.record(z.string(), z.unknown()).optional(), space: z.string().optional() })
  .loose()
  .superRefine((value, ctx) => {
    if (!validateBPEvent(value)) {
      for (const issue of validateBPEvent.errors ?? []) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [], message: `${issue.instancePath}: ${issue.message}` })
      }
    }
  })
