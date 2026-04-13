import { keyMirror } from '../utils.ts'

/**
 * Discriminant values for the `SnapshotMessage` union.
 *
 * @remarks
 * Use the `kind` field to narrow the union:
 * - `'deadlock'` — no unblocked candidate could be selected
 * - `'selection'` — event selection snapshot
 * - `'feedback_error'` — handler threw during side-effect execution
 * - `'module_warning'` — host/runtime module diagnostic
 *
 * @public
 */
export const SNAPSHOT_MESSAGE_KINDS = keyMirror('deadlock', 'feedback_error', 'selection', 'extension_error')

/**
 * Brand identifier stamped onto `ReturnType<BSync>` objects.
 *
 * @remarks
 * Used by `isBehavioralRule` to distinguish branded behavioral rule steps
 * from arbitrary functions at runtime.
 *
 * @internal
 */
export const RULES_FUNCTION_IDENTIFIER = '🪢'

/**
 * Defines how a b-thread listens for or specifies events in `waitFor`, `block`, or `interrupt` idioms.
 * This type provides a flexible way to match events based on simple string identifiers or complex conditions.
 *
 * It can be one of:
 * 1. A simple `string`: Matches events exactly by their `type` property.
 * 2. A structured match object: Matches by event `type`, validates source provenance with
 *    `sourceSchema`, and validates `detail` with `detailSchema`.
 * 3. A predicate function: Takes an event object and returns `true` if the event matches the desired criteria.
 *
 * @see {@link Idioms} for using listeners in synchronization
 * @see {@link bSync} for creating synchronization points
 */
export const EVENT_SOURCES = keyMirror('trigger', 'request', 'emit')

export const FRONTIER_STATUS = keyMirror('ready', 'deadlock', 'idle')

export const BTHREAD_ID_PREFIX = 'bt_'

export const INGRESS_ID_PREFIX = 'ing_'

export const EXPLORE_STRATEGIES = keyMirror('dfs', 'bfs')

export const VERIFICATION_STATUSES = keyMirror('verified', 'failed', 'truncated')

export const EXTENSION_MEMORY_EVENTS = keyMirror(
  'memory_disconnect',
  'memory_request',
  'memory_response',
  'memory_subscribe',
  'memory_transaction',
)

export const EXTENSION_REQUEST_EVENT = 'extension_request_event' as const
