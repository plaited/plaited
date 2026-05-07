import * as z from 'zod'

import { AGENT_RUNTIMES } from '../shared.ts'
import {
  FRONTIER_FAILURE_CATEGORY_VALUES,
  KANBAN_MODES,
  MERGE_FAILURE_CATEGORY_VALUES,
  RED_FAILURE_CATEGORY_VALUES,
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

const CanonicalUtcIsoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, {
    message: 'Expected canonical UTC ISO timestamp (YYYY-MM-DDTHH:mm:ss.sssZ).',
  })
  .refine((value) => {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
  }, 'Expected canonical UTC ISO timestamp (YYYY-MM-DDTHH:mm:ss.sssZ).')

const KanbanBaseInputSchema = z
  .object({
    dbPath: z.string().min(1).describe('Path to the kanban SQLite database.'),
  })
  .strict()
  .describe('Shared input for agent-facing kanban command modes.')

const KanbanActorInputSchema = z.strictObject({
  actorType: z.enum(['agent', 'user', 'system']).describe('Actor type responsible for the operation.'),
  actorId: z.string().min(1).describe('Actor id responsible for the operation.'),
})

const KanbanEvidenceRefInputSchema = z.strictObject({
  contextDbPath: z.string().min(1).describe('Context DB path for linked evidence.'),
  evidenceCacheRowId: z.number().int().positive().describe('Evidence cache row id.'),
})

const KanbanRedFailureInputSchema = z.strictObject({
  category: z.enum(RED_FAILURE_CATEGORY_VALUES).describe('Red gate failure category.'),
  checkName: z.string().min(1).describe('Executable check or evidence name.'),
  detail: z.string().min(1).describe('Failure detail preserved in the audit trail.'),
})

const KanbanBoardInputSchema = KanbanBaseInputSchema.extend({
  mode: z.literal(KANBAN_MODES.board).describe('Projects board/status state for all work items.'),
}).describe('Input for `plaited kanban` board mode.')

const KanbanItemInputSchema = KanbanBaseInputSchema.extend({
  mode: z.literal(KANBAN_MODES.item).describe('Projects one work item in detail.'),
  workItemId: z.string().min(1).describe('Work item id to project.'),
}).describe('Input for `plaited kanban` item mode.')

const KanbanReadyQueueInputSchema = KanbanBaseInputSchema.extend({
  mode: z.literal(KANBAN_MODES.readyQueue).describe('Projects deterministic next actionable items.'),
  nowIso: CanonicalUtcIsoSchema.optional().describe(
    'Optional deterministic projection timestamp. When omitted, time-dependent cleanup completion readiness is not emitted.',
  ),
}).describe('Input for `plaited kanban` ready queue mode.')

const KanbanDecisionAuditInputSchema = KanbanBaseInputSchema.extend({
  mode: z.literal(KANBAN_MODES.decisionAudit).describe('Projects gate decision audit records.'),
  workItemId: z.string().min(1).optional().describe('Optional work item id filter for gate decisions.'),
  limit: z.number().int().positive().max(500).default(100).describe('Maximum audit rows to return.'),
}).describe('Input for `plaited kanban` decision audit mode.')

const KanbanInitDbInputSchema = KanbanBaseInputSchema.extend({
  mode: z.literal(KANBAN_MODES.initDb).describe('Creates or opens the kanban database and applies baseline schema.'),
}).describe('Input for `plaited kanban` init-db mode.')

const KanbanRecordRedApprovalInputSchema = KanbanBaseInputSchema.extend({
  mode: z.literal(KANBAN_MODES.recordRedApproval).describe('Evaluates and records a red approval gate decision.'),
  decisionId: z.string().min(1).describe('Gate decision id to persist.'),
  workItemId: z.string().min(1).describe('Work item id being evaluated.'),
  reason: z.string().min(1).describe('Operator reason for the decision.'),
  discoveryArtifactId: z.string().min(1).nullable().describe('Discovery artifact id used as approval basis.'),
  failures: z.array(KanbanRedFailureInputSchema).describe('Targeted failing checks used as red evidence.'),
  evidenceRefs: z.array(KanbanEvidenceRefInputSchema).describe('Context evidence cache references.'),
  decidedAt: CanonicalUtcIsoSchema.optional().describe('Optional deterministic decision timestamp.'),
})
  .merge(KanbanActorInputSchema)
  .describe('Input for `plaited kanban` record-red-approval mode.')

const KanbanRevokeStaleRedApprovalInputSchema = KanbanBaseInputSchema.extend({
  mode: z
    .literal(KANBAN_MODES.revokeStaleRedApproval)
    .describe('Revokes the latest red approval when discovery or spec drift is detected.'),
  decisionId: z.string().min(1).describe('Gate decision id to use if a revocation is persisted.'),
  workItemId: z.string().min(1).describe('Work item id to inspect for stale red approval.'),
  decidedAt: CanonicalUtcIsoSchema.optional().describe('Optional deterministic decision timestamp.'),
})
  .merge(KanbanActorInputSchema)
  .describe('Input for `plaited kanban` revoke-stale-red-approval mode.')

const KanbanRecordFrontierVerificationInputSchema = KanbanBaseInputSchema.extend({
  mode: z
    .literal(KANBAN_MODES.recordFrontierVerification)
    .describe('Runs behavioral-frontier verification and records a gate decision.'),
  decisionId: z.string().min(1).describe('Gate decision id to persist.'),
  workItemId: z.string().min(1).describe('Work item id being evaluated.'),
  reason: z.string().min(1).describe('Operator reason for the decision.'),
  discoveryArtifactId: z.string().min(1).nullable().describe('Discovery artifact id used as verification basis.'),
  evidenceRefs: z.array(KanbanEvidenceRefInputSchema).describe('Context evidence cache references.'),
  snapshotMessages: z.array(z.unknown()).optional().describe('Optional replay snapshot messages.'),
  triggers: z.array(z.unknown()).optional().describe('Optional trigger events for frontier verification.'),
  maxDepth: z.number().int().positive().optional().describe('Optional behavioral-frontier max depth.'),
  cwd: z.string().min(1).optional().describe('Optional working directory for spec resolution.'),
  decidedAt: CanonicalUtcIsoSchema.optional().describe('Optional deterministic decision timestamp.'),
})
  .merge(KanbanActorInputSchema)
  .describe('Input for `plaited kanban` record-frontier-verification mode.')

const KanbanRecordMergeSimulationInputSchema = KanbanBaseInputSchema.extend({
  mode: z
    .literal(KANBAN_MODES.recordMergeSimulation)
    .describe('Runs local merge simulation and records gate evidence.'),
  decisionId: z.string().min(1).describe('Gate decision id to persist.'),
  workItemId: z.string().min(1).describe('Work item id being evaluated.'),
  reason: z.string().min(1).describe('Operator reason for the decision.'),
  repoPath: z.string().min(1).describe('Repository path for git merge simulation.'),
  sourceRef: z.string().min(1).describe('Source ref to merge.'),
  targetRef: z.string().min(1).describe('Target ref to simulate against.'),
  requiredCheckRunIds: z.array(z.string().min(1)).describe('Required check run ids for merge qualification.'),
  simulationWorktreePath: z.string().min(1).optional().describe('Optional deterministic simulation worktree path.'),
  evidenceRefs: z.array(KanbanEvidenceRefInputSchema).optional().describe('Context evidence cache references.'),
  decidedAt: CanonicalUtcIsoSchema.optional().describe('Optional deterministic decision timestamp.'),
})
  .merge(KanbanActorInputSchema)
  .describe('Input for `plaited kanban` record-merge-simulation mode.')

const KanbanRecordEscalationInputSchema = KanbanBaseInputSchema.extend({
  mode: z.literal(KANBAN_MODES.recordEscalation).describe('Evaluates escalation triggers and records an event.'),
  workItemId: z.string().min(1).describe('Work item id being evaluated.'),
  evaluationContext: z
    .enum(['formulation', 'red_approval', 'frontier_verification', 'merge_simulation'])
    .describe('Gate context for escalation evaluation.'),
  dependencyDeadlockCount: z.number().int().nonnegative().describe('Detected dependency deadlock count.'),
  riskyImpactScore: z.number().nonnegative().describe('Risk score used for escalation thresholding.'),
  occurredAt: CanonicalUtcIsoSchema.optional().describe('Optional deterministic event timestamp.'),
})
  .merge(KanbanActorInputSchema)
  .describe('Input for `plaited kanban` record-escalation mode.')

const KanbanStartExecutionInputSchema = KanbanBaseInputSchema.extend({
  mode: z.literal(KANBAN_MODES.startExecution).describe('Starts green execution for a ready work item.'),
  workItemId: z.string().min(1).describe('Work item id to start.'),
  repoPath: z.string().min(1).describe('Repository path where the worktree will be created.'),
  targetRef: z.string().min(1).describe('Target ref for the execution worktree.'),
  occurredAt: CanonicalUtcIsoSchema.optional().describe('Optional deterministic event timestamp.'),
})
  .merge(KanbanActorInputSchema)
  .describe('Input for `plaited kanban` start-execution mode.')

const KanbanRunPostMergeCleanupInputSchema = KanbanBaseInputSchema.extend({
  mode: z.literal(KANBAN_MODES.runPostMergeCleanup).describe('Runs post-merge worktree and branch cleanup.'),
  workItemId: z.string().min(1).describe('Work item id to clean up.'),
  repoPath: z.string().min(1).describe('Repository path for git cleanup operations.'),
  branchRetentionTtlSeconds: z.number().int().positive().optional().describe('Optional branch retention TTL.'),
  occurredAt: CanonicalUtcIsoSchema.optional().describe('Optional deterministic event timestamp.'),
})
  .merge(KanbanActorInputSchema)
  .describe('Input for `plaited kanban` run-post-merge-cleanup mode.')

export const KanbanCliInputSchema = z
  .discriminatedUnion('mode', [
    KanbanBoardInputSchema,
    KanbanItemInputSchema,
    KanbanReadyQueueInputSchema,
    KanbanDecisionAuditInputSchema,
    KanbanInitDbInputSchema,
    KanbanRecordRedApprovalInputSchema,
    KanbanRevokeStaleRedApprovalInputSchema,
    KanbanRecordFrontierVerificationInputSchema,
    KanbanRecordMergeSimulationInputSchema,
    KanbanRecordEscalationInputSchema,
    KanbanStartExecutionInputSchema,
    KanbanRunPostMergeCleanupInputSchema,
  ])
  .describe('Input for the `plaited kanban` agent-facing kanban command.')

export type KanbanCliInput = z.output<typeof KanbanCliInputSchema>

const KanbanBoardOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates board projection succeeded.'),
    mode: z.literal(KANBAN_MODES.board).describe('Echoes board mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    states: z
      .array(
        z
          .object({
            state: z.enum(WORK_ITEM_LIFECYCLE_STATE_VALUES).describe('Lifecycle state bucket.'),
            total: z.number().int().nonnegative().describe('Number of work items in this state.'),
            items: z
              .array(
                z
                  .object({
                    id: z.string().min(1).describe('Work item id.'),
                    unresolvedDependencyCount: z
                      .number()
                      .int()
                      .nonnegative()
                      .describe('Count of unresolved dependencies for the work item.'),
                  })
                  .strict(),
              )
              .describe('Work items in this state, ordered deterministically.'),
          })
          .strict(),
      )
      .describe('Board buckets grouped by lifecycle state.'),
    blockers: z
      .array(
        z
          .object({
            workItemId: z.string().min(1).describe('Blocked work item id.'),
            unresolvedDependencies: z
              .array(
                z
                  .object({
                    id: z.string().min(1).describe('Blocking dependency work item id.'),
                    status: z.enum(WORK_ITEM_LIFECYCLE_STATE_VALUES).describe('Blocking dependency lifecycle state.'),
                  })
                  .strict(),
              )
              .describe('Unresolved dependency rows preventing progress.'),
          })
          .strict(),
      )
      .describe('Work items that are blocked by unresolved dependencies.'),
    wip: z
      .object({
        total: z.number().int().nonnegative().describe('Total work-in-progress item count across execution states.'),
        byState: z
          .array(
            z
              .object({
                state: z.enum(WORK_ITEM_LIFECYCLE_STATE_VALUES).describe('Execution state bucket.'),
                total: z.number().int().nonnegative().describe('Number of WIP items in this state.'),
              })
              .strict(),
          )
          .describe('WIP counts by execution lifecycle state.'),
        items: z
          .array(
            z
              .object({
                id: z.string().min(1).describe('Work item id.'),
                status: z.enum(WORK_ITEM_LIFECYCLE_STATE_VALUES).describe('Current lifecycle state.'),
              })
              .strict(),
          )
          .describe('Deterministically ordered WIP work items.'),
      })
      .strict()
      .describe('Work-in-progress summary derived from execution states.'),
  })
  .strict()
  .describe('Output for `plaited kanban` board mode.')

const KanbanItemOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates item projection succeeded.'),
    mode: z.literal(KANBAN_MODES.item).describe('Echoes item mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    item: z
      .object({
        id: z.string().min(1).describe('Work item id.'),
        requestId: z.string().min(1).describe('Owning request id.'),
        title: z.string().min(1).describe('Work item title.'),
        status: z.enum(WORK_ITEM_LIFECYCLE_STATE_VALUES).describe('Current lifecycle state.'),
        specPath: z.string().min(1).nullable().describe('Tracked behavioral spec path when present.'),
        specCommitSha: z.string().min(1).nullable().describe('Tracked spec commit SHA when present.'),
        guards: z
          .object({
            dependenciesResolved: z.boolean().describe('True when all dependency work items are cleaned.'),
            redApprovalIsFresh: z
              .boolean()
              .describe('True when the latest approved red decision matches current spec/discovery state.'),
            mergeGatePassed: z.boolean().describe('True when the latest merge simulation decision is approved.'),
            openQuestionsResolved: z
              .boolean()
              .describe('True when the latest discovery artifact has no open questions.'),
          })
          .strict()
          .describe('Derived orchestration guard status for the work item.'),
        execution: z
          .object({
            branchRef: z.string().min(1).describe('Execution branch ref when prepared.'),
            worktreePath: z.string().min(1).describe('Execution worktree path when prepared.'),
            targetRef: z.string().min(1).describe('Execution merge target ref when prepared.'),
            preparedAt: z.string().min(1).nullable().describe('Timestamp when execution environment was prepared.'),
          })
          .strict()
          .nullable()
          .describe('Prepared execution environment, or null when none exists.'),
        cleanup: z
          .object({
            branchPruneAfterAt: z
              .string()
              .min(1)
              .nullable()
              .describe('Scheduled branch prune timestamp when cleanup is queued.'),
            worktreeRemovedAt: z
              .string()
              .min(1)
              .nullable()
              .describe('Timestamp when the execution worktree was removed.'),
            branchPrunedAt: z.string().min(1).nullable().describe('Timestamp when the execution branch was pruned.'),
          })
          .strict()
          .nullable()
          .describe('Cleanup lifecycle metadata, or null when cleanup has not started.'),
        dependencies: z
          .array(
            z
              .object({
                id: z.string().min(1).describe('Dependency work item id.'),
                title: z.string().min(1).describe('Dependency work item title.'),
                status: z.enum(WORK_ITEM_LIFECYCLE_STATE_VALUES).describe('Dependency lifecycle state.'),
                isResolved: z.boolean().describe('True when the dependency is in the cleaned terminal-success state.'),
              })
              .strict(),
          )
          .describe('Dependency work items for this item.'),
        gateStatus: z
          .object({
            redApproval: z
              .object({
                latestDecision: z.enum(['approved', 'rejected']).describe('Latest red approval decision.'),
                decidedAt: z.string().min(1).describe('Timestamp of the latest red approval decision.'),
              })
              .strict()
              .nullable(),
            frontierVerification: z
              .object({
                latestDecision: z.enum(['approved', 'rejected']).describe('Latest frontier verification decision.'),
                decidedAt: z.string().min(1).describe('Timestamp of the latest frontier verification decision.'),
              })
              .strict()
              .nullable(),
            mergeSimulation: z
              .object({
                latestDecision: z.enum(['approved', 'rejected']).describe('Latest merge simulation decision.'),
                decidedAt: z.string().min(1).describe('Timestamp of the latest merge simulation decision.'),
              })
              .strict()
              .nullable(),
          })
          .strict()
          .describe('Latest decision status by gate.'),
        latestDecisions: z
          .array(
            z
              .object({
                id: z.string().min(1).describe('Gate decision id.'),
                gateName: z
                  .enum(['formulation', 'red_approval', 'frontier_verification', 'merge_simulation'])
                  .describe('Gate name.'),
                decision: z.enum(['approved', 'rejected']).describe('Decision result.'),
                reason: z.string().min(1).describe('Recorded decision reason.'),
                specCommitSha: z
                  .string()
                  .min(1)
                  .nullable()
                  .describe('Spec commit SHA snapshot captured on the decision.'),
                decidedAt: z.string().min(1).describe('Decision timestamp.'),
                failureCategories: z.array(z.string().min(1)).describe('Failure categories linked to the decision.'),
                evidenceRefs: z
                  .array(
                    z
                      .object({
                        contextDbPath: z.string().min(1).describe('Context DB path for linked evidence.'),
                        evidenceCacheRowId: z.number().int().positive().describe('Evidence cache row id.'),
                      })
                      .strict(),
                  )
                  .describe('Evidence cache references linked to the decision.'),
              })
              .strict(),
          )
          .describe('Latest gate decisions for the work item, newest first.'),
      })
      .strict()
      .describe('Detailed work item projection for orchestration agents.'),
  })
  .strict()
  .describe('Output for `plaited kanban` item mode.')

const KanbanReadyQueueOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates ready queue projection succeeded.'),
    mode: z.literal(KANBAN_MODES.readyQueue).describe('Echoes ready queue mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    readyItems: z
      .array(
        z
          .object({
            workItemId: z.string().min(1).describe('Actionable work item id.'),
            title: z.string().min(1).describe('Actionable work item title.'),
            status: z.enum(WORK_ITEM_LIFECYCLE_STATE_VALUES).describe('Current lifecycle state.'),
            nextEvent: z.string().min(1).describe('Next lifecycle event the agent can deterministically fire.'),
          })
          .strict(),
      )
      .describe('Deterministically ordered actionable work items.'),
  })
  .strict()
  .describe('Output for `plaited kanban` ready queue mode.')

const KanbanDecisionAuditOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates decision audit projection succeeded.'),
    mode: z.literal(KANBAN_MODES.decisionAudit).describe('Echoes decision audit mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    decisions: z
      .array(
        z
          .object({
            id: z.string().min(1).describe('Gate decision id.'),
            workItemId: z.string().min(1).describe('Owning work item id.'),
            gateName: z
              .enum(['formulation', 'red_approval', 'frontier_verification', 'merge_simulation'])
              .describe('Gate name.'),
            decision: z.enum(['approved', 'rejected']).describe('Decision result.'),
            reason: z.string().min(1).describe('Recorded decision reason.'),
            specCommitSha: z.string().min(1).nullable().describe('Spec commit SHA snapshot captured on the decision.'),
            decidedAt: z.string().min(1).describe('Decision timestamp.'),
            failureCategories: z.array(z.string().min(1)).describe('Failure categories linked to the decision.'),
            evidenceRefs: z
              .array(
                z
                  .object({
                    contextDbPath: z.string().min(1).describe('Context DB path for linked evidence.'),
                    evidenceCacheRowId: z.number().int().positive().describe('Evidence cache row id.'),
                  })
                  .strict(),
              )
              .describe('Evidence cache references linked to the decision.'),
          })
          .strict(),
      )
      .describe('Gate decisions in audit order, newest first.'),
  })
  .strict()
  .describe('Output for `plaited kanban` decision audit mode.')

const KanbanInitDbOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates database initialization succeeded.'),
    mode: z.literal(KANBAN_MODES.initDb).describe('Echoes init-db mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
  })
  .strict()
  .describe('Output for `plaited kanban` init-db mode.')

const KanbanRecordRedApprovalOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates red approval recording succeeded.'),
    mode: z.literal(KANBAN_MODES.recordRedApproval).describe('Echoes record-red-approval mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    decision: z.enum(['approved', 'rejected']).describe('Recorded gate decision.'),
    reasons: z.array(z.string()).describe('Evaluation reasons for rejection, or empty when approved.'),
  })
  .strict()
  .describe('Output for `plaited kanban` record-red-approval mode.')

const KanbanRevokeStaleRedApprovalOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates stale red revocation evaluation succeeded.'),
    mode: z.literal(KANBAN_MODES.revokeStaleRedApproval).describe('Echoes revoke-stale-red-approval mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    revoked: z.boolean().describe('True when a revocation decision was persisted.'),
    reason: z.string().min(1).describe('Revocation or no-op reason.'),
  })
  .strict()
  .describe('Output for `plaited kanban` revoke-stale-red-approval mode.')

const KanbanRecordFrontierVerificationOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates frontier verification recording succeeded.'),
    mode: z.literal(KANBAN_MODES.recordFrontierVerification).describe('Echoes record-frontier-verification mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    decision: z.enum(['approved', 'rejected']).describe('Recorded gate decision.'),
    verifyStatus: z.enum(['verified', 'failed', 'truncated']).describe('Behavioral-frontier verification status.'),
    failureCategories: z.array(z.enum(FRONTIER_FAILURE_CATEGORY_VALUES)).describe('Frontier failure categories.'),
    checkRunId: z.string().min(1).describe('Persisted check run id.'),
    escalationHints: z
      .object({
        dependencyDeadlockCount: z.number().int().nonnegative().describe('Deadlock count for escalation evaluation.'),
      })
      .strict()
      .describe('Hints for follow-up escalation evaluation.'),
  })
  .strict()
  .describe('Output for `plaited kanban` record-frontier-verification mode.')

const KanbanRecordMergeSimulationOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates merge simulation recording succeeded.'),
    mode: z.literal(KANBAN_MODES.recordMergeSimulation).describe('Echoes record-merge-simulation mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    decision: z.enum(['approved', 'rejected']).describe('Recorded gate decision.'),
    failureCategories: z.array(z.enum(MERGE_FAILURE_CATEGORY_VALUES)).describe('Merge simulation failure categories.'),
    checkRunId: z.string().min(1).describe('Persisted check run id.'),
    commitRefs: z
      .object({
        sourceHeadSha: z.string().min(1).nullable().describe('Source ref HEAD SHA when resolved.'),
        targetHeadSha: z.string().min(1).nullable().describe('Target ref HEAD SHA when resolved.'),
      })
      .strict()
      .describe('Git commit refs captured for the simulation.'),
  })
  .strict()
  .describe('Output for `plaited kanban` record-merge-simulation mode.')

const KanbanRecordEscalationOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates escalation evaluation succeeded.'),
    mode: z.literal(KANBAN_MODES.recordEscalation).describe('Echoes record-escalation mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    triggered: z.boolean().describe('True when escalation triggers were recorded.'),
    triggers: z.array(z.string().min(1)).describe('Escalation trigger ids.'),
    targetAuthority: z.enum(['agent', 'user']).describe('Authority lane selected for escalation.'),
  })
  .strict()
  .describe('Output for `plaited kanban` record-escalation mode.')

const KanbanStartExecutionOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates execution start succeeded.'),
    mode: z.literal(KANBAN_MODES.startExecution).describe('Echoes start-execution mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    branchRef: z.string().min(1).describe('Created execution branch ref.'),
    worktreePath: z.string().min(1).describe('Created execution worktree path.'),
    targetRef: z.string().min(1).describe('Execution target ref.'),
  })
  .strict()
  .describe('Output for `plaited kanban` start-execution mode.')

const KanbanRunPostMergeCleanupOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates post-merge cleanup succeeded.'),
    mode: z.literal(KANBAN_MODES.runPostMergeCleanup).describe('Echoes run-post-merge-cleanup mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    status: z.enum(['cleanup_pending', 'cleaned']).describe('Resulting cleanup lifecycle status.'),
    branchRef: z.string().min(1).describe('Execution branch ref.'),
    worktreePath: z.string().min(1).describe('Execution worktree path.'),
    targetRef: z.string().min(1).describe('Execution target ref.'),
    branchPruneAfterAt: z.string().min(1).describe('Scheduled branch prune timestamp.'),
    worktreeRemovedAt: z.string().min(1).nullable().describe('Worktree removal timestamp.'),
    branchPrunedAt: z.string().min(1).nullable().describe('Branch prune timestamp.'),
  })
  .strict()
  .describe('Output for `plaited kanban` run-post-merge-cleanup mode.')

export const KanbanCliOutputSchema = z
  .discriminatedUnion('mode', [
    KanbanBoardOutputSchema,
    KanbanItemOutputSchema,
    KanbanReadyQueueOutputSchema,
    KanbanDecisionAuditOutputSchema,
    KanbanInitDbOutputSchema,
    KanbanRecordRedApprovalOutputSchema,
    KanbanRevokeStaleRedApprovalOutputSchema,
    KanbanRecordFrontierVerificationOutputSchema,
    KanbanRecordMergeSimulationOutputSchema,
    KanbanRecordEscalationOutputSchema,
    KanbanStartExecutionOutputSchema,
    KanbanRunPostMergeCleanupOutputSchema,
  ])
  .describe('Output for the `plaited kanban` agent-facing kanban command.')

export type KanbanCliOutput = z.output<typeof KanbanCliOutputSchema>

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
