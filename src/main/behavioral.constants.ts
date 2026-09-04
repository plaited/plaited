import { keyMirror } from '../utils.ts'

/**
 * Discriminant values for the `SnapshotMessage` union.
 *
 * @remarks
 * Use the `kind` field to narrow the union:
 * - `'deadlock'` — no unblocked candidate could be selected
 * - `'selection'` — event selection trace
 * - `'interrupt'` — a b-thread was terminated by a matching interrupt listener
 * - `'transform'` — a b-thread's transform listener matched; external code
 *   should apply the listener's `query` and emit the `target` event
 * - `'trigger_error'` — event rejected at the `useTrigger` ingress boundary
 * - `'add_thread_error'` — invalid thread arguments passed to `useAddThread`
 *
 * @public
 */
export const TRACE_MESSAGE_KINDS = keyMirror(
  'deadlock',
  'frontier',
  'pending_bids',
  'selection',
  'trigger_error',
  'add_thread_error',
  'interrupt',
  'transform',
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

export const IDIOMS = keyMirror('waitFor', 'interrupt', 'request', 'block', 'transform')

export const DETAIL_MATCH = keyMirror('valid', 'invalid')
