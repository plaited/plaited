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
export const SNAPSHOT_MESSAGE_KINDS = keyMirror('deadlock', 'feedback_error', 'selection', 'runtime_error', 'worker')

export const FRONTIER_STATUS = keyMirror('ready', 'deadlock', 'idle')

export const EXPLORE_STRATEGIES = keyMirror('dfs', 'bfs')

export const VERIFICATION_STATUSES = keyMirror('verified', 'failed', 'truncated')
