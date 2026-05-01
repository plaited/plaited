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
export const SNAPSHOT_MESSAGE_KINDS = keyMirror(
  'deadlock',
  'feedback_error',
  'frontier',
  'selection',
  'runtime_error',
  'worker',
)

export const FRONTIER_STATUS = keyMirror('ready', 'deadlock', 'idle')
