import { keyMirror } from '../utils.ts'

/**
 * Discriminant values for the `SnapshotMessage` union.
 *
 * @remarks
 * Use the `kind` field to narrow the union:
 * - `'selection'` — event selection snapshot
 * - `'feedback_error'` — handler threw during side-effect execution
 * - `'restricted_trigger_error'` — trigger rejected a restricted event type
 * - `'bthreads_warning'` — duplicate thread identifier detected
 *
 * @public
 */
export const SNAPSHOT_MESSAGE_KINDS = keyMirror(
  'bthreads_warning',
  'feedback_error',
  'restricted_trigger_error',
  'selection',
)

/**
 * Brand identifier stamped onto `RulesFunction` objects.
 *
 * @remarks
 * Used by `isRulesFunction` to distinguish generator-based b-threads
 * from plain generator functions at runtime.
 *
 * @internal
 */
export const RULES_FUNCTION_IDENTIFIER = '🪢'
