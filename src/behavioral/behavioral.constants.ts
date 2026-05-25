import { keyMirror } from '../utils.ts'

/**
 * Discriminant values for the `SnapshotMessage` union.
 *
 * @remarks
 * Use the `kind` field to narrow the union:
 * - `'deadlock'` — no unblocked candidate could be selected
 * - `'selection'` — event selection snapshot
 * - `'feedback_error'` — handler threw during side-effect execution
 * - `'add_thread_error'` — non-thread value passed to `addThread`
 * - `'runtime_error'` — unrecoverable engine error
 *
 * @public
 */
export const SNAPSHOT_MESSAGE_KINDS = keyMirror(
  'deadlock',
  'feedback_error',
  'frontier',
  'selection',
  'runtime_error',
  'add_thread_error',
)

/**
 * Discriminant values for the scheduler-facing frontier status.
 *
 * @remarks
 * - `'ready'` — enabled candidates are available for selection
 * - `'deadlock'` — candidates exist but all are blocked
 * - `'idle'` — no candidates at all
 *
 * @public
 */
export const FRONTIER_STATUS = keyMirror('ready', 'deadlock', 'idle')

/**
 * Symbolic brand key used to tag thread (ReturnType<Sync>) functions at runtime.
 *
 * @remarks
 * Attached via `Object.assign` in the {@link thread} implementation. Enables
 * {@link isThread} to distinguish behavioral thread generators from plain
 * rule generators at runtime.
 *
 * @see {@link isThread} for the runtime type guard
 * @see {@link thread} for the implementation that brands returned functions
 *
 * @internal
 */
export const THREAD_IDENTIFIER = '🪢' as const
