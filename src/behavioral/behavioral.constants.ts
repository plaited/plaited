import { keyMirror } from '../utils.ts'

/**
 * Discriminant values for the `SnapshotMessage` union.
 *
 * @remarks
 * Use the `kind` field to narrow the union:
 * - `'deadlock'` — no unblocked candidate could be selected
 * - `'selection'` — event selection snapshot
 * - `'feedback_error'` — handler threw during side-effect execution
 *
 * @public
 */
export const SNAPSHOT_MESSAGE_KINDS = keyMirror('deadlock', 'feedback_error', 'selection', 'runtime_error')

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
export const EVENT_SOURCES = keyMirror('trigger', 'request')

export const FRONTIER_STATUS = keyMirror('ready', 'deadlock', 'idle')

export const BTHREAD_ID_PREFIX = 'bt_'

export const TRIGGER_ID_PREFIX = 'trg_'

export const EXPLORE_STRATEGIES = keyMirror('dfs', 'bfs')

export const VERIFICATION_STATUSES = keyMirror('verified', 'failed', 'truncated')
