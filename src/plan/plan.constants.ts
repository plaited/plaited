import { keyMirror } from '../utils.ts'

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

export const WORK_ITEM_LIFECYCLE_TERMINAL_STATE_VALUES = [
  WORK_ITEM_LIFECYCLE_STATES.cleaned,
  WORK_ITEM_LIFECYCLE_STATES.rejected,
] as const

export const WORK_ITEM_LIFECYCLE_EXECUTION_STATE_VALUES = [
  WORK_ITEM_LIFECYCLE_STATES.red_pending,
  WORK_ITEM_LIFECYCLE_STATES.red_approved,
  WORK_ITEM_LIFECYCLE_STATES.green_pending,
  WORK_ITEM_LIFECYCLE_STATES.review_pending,
  WORK_ITEM_LIFECYCLE_STATES.merge_ready,
  WORK_ITEM_LIFECYCLE_STATES.merged,
  WORK_ITEM_LIFECYCLE_STATES.cleanup_pending,
] as const

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

export const WORK_ITEM_ORCHESTRATION_GUARDS = keyMirror(
  'dependencies_resolved',
  'dependencies_unresolved',
  'red_approval_is_fresh',
  'open_questions_resolved',
  'merge_gate_passed',
)

export const WORK_ITEM_ORCHESTRATION_GUARD_VALUES = [
  WORK_ITEM_ORCHESTRATION_GUARDS.dependencies_resolved,
  WORK_ITEM_ORCHESTRATION_GUARDS.dependencies_unresolved,
  WORK_ITEM_ORCHESTRATION_GUARDS.red_approval_is_fresh,
  WORK_ITEM_ORCHESTRATION_GUARDS.open_questions_resolved,
  WORK_ITEM_ORCHESTRATION_GUARDS.merge_gate_passed,
] as const

export const RED_FAILURE_CATEGORIES = keyMirror('expected_behavior_fail', 'missing_impl', 'env_fail', 'flaky_fail')

export const RED_FAILURE_CATEGORY_VALUES = [
  RED_FAILURE_CATEGORIES.expected_behavior_fail,
  RED_FAILURE_CATEGORIES.missing_impl,
  RED_FAILURE_CATEGORIES.env_fail,
  RED_FAILURE_CATEGORIES.flaky_fail,
] as const

export const APPROVABLE_RED_FAILURE_CATEGORY_VALUES = [
  RED_FAILURE_CATEGORIES.expected_behavior_fail,
  RED_FAILURE_CATEGORIES.missing_impl,
] as const

export const FRONTIER_FAILURE_CATEGORIES = keyMirror(
  'frontier_deadlock_detected',
  'frontier_truncated',
  'frontier_execution_error',
)

export const FRONTIER_FAILURE_CATEGORY_VALUES = [
  FRONTIER_FAILURE_CATEGORIES.frontier_deadlock_detected,
  FRONTIER_FAILURE_CATEGORIES.frontier_truncated,
  FRONTIER_FAILURE_CATEGORIES.frontier_execution_error,
] as const

export const MERGE_FAILURE_CATEGORIES = keyMirror(
  'required_checks_missing',
  'required_checks_failed',
  'merge_conflict_detected',
  'merge_simulation_execution_error',
)

export const MERGE_FAILURE_CATEGORY_VALUES = [
  MERGE_FAILURE_CATEGORIES.required_checks_missing,
  MERGE_FAILURE_CATEGORIES.required_checks_failed,
  MERGE_FAILURE_CATEGORIES.merge_conflict_detected,
  MERGE_FAILURE_CATEGORIES.merge_simulation_execution_error,
] as const

export const ESCALATION_TRIGGER_IDS = keyMirror(
  'open_questions_unresolved',
  'dependency_deadlock_detected',
  'consecutive_red_rejections',
  'risky_impact_threshold_exceeded',
)

export const ESCALATION_TRIGGER_ID_VALUES = [
  ESCALATION_TRIGGER_IDS.open_questions_unresolved,
  ESCALATION_TRIGGER_IDS.dependency_deadlock_detected,
  ESCALATION_TRIGGER_IDS.consecutive_red_rejections,
  ESCALATION_TRIGGER_IDS.risky_impact_threshold_exceeded,
] as const

export const CONSECUTIVE_RED_REJECTION_ESCALATION_THRESHOLD = 2
export const RISKY_IMPACT_ESCALATION_THRESHOLD = 8

export const PLAN_COMMAND = 'plan'

export const PLAN_PROJECTION_MODES = {
  board: 'board',
  item: 'item',
  readyQueue: 'ready-queue',
  decisionAudit: 'decision-audit',
} as const
