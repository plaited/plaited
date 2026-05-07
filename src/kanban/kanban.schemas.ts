import * as z from 'zod'

import { AGENT_RUNTIMES } from '../shared.ts'
import {
  WORK_ITEM_LIFECYCLE_EVENT_VALUES,
  WORK_ITEM_LIFECYCLE_EVENTS,
  WORK_ITEM_LIFECYCLE_EXECUTION_STATE_VALUES,
  WORK_ITEM_LIFECYCLE_STATE_VALUES,
  WORK_ITEM_LIFECYCLE_STATES,
  WORK_ITEM_LIFECYCLE_TERMINAL_STATE_VALUES,
  WORK_ITEM_ORCHESTRATION_GUARD_VALUES,
  WORK_ITEM_ORCHESTRATION_GUARDS,
} from './kanban.constants.ts'

const WorkItemLifecycleStateIdSchema = z.enum(WORK_ITEM_LIFECYCLE_STATE_VALUES)

const WorkItemLifecycleStateKindSchema = z.enum(['active', 'terminal'])

const WorkItemLifecycleStateSchema = z.strictObject({
  id: WorkItemLifecycleStateIdSchema,
  kind: WorkItemLifecycleStateKindSchema,
  description: z.string(),
})

const WorkItemLifecycleEventSchema = z.enum(WORK_ITEM_LIFECYCLE_EVENT_VALUES)

const WorkItemOrchestrationGuardIdSchema = z.enum(WORK_ITEM_ORCHESTRATION_GUARD_VALUES)

const WorkItemOrchestrationGuardCheckSchema = z.enum([
  'all_dependencies_resolved',
  'unresolved_dependency_count_gt_zero',
  'latest_red_approval_after_latest_discovery_or_spec_mutation',
  'open_questions_count_eq_zero',
  'latest_merge_simulation_approved_with_required_checks',
])

const WorkItemOrchestrationGuardSchema = z.strictObject({
  id: WorkItemOrchestrationGuardIdSchema,
  description: z.string(),
  check: WorkItemOrchestrationGuardCheckSchema,
  facts: z.array(z.string()).min(1),
})

const WorkItemOrchestrationTransitionSchema = z.strictObject({
  id: z.string().min(1),
  event: WorkItemLifecycleEventSchema,
  from: WorkItemLifecycleStateIdSchema,
  to: WorkItemLifecycleStateIdSchema,
  guardIds: z.array(WorkItemOrchestrationGuardIdSchema),
  description: z.string(),
})

const WorkItemDeadlockHookSchema = z.strictObject({
  event: z.literal(WORK_ITEM_LIFECYCLE_EVENTS.deadlock_detected),
  from: z.array(WorkItemLifecycleStateIdSchema).min(1),
  to: z.literal(WORK_ITEM_LIFECYCLE_STATES.blocked),
  description: z.string(),
})

const WorkItemInterruptionHookSchema = z.strictObject({
  event: z.literal(WORK_ITEM_LIFECYCLE_EVENTS.interrupt_requested),
  from: z.array(WorkItemLifecycleStateIdSchema).min(1),
  to: z.literal(WORK_ITEM_LIFECYCLE_STATES.blocked),
  description: z.string(),
})

const WorkItemEscalationOperatorSchema = z.enum(['gt', 'gte'])

const WorkItemEscalationMetricSchema = z.enum([
  'open_questions_count',
  'dependency_deadlock_count',
  'consecutive_red_rejections',
  'risky_impact_score',
])

const WorkItemEscalationHookSchema = z.strictObject({
  id: z.string().min(1),
  description: z.string(),
  metric: WorkItemEscalationMetricSchema,
  operator: WorkItemEscalationOperatorSchema,
  threshold: z.number().nonnegative(),
  action: z.literal('escalate_to_gate_authority'),
})

const WorkItemActorRoleSchema = z.strictObject({
  actorType: z.literal('agent'),
  actorId: z.enum([AGENT_RUNTIMES.coder, AGENT_RUNTIMES.analyst]),
  description: z.string().min(1),
})

export const WorkItemOrchestrationContractSchema = z
  .strictObject({
    version: z.literal(1),
    roles: z.strictObject({
      coder: WorkItemActorRoleSchema.extend({
        actorId: z.literal(AGENT_RUNTIMES.coder),
      }),
      analyst: WorkItemActorRoleSchema.extend({
        actorId: z.literal(AGENT_RUNTIMES.analyst),
      }),
    }),
    initialState: WorkItemLifecycleStateIdSchema,
    states: z.array(WorkItemLifecycleStateSchema).min(1),
    transitions: z.array(WorkItemOrchestrationTransitionSchema).min(1),
    guards: z.record(WorkItemOrchestrationGuardIdSchema, WorkItemOrchestrationGuardSchema),
    runtime: z.strictObject({
      deadlock: z.strictObject({
        onNoEnabledTransition: z.array(WorkItemDeadlockHookSchema).min(1),
      }),
      interruptions: z.array(WorkItemInterruptionHookSchema).min(1),
      escalations: z.array(WorkItemEscalationHookSchema).min(1),
    }),
  })
  .describe(
    'Canonical work-item behavioral orchestration contract for lifecycle states, events, guards, and runtime hooks.',
  )

export type WorkItemOrchestrationContract = z.infer<typeof WorkItemOrchestrationContractSchema>

const WORK_ITEM_ORCHESTRATION_STATES: WorkItemOrchestrationContract['states'] = [
  {
    id: WORK_ITEM_LIFECYCLE_STATES.draft,
    kind: 'active',
    description: 'Initial capture state before discovery artifacts are complete.',
  },
  {
    id: WORK_ITEM_LIFECYCLE_STATES.discovery_ready,
    kind: 'active',
    description: 'Discovery evidence is gathered and ready for formulation.',
  },
  {
    id: WORK_ITEM_LIFECYCLE_STATES.formulated,
    kind: 'active',
    description: 'Behavioral formulation is complete and can request red approval.',
  },
  {
    id: WORK_ITEM_LIFECYCLE_STATES.red_pending,
    kind: 'active',
    description: 'Red evidence is being evaluated by gate authority.',
  },
  {
    id: WORK_ITEM_LIFECYCLE_STATES.red_approved,
    kind: 'active',
    description: 'Red gate approved; item may enter green execution when guards pass.',
  },
  {
    id: WORK_ITEM_LIFECYCLE_STATES.green_pending,
    kind: 'active',
    description: 'Implementation in progress after valid red approval.',
  },
  {
    id: WORK_ITEM_LIFECYCLE_STATES.review_pending,
    kind: 'active',
    description: 'Green result is ready for reviewer checks and merge qualification.',
  },
  {
    id: WORK_ITEM_LIFECYCLE_STATES.merge_ready,
    kind: 'active',
    description: 'All required local gates passed and merge can execute.',
  },
  {
    id: WORK_ITEM_LIFECYCLE_STATES.merged,
    kind: 'active',
    description: 'Merge completed and cleanup is pending.',
  },
  {
    id: WORK_ITEM_LIFECYCLE_STATES.cleanup_pending,
    kind: 'active',
    description: 'Post-merge branch/worktree cleanup is queued.',
  },
  {
    id: WORK_ITEM_LIFECYCLE_STATES.blocked,
    kind: 'active',
    description: 'Execution paused due to unresolved dependencies or runtime interruption.',
  },
  {
    id: WORK_ITEM_LIFECYCLE_STATES.cleaned,
    kind: 'terminal',
    description: 'Cleanup finished and lifecycle is complete.',
  },
  {
    id: WORK_ITEM_LIFECYCLE_STATES.rejected,
    kind: 'terminal',
    description: 'Gate authority rejected the work item without continuation.',
  },
]

const WORK_ITEM_ORCHESTRATION_GUARD_DEFINITIONS: WorkItemOrchestrationContract['guards'] = {
  [WORK_ITEM_ORCHESTRATION_GUARDS.dependencies_resolved]: {
    id: WORK_ITEM_ORCHESTRATION_GUARDS.dependencies_resolved,
    description: 'All dependency work items are in terminal success states.',
    check: 'all_dependencies_resolved',
    facts: ['unresolved_dependency_count'],
  },
  [WORK_ITEM_ORCHESTRATION_GUARDS.dependencies_unresolved]: {
    id: WORK_ITEM_ORCHESTRATION_GUARDS.dependencies_unresolved,
    description: 'One or more dependency work items are unresolved.',
    check: 'unresolved_dependency_count_gt_zero',
    facts: ['unresolved_dependency_count'],
  },
  [WORK_ITEM_ORCHESTRATION_GUARDS.red_approval_is_fresh]: {
    id: WORK_ITEM_ORCHESTRATION_GUARDS.red_approval_is_fresh,
    description: 'Latest red approval is newer than latest discovery/spec mutation.',
    check: 'latest_red_approval_after_latest_discovery_or_spec_mutation',
    facts: ['latest_red_approval_at', 'latest_discovery_mutation_at', 'latest_spec_mutation_at'],
  },
  [WORK_ITEM_ORCHESTRATION_GUARDS.open_questions_resolved]: {
    id: WORK_ITEM_ORCHESTRATION_GUARDS.open_questions_resolved,
    description: 'Discovery open questions must be empty before formulation or approval.',
    check: 'open_questions_count_eq_zero',
    facts: ['open_questions_count'],
  },
  [WORK_ITEM_ORCHESTRATION_GUARDS.merge_gate_passed]: {
    id: WORK_ITEM_ORCHESTRATION_GUARDS.merge_gate_passed,
    description: 'Latest merge simulation gate approved with required merge-eligible checks.',
    check: 'latest_merge_simulation_approved_with_required_checks',
    facts: ['latest_merge_simulation_decision', 'latest_merge_simulation_required_checks'],
  },
}

const WORK_ITEM_ORCHESTRATION_TRANSITIONS: WorkItemOrchestrationContract['transitions'] = [
  {
    id: 'draft-to-discovery-ready',
    event: WORK_ITEM_LIFECYCLE_EVENTS.submit_discovery,
    from: WORK_ITEM_LIFECYCLE_STATES.draft,
    to: WORK_ITEM_LIFECYCLE_STATES.discovery_ready,
    guardIds: [],
    description: 'Advance once discovery work is captured.',
  },
  {
    id: 'discovery-ready-to-formulated',
    event: WORK_ITEM_LIFECYCLE_EVENTS.complete_formulation,
    from: WORK_ITEM_LIFECYCLE_STATES.discovery_ready,
    to: WORK_ITEM_LIFECYCLE_STATES.formulated,
    guardIds: [WORK_ITEM_ORCHESTRATION_GUARDS.open_questions_resolved],
    description: 'Formulation closes discovery when open questions are resolved.',
  },
  {
    id: 'formulated-to-red-pending',
    event: WORK_ITEM_LIFECYCLE_EVENTS.request_red_approval,
    from: WORK_ITEM_LIFECYCLE_STATES.formulated,
    to: WORK_ITEM_LIFECYCLE_STATES.red_pending,
    guardIds: [WORK_ITEM_ORCHESTRATION_GUARDS.dependencies_resolved],
    description: 'Queue red gate decision for review authority.',
  },
  {
    id: 'red-pending-to-red-approved',
    event: WORK_ITEM_LIFECYCLE_EVENTS.approve_red_approval,
    from: WORK_ITEM_LIFECYCLE_STATES.red_pending,
    to: WORK_ITEM_LIFECYCLE_STATES.red_approved,
    guardIds: [WORK_ITEM_ORCHESTRATION_GUARDS.open_questions_resolved],
    description: 'Red approval requires discovery consistency.',
  },
  {
    id: 'red-pending-to-rejected',
    event: WORK_ITEM_LIFECYCLE_EVENTS.reject_red_approval,
    from: WORK_ITEM_LIFECYCLE_STATES.red_pending,
    to: WORK_ITEM_LIFECYCLE_STATES.rejected,
    guardIds: [],
    description: 'Reject when red evidence does not satisfy gate requirements.',
  },
  {
    id: 'red-approved-to-green-pending',
    event: WORK_ITEM_LIFECYCLE_EVENTS.start_green_execution,
    from: WORK_ITEM_LIFECYCLE_STATES.red_approved,
    to: WORK_ITEM_LIFECYCLE_STATES.green_pending,
    guardIds: [
      WORK_ITEM_ORCHESTRATION_GUARDS.dependencies_resolved,
      WORK_ITEM_ORCHESTRATION_GUARDS.red_approval_is_fresh,
    ],
    description: 'Green execution is forbidden until dependencies and red freshness pass.',
  },
  {
    id: 'green-pending-to-review-pending',
    event: WORK_ITEM_LIFECYCLE_EVENTS.submit_for_review,
    from: WORK_ITEM_LIFECYCLE_STATES.green_pending,
    to: WORK_ITEM_LIFECYCLE_STATES.review_pending,
    guardIds: [WORK_ITEM_ORCHESTRATION_GUARDS.dependencies_resolved],
    description: 'Move to review only while dependencies remain resolved.',
  },
  {
    id: 'review-pending-to-merge-ready',
    event: WORK_ITEM_LIFECYCLE_EVENTS.mark_merge_ready,
    from: WORK_ITEM_LIFECYCLE_STATES.review_pending,
    to: WORK_ITEM_LIFECYCLE_STATES.merge_ready,
    guardIds: [WORK_ITEM_ORCHESTRATION_GUARDS.dependencies_resolved, WORK_ITEM_ORCHESTRATION_GUARDS.merge_gate_passed],
    description: 'Mark merge-ready after required checks, merge simulation, and dependency guards pass.',
  },
  {
    id: 'merge-ready-to-merged',
    event: WORK_ITEM_LIFECYCLE_EVENTS.mark_merged,
    from: WORK_ITEM_LIFECYCLE_STATES.merge_ready,
    to: WORK_ITEM_LIFECYCLE_STATES.merged,
    guardIds: [WORK_ITEM_ORCHESTRATION_GUARDS.dependencies_resolved],
    description: 'Merge while dependency invariants remain satisfied.',
  },
  {
    id: 'merged-to-cleanup-pending',
    event: WORK_ITEM_LIFECYCLE_EVENTS.schedule_cleanup,
    from: WORK_ITEM_LIFECYCLE_STATES.merged,
    to: WORK_ITEM_LIFECYCLE_STATES.cleanup_pending,
    guardIds: [],
    description: 'Post-merge cleanup is explicit and first-class.',
  },
  {
    id: 'cleanup-pending-to-cleaned',
    event: WORK_ITEM_LIFECYCLE_EVENTS.mark_cleaned,
    from: WORK_ITEM_LIFECYCLE_STATES.cleanup_pending,
    to: WORK_ITEM_LIFECYCLE_STATES.cleaned,
    guardIds: [],
    description: 'Lifecycle completes only after cleanup succeeds.',
  },
  ...WORK_ITEM_LIFECYCLE_EXECUTION_STATE_VALUES.map((state) => ({
    id: `block-${state}-for-dependencies`,
    event: WORK_ITEM_LIFECYCLE_EVENTS.block_for_dependencies,
    from: state,
    to: WORK_ITEM_LIFECYCLE_STATES.blocked,
    guardIds: [WORK_ITEM_ORCHESTRATION_GUARDS.dependencies_unresolved],
    description: 'Execution pauses whenever dependency guards fail.',
  })),
  {
    id: 'blocked-to-formulated',
    event: WORK_ITEM_LIFECYCLE_EVENTS.unblock_after_dependencies,
    from: WORK_ITEM_LIFECYCLE_STATES.blocked,
    to: WORK_ITEM_LIFECYCLE_STATES.formulated,
    guardIds: [WORK_ITEM_ORCHESTRATION_GUARDS.dependencies_resolved],
    description: 'Resume through formulation after dependency blockers clear.',
  },
]

const CANONICAL_WORK_ITEM_ORCHESTRATION_CONTRACT_UNVALIDATED: WorkItemOrchestrationContract = {
  version: 1,
  roles: {
    coder: {
      actorType: 'agent',
      actorId: AGENT_RUNTIMES.coder,
      description: 'Implementation execution authority for green worktree changes.',
    },
    analyst: {
      actorType: 'agent',
      actorId: AGENT_RUNTIMES.analyst,
      description: 'Analysis and gate authority for red approval, frontier verification, and merge qualification.',
    },
  },
  initialState: WORK_ITEM_LIFECYCLE_STATES.draft,
  states: WORK_ITEM_ORCHESTRATION_STATES,
  transitions: WORK_ITEM_ORCHESTRATION_TRANSITIONS,
  guards: WORK_ITEM_ORCHESTRATION_GUARD_DEFINITIONS,
  runtime: {
    deadlock: {
      onNoEnabledTransition: [
        {
          event: WORK_ITEM_LIFECYCLE_EVENTS.deadlock_detected,
          from: [WORK_ITEM_LIFECYCLE_STATES.formulated, ...WORK_ITEM_LIFECYCLE_EXECUTION_STATE_VALUES],
          to: WORK_ITEM_LIFECYCLE_STATES.blocked,
          description: 'No enabled transition in active execution maps to blocked deadlock state.',
        },
      ],
    },
    interruptions: [
      {
        event: WORK_ITEM_LIFECYCLE_EVENTS.interrupt_requested,
        from: [...WORK_ITEM_LIFECYCLE_EXECUTION_STATE_VALUES],
        to: WORK_ITEM_LIFECYCLE_STATES.blocked,
        description: 'Interruptions route deterministic execution states to blocked for triage.',
      },
    ],
    escalations: [
      {
        id: 'escalate-open-questions',
        description: 'Escalate when formulation gate has unresolved open questions.',
        metric: 'open_questions_count',
        operator: 'gt',
        threshold: 0,
        action: 'escalate_to_gate_authority',
      },
      {
        id: 'escalate-dependency-deadlock',
        description: 'Escalate when dependency deadlock is detected.',
        metric: 'dependency_deadlock_count',
        operator: 'gt',
        threshold: 0,
        action: 'escalate_to_gate_authority',
      },
      {
        id: 'escalate-consecutive-red-rejections',
        description: 'Escalate after two consecutive red rejections for the same item.',
        metric: 'consecutive_red_rejections',
        operator: 'gte',
        threshold: 2,
        action: 'escalate_to_gate_authority',
      },
      {
        id: 'escalate-risky-impact',
        description: 'Escalate when risk score reaches threshold for manual authority review.',
        metric: 'risky_impact_score',
        operator: 'gte',
        threshold: 8,
        action: 'escalate_to_gate_authority',
      },
    ],
  },
}

const assertContractReferences = (contract: WorkItemOrchestrationContract): void => {
  const stateIds = new Set(contract.states.map((state) => state.id))
  const terminalStateIds = new Set(
    contract.states.filter((state) => state.kind === 'terminal').map((state) => state.id),
  )
  const guardIds = new Set(Object.keys(contract.guards))

  if (!stateIds.has(contract.initialState)) {
    throw new Error(`Unknown initial state "${contract.initialState}" in orchestration contract.`)
  }

  for (const terminalState of WORK_ITEM_LIFECYCLE_TERMINAL_STATE_VALUES) {
    if (!terminalStateIds.has(terminalState)) {
      throw new Error(`Terminal lifecycle state "${terminalState}" must be present and terminal.`)
    }
  }

  for (const transition of contract.transitions) {
    if (!stateIds.has(transition.from)) {
      throw new Error(`Transition "${transition.id}" has unknown "from" state "${transition.from}".`)
    }
    if (!stateIds.has(transition.to)) {
      throw new Error(`Transition "${transition.id}" has unknown "to" state "${transition.to}".`)
    }
    for (const guardId of transition.guardIds) {
      if (!guardIds.has(guardId)) {
        throw new Error(`Transition "${transition.id}" references unknown guard "${guardId}".`)
      }
    }
  }

  for (const hook of contract.runtime.deadlock.onNoEnabledTransition) {
    for (const fromState of hook.from) {
      if (!stateIds.has(fromState)) {
        throw new Error(`Deadlock hook references unknown state "${fromState}".`)
      }
    }
  }

  for (const hook of contract.runtime.interruptions) {
    for (const fromState of hook.from) {
      if (!stateIds.has(fromState)) {
        throw new Error(`Interruption hook references unknown state "${fromState}".`)
      }
    }
  }
}

assertContractReferences(CANONICAL_WORK_ITEM_ORCHESTRATION_CONTRACT_UNVALIDATED)

export const CANONICAL_WORK_ITEM_ORCHESTRATION_CONTRACT = WorkItemOrchestrationContractSchema.parse(
  CANONICAL_WORK_ITEM_ORCHESTRATION_CONTRACT_UNVALIDATED,
)
