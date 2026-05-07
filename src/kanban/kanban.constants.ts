import { keyMirror } from '../utils.ts'

/**
 * Canonical work-item lifecycle state ids used by the durable kanban ledger.
 */
export const WORK_ITEM_LIFECYCLE_STATES = keyMirror(
  'draft',
  'discovery_ready',
  'formulated',
  'red_pending',
  'red_approved',
  'green_pending',
  'review_pending',
  'merge_ready',
  'merged',
  'cleanup_pending',
  'cleaned',
  'blocked',
  'rejected',
)

/**
 * Ordered lifecycle state values used for schema enums and board projections.
 */
export const WORK_ITEM_LIFECYCLE_STATE_VALUES = [
  WORK_ITEM_LIFECYCLE_STATES.draft,
  WORK_ITEM_LIFECYCLE_STATES.discovery_ready,
  WORK_ITEM_LIFECYCLE_STATES.formulated,
  WORK_ITEM_LIFECYCLE_STATES.red_pending,
  WORK_ITEM_LIFECYCLE_STATES.red_approved,
  WORK_ITEM_LIFECYCLE_STATES.green_pending,
  WORK_ITEM_LIFECYCLE_STATES.review_pending,
  WORK_ITEM_LIFECYCLE_STATES.merge_ready,
  WORK_ITEM_LIFECYCLE_STATES.merged,
  WORK_ITEM_LIFECYCLE_STATES.cleanup_pending,
  WORK_ITEM_LIFECYCLE_STATES.cleaned,
  WORK_ITEM_LIFECYCLE_STATES.blocked,
  WORK_ITEM_LIFECYCLE_STATES.rejected,
] as const

/**
 * Terminal lifecycle states where a work item is no longer actionable.
 */
export const WORK_ITEM_LIFECYCLE_TERMINAL_STATE_VALUES = [
  WORK_ITEM_LIFECYCLE_STATES.cleaned,
  WORK_ITEM_LIFECYCLE_STATES.rejected,
] as const

/**
 * Lifecycle states included in the simple ready queue projection.
 */
export const KANBAN_READY_STATUS_VALUES = [
  WORK_ITEM_LIFECYCLE_STATES.draft,
  WORK_ITEM_LIFECYCLE_STATES.discovery_ready,
  WORK_ITEM_LIFECYCLE_STATES.formulated,
  WORK_ITEM_LIFECYCLE_STATES.red_pending,
  WORK_ITEM_LIFECYCLE_STATES.red_approved,
  WORK_ITEM_LIFECYCLE_STATES.green_pending,
  WORK_ITEM_LIFECYCLE_STATES.review_pending,
  WORK_ITEM_LIFECYCLE_STATES.merge_ready,
  WORK_ITEM_LIFECYCLE_STATES.merged,
  WORK_ITEM_LIFECYCLE_STATES.cleanup_pending,
] as const

/**
 * Canonical lifecycle event ids that behavioral threads may record as kanban events.
 */
export const WORK_ITEM_LIFECYCLE_EVENTS = keyMirror(
  'submit_discovery',
  'complete_formulation',
  'request_red_approval',
  'approve_red_approval',
  'reject_red_approval',
  'start_green_execution',
  'submit_for_review',
  'mark_merge_ready',
  'mark_merged',
  'schedule_cleanup',
  'mark_cleaned',
  'block_for_dependencies',
  'unblock_after_dependencies',
  'revise_after_rejection',
  'deadlock_detected',
  'interrupt_requested',
)

/**
 * Ordered lifecycle event values used for schema enums and contract metadata.
 */
export const WORK_ITEM_LIFECYCLE_EVENT_VALUES = [
  WORK_ITEM_LIFECYCLE_EVENTS.submit_discovery,
  WORK_ITEM_LIFECYCLE_EVENTS.complete_formulation,
  WORK_ITEM_LIFECYCLE_EVENTS.request_red_approval,
  WORK_ITEM_LIFECYCLE_EVENTS.approve_red_approval,
  WORK_ITEM_LIFECYCLE_EVENTS.reject_red_approval,
  WORK_ITEM_LIFECYCLE_EVENTS.start_green_execution,
  WORK_ITEM_LIFECYCLE_EVENTS.submit_for_review,
  WORK_ITEM_LIFECYCLE_EVENTS.mark_merge_ready,
  WORK_ITEM_LIFECYCLE_EVENTS.mark_merged,
  WORK_ITEM_LIFECYCLE_EVENTS.schedule_cleanup,
  WORK_ITEM_LIFECYCLE_EVENTS.mark_cleaned,
  WORK_ITEM_LIFECYCLE_EVENTS.block_for_dependencies,
  WORK_ITEM_LIFECYCLE_EVENTS.unblock_after_dependencies,
  WORK_ITEM_LIFECYCLE_EVENTS.revise_after_rejection,
  WORK_ITEM_LIFECYCLE_EVENTS.deadlock_detected,
  WORK_ITEM_LIFECYCLE_EVENTS.interrupt_requested,
] as const

/**
 * Top-level `plaited` command name for the kanban ledger CLI.
 */
export const KANBAN_COMMAND = 'kanban'

/**
 * Mode ids accepted by the `plaited kanban` JSON CLI contract.
 */
export const KANBAN_MODES = {
  board: 'board',
  item: 'item',
  readyQueue: 'ready-queue',
  decisionAudit: 'decision-audit',
  initDb: 'init-db',
  createWorkItem: 'create-work-item',
  updateWorkItem: 'update-work-item',
  addDependency: 'add-dependency',
  recordDiscovery: 'record-discovery',
  recordDecision: 'record-decision',
  recordEvent: 'record-event',
} as const
