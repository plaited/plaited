import * as z from 'zod'

import { PLAN_PROJECTION_MODES, WORK_ITEM_LIFECYCLE_STATE_VALUES } from './plan.constants.ts'

const CanonicalUtcIsoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, {
    message: 'Expected canonical UTC ISO timestamp (YYYY-MM-DDTHH:mm:ss.sssZ).',
  })
  .refine((value) => {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
  }, 'Expected canonical UTC ISO timestamp (YYYY-MM-DDTHH:mm:ss.sssZ).')

const PlanBaseInputSchema = z
  .object({
    dbPath: z.string().min(1).describe('Path to the plan SQLite database to project.'),
  })
  .strict()
  .describe('Shared input for agent-facing plan projection modes.')

const PlanBoardInputSchema = PlanBaseInputSchema.extend({
  mode: z.literal(PLAN_PROJECTION_MODES.board).describe('Projects board/status state for all work items.'),
}).describe('Input for `plaited plan` board mode.')

const PlanItemInputSchema = PlanBaseInputSchema.extend({
  mode: z.literal(PLAN_PROJECTION_MODES.item).describe('Projects one work item in detail.'),
  workItemId: z.string().min(1).describe('Work item id to project.'),
}).describe('Input for `plaited plan` item mode.')

const PlanReadyQueueInputSchema = PlanBaseInputSchema.extend({
  mode: z.literal(PLAN_PROJECTION_MODES.readyQueue).describe('Projects deterministic next actionable items.'),
  nowIso: CanonicalUtcIsoSchema.optional().describe(
    'Optional deterministic projection timestamp. When omitted, time-dependent cleanup completion readiness is not emitted.',
  ),
}).describe('Input for `plaited plan` ready queue mode.')

const PlanDecisionAuditInputSchema = PlanBaseInputSchema.extend({
  mode: z.literal(PLAN_PROJECTION_MODES.decisionAudit).describe('Projects gate decision audit records.'),
  workItemId: z.string().min(1).optional().describe('Optional work item id filter for gate decisions.'),
  limit: z.number().int().positive().max(500).default(100).describe('Maximum audit rows to return.'),
}).describe('Input for `plaited plan` decision audit mode.')

export const PlanCliInputSchema = z
  .discriminatedUnion('mode', [
    PlanBoardInputSchema,
    PlanItemInputSchema,
    PlanReadyQueueInputSchema,
    PlanDecisionAuditInputSchema,
  ])
  .describe('Input for the `plaited plan` agent-facing projection command.')

export type PlanCliInput = z.output<typeof PlanCliInputSchema>

const PlanBoardOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates board projection succeeded.'),
    mode: z.literal(PLAN_PROJECTION_MODES.board).describe('Echoes board mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute plan database path.'),
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
  .describe('Output for `plaited plan` board mode.')

const PlanItemOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates item projection succeeded.'),
    mode: z.literal(PLAN_PROJECTION_MODES.item).describe('Echoes item mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute plan database path.'),
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
  .describe('Output for `plaited plan` item mode.')

const PlanReadyQueueOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates ready queue projection succeeded.'),
    mode: z.literal(PLAN_PROJECTION_MODES.readyQueue).describe('Echoes ready queue mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute plan database path.'),
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
  .describe('Output for `plaited plan` ready queue mode.')

const PlanDecisionAuditOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates decision audit projection succeeded.'),
    mode: z.literal(PLAN_PROJECTION_MODES.decisionAudit).describe('Echoes decision audit mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute plan database path.'),
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
  .describe('Output for `plaited plan` decision audit mode.')

export const PlanCliOutputSchema = z
  .discriminatedUnion('mode', [
    PlanBoardOutputSchema,
    PlanItemOutputSchema,
    PlanReadyQueueOutputSchema,
    PlanDecisionAuditOutputSchema,
  ])
  .describe('Output for the `plaited plan` agent-facing projection command.')

export type PlanCliOutput = z.output<typeof PlanCliOutputSchema>
