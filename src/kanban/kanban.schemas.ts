import * as z from 'zod'

import { KANBAN_MODES, WORK_ITEM_LIFECYCLE_STATE_VALUES, WORK_ITEM_LIFECYCLE_STATES } from './kanban.constants.ts'

const WorkItemLifecycleStateSchema = z.enum(WORK_ITEM_LIFECYCLE_STATE_VALUES)

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
  .describe('Shared input for kanban command modes.')

const KanbanActorInputSchema = z.strictObject({
  actorType: z.enum(['agent', 'user', 'system']).describe('Actor type responsible for the operation.'),
  actorId: z.string().min(1).describe('Actor id responsible for the operation.'),
})

const KanbanEvidenceRefInputSchema = z.strictObject({
  contextDbPath: z.string().min(1).describe('Context DB path for linked evidence.'),
  evidenceCacheRowId: z.number().int().positive().describe('Evidence cache row id.'),
})

const KanbanJsonArraySchema = z.array(z.unknown())
const KanbanJsonObjectSchema = z.record(z.string(), z.unknown())

const KanbanBoardInputSchema = KanbanBaseInputSchema.extend({
  mode: z.literal(KANBAN_MODES.board).describe('Projects board/status state for all work items.'),
}).describe('Input for `plaited kanban` board mode.')

const KanbanItemInputSchema = KanbanBaseInputSchema.extend({
  mode: z.literal(KANBAN_MODES.item).describe('Projects one work item in detail.'),
  workItemId: z.string().min(1).describe('Work item id to project.'),
}).describe('Input for `plaited kanban` item mode.')

const KanbanReadyQueueInputSchema = KanbanBaseInputSchema.extend({
  mode: z.literal(KANBAN_MODES.readyQueue).describe('Lists work items in simple actionable lifecycle states.'),
}).describe('Input for `plaited kanban` ready queue mode.')

const KanbanDecisionAuditInputSchema = KanbanBaseInputSchema.extend({
  mode: z.literal(KANBAN_MODES.decisionAudit).describe('Projects decision audit records.'),
  workItemId: z.string().min(1).optional().describe('Optional work item id filter for decisions.'),
  limit: z.number().int().positive().max(500).default(100).describe('Maximum audit rows to return.'),
}).describe('Input for `plaited kanban` decision audit mode.')

const KanbanInitDbInputSchema = KanbanBaseInputSchema.extend({
  mode: z.literal(KANBAN_MODES.initDb).describe('Creates or opens the kanban database and applies baseline schema.'),
}).describe('Input for `plaited kanban` init-db mode.')

const KanbanCreateWorkItemInputSchema = KanbanBaseInputSchema.extend({
  mode: z.literal(KANBAN_MODES.createWorkItem).describe('Creates a durable work item and request row when needed.'),
  requestId: z.string().min(1).describe('Owning request id.'),
  requestSummary: z.string().min(1).describe('Summary to use when the owning request does not already exist.'),
  workItemId: z.string().min(1).describe('Work item id to create.'),
  parentWorkItemId: z.string().min(1).nullable().optional().describe('Optional parent work item id.'),
  title: z.string().min(1).describe('Work item title.'),
  status: WorkItemLifecycleStateSchema.default(WORK_ITEM_LIFECYCLE_STATES.draft).describe('Initial lifecycle state.'),
  specPath: z.string().min(1).nullable().optional().describe('Optional spec artifact path.'),
  specCommitSha: z.string().min(1).nullable().optional().describe('Optional spec commit SHA.'),
  createdAt: CanonicalUtcIsoSchema.optional().describe('Optional deterministic creation timestamp.'),
})
  .merge(KanbanActorInputSchema)
  .describe('Input for `plaited kanban` create-work-item mode.')

const KanbanUpdateWorkItemInputSchema = KanbanBaseInputSchema.extend({
  mode: z.literal(KANBAN_MODES.updateWorkItem).describe('Updates generic work item ledger fields.'),
  workItemId: z.string().min(1).describe('Work item id to update.'),
  parentWorkItemId: z.string().min(1).nullable().optional().describe('Parent work item id, or null to clear it.'),
  title: z.string().min(1).optional().describe('Updated work item title.'),
  status: WorkItemLifecycleStateSchema.optional().describe('Updated lifecycle state.'),
  specPath: z.string().min(1).nullable().optional().describe('Updated spec artifact path, or null to clear it.'),
  specCommitSha: z.string().min(1).nullable().optional().describe('Updated spec commit SHA, or null to clear it.'),
  updatedAt: CanonicalUtcIsoSchema.optional().describe('Optional deterministic update timestamp.'),
}).describe('Input for `plaited kanban` update-work-item mode.')

const KanbanAddDependencyInputSchema = KanbanBaseInputSchema.extend({
  mode: z.literal(KANBAN_MODES.addDependency).describe('Adds a durable work item dependency edge.'),
  workItemId: z.string().min(1).describe('Dependent work item id.'),
  dependsOnWorkItemId: z.string().min(1).describe('Dependency work item id.'),
  createdAt: CanonicalUtcIsoSchema.optional().describe('Optional deterministic creation timestamp.'),
}).describe('Input for `plaited kanban` add-dependency mode.')

const KanbanRecordDiscoveryInputSchema = KanbanBaseInputSchema.extend({
  mode: z.literal(KANBAN_MODES.recordDiscovery).describe('Records a discovery artifact for a work item.'),
  discoveryId: z.string().min(1).describe('Discovery artifact id.'),
  workItemId: z.string().min(1).describe('Owning work item id.'),
  artifactVersion: z.number().int().positive().describe('Monotonic artifact version per work item.'),
  rules: KanbanJsonArraySchema.describe('Discovery rules captured as structured JSON.'),
  examples: KanbanJsonArraySchema.describe('Discovery examples captured as structured JSON.'),
  openQuestions: KanbanJsonArraySchema.describe('Open questions captured as structured JSON.'),
  outOfScope: KanbanJsonArraySchema.describe('Out-of-scope notes captured as structured JSON.'),
  collectedAt: CanonicalUtcIsoSchema.describe('Discovery collection timestamp.'),
  staleAfterAt: CanonicalUtcIsoSchema.describe(
    'Timestamp after which the artifact should be considered stale by policy owners.',
  ),
}).describe('Input for `plaited kanban` record-discovery mode.')

const KanbanRecordDecisionInputSchema = KanbanBaseInputSchema.extend({
  mode: z.literal(KANBAN_MODES.recordDecision).describe('Records a durable decision without evaluating policy.'),
  decisionId: z.string().min(1).describe('Decision id to persist.'),
  workItemId: z.string().min(1).describe('Work item id being evaluated.'),
  decisionKind: z.string().min(1).describe('Caller-owned decision kind.'),
  decision: z.enum(['approved', 'rejected']).describe('Recorded decision outcome.'),
  reason: z.string().min(1).describe('Reason preserved in the decision audit trail.'),
  evidenceRefs: z.array(KanbanEvidenceRefInputSchema).default([]).describe('Context evidence cache references.'),
  decidedAt: CanonicalUtcIsoSchema.optional().describe('Optional deterministic decision timestamp.'),
})
  .merge(KanbanActorInputSchema)
  .describe('Input for `plaited kanban` record-decision mode.')

const KanbanRecordEventInputSchema = KanbanBaseInputSchema.extend({
  mode: z.literal(KANBAN_MODES.recordEvent).describe('Appends a generic work item event.'),
  eventId: z.string().min(1).optional().describe('Optional event id. A random UUID is generated when omitted.'),
  workItemId: z.string().min(1).describe('Owning work item id.'),
  eventKind: z.string().min(1).describe('Caller-owned event kind.'),
  payload: KanbanJsonObjectSchema.default({}).describe('Structured event payload.'),
  occurredAt: CanonicalUtcIsoSchema.optional().describe('Optional deterministic event timestamp.'),
}).describe('Input for `plaited kanban` record-event mode.')

/**
 * JSON input schema for the durable `plaited kanban` ledger command.
 */
export const KanbanCliInputSchema = z
  .discriminatedUnion('mode', [
    KanbanBoardInputSchema,
    KanbanItemInputSchema,
    KanbanReadyQueueInputSchema,
    KanbanDecisionAuditInputSchema,
    KanbanInitDbInputSchema,
    KanbanCreateWorkItemInputSchema,
    KanbanUpdateWorkItemInputSchema,
    KanbanAddDependencyInputSchema,
    KanbanRecordDiscoveryInputSchema,
    KanbanRecordDecisionInputSchema,
    KanbanRecordEventInputSchema,
  ])
  .describe('Input for the `plaited kanban` durable ledger CLI.')

/**
 * Parsed input type accepted by the durable `plaited kanban` ledger command.
 */
export type KanbanCliInput = z.output<typeof KanbanCliInputSchema>

const WorkItemSummaryOutputSchema = z.strictObject({
  id: z.string().min(1).describe('Work item id.'),
  status: WorkItemLifecycleStateSchema.describe('Current lifecycle state.'),
})

const DependencyOutputSchema = z.strictObject({
  id: z.string().min(1).describe('Dependency work item id.'),
  title: z.string().min(1).describe('Dependency work item title.'),
  status: WorkItemLifecycleStateSchema.describe('Dependency lifecycle state.'),
  isResolved: z.boolean().describe('True when the dependency is in the cleaned terminal-success state.'),
})

const DiscoveryArtifactOutputSchema = z.strictObject({
  id: z.string().min(1).describe('Discovery artifact id.'),
  artifactVersion: z.number().int().positive().describe('Artifact version.'),
  rules: KanbanJsonArraySchema.describe('Discovery rules.'),
  examples: KanbanJsonArraySchema.describe('Discovery examples.'),
  openQuestions: KanbanJsonArraySchema.describe('Open questions.'),
  outOfScope: KanbanJsonArraySchema.describe('Out-of-scope notes.'),
  collectedAt: z.string().min(1).describe('Collection timestamp.'),
  staleAfterAt: z.string().min(1).describe('Stale-after timestamp.'),
})

const DecisionOutputSchema = z.strictObject({
  id: z.string().min(1).describe('Decision id.'),
  workItemId: z.string().min(1).describe('Owning work item id.'),
  decisionKind: z.string().min(1).describe('Caller-owned decision kind.'),
  decision: z.enum(['approved', 'rejected']).describe('Decision outcome.'),
  actorType: z.enum(['agent', 'user', 'system']).describe('Decision actor type.'),
  actorId: z.string().min(1).describe('Decision actor id.'),
  reason: z.string().min(1).describe('Decision reason.'),
  decidedAt: z.string().min(1).describe('Decision timestamp.'),
  evidenceRefs: z.array(KanbanEvidenceRefInputSchema).describe('Linked evidence refs.'),
})

const EventOutputSchema = z.strictObject({
  id: z.string().min(1).describe('Event id.'),
  eventKind: z.string().min(1).describe('Event kind.'),
  payload: KanbanJsonObjectSchema.describe('Event payload.'),
  occurredAt: z.string().min(1).describe('Event occurrence timestamp.'),
})

const KanbanBoardOutputSchema = z
  .strictObject({
    ok: z.literal(true).describe('Indicates board projection succeeded.'),
    mode: z.literal(KANBAN_MODES.board).describe('Echoes board mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    states: z
      .array(
        z.strictObject({
          state: WorkItemLifecycleStateSchema.describe('Lifecycle state bucket.'),
          total: z.number().int().nonnegative().describe('Number of work items in this state.'),
          items: z
            .array(
              z.strictObject({
                id: z.string().min(1).describe('Work item id.'),
                unresolvedDependencyCount: z
                  .number()
                  .int()
                  .nonnegative()
                  .describe('Count of unresolved dependencies for the work item.'),
              }),
            )
            .describe('Work items in this state, ordered deterministically.'),
        }),
      )
      .describe('Board buckets grouped by lifecycle state.'),
    blockers: z
      .array(
        z.strictObject({
          workItemId: z.string().min(1).describe('Blocked work item id.'),
          unresolvedDependencies: z
            .array(z.strictObject({ id: z.string().min(1), status: WorkItemLifecycleStateSchema }))
            .describe('Unresolved dependency rows.'),
        }),
      )
      .describe('Work items that have unresolved dependencies.'),
  })
  .describe('Output for `plaited kanban` board mode.')

const KanbanItemOutputSchema = z
  .strictObject({
    ok: z.literal(true).describe('Indicates item projection succeeded.'),
    mode: z.literal(KANBAN_MODES.item).describe('Echoes item mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    item: z.strictObject({
      id: z.string().min(1).describe('Work item id.'),
      requestId: z.string().min(1).describe('Owning request id.'),
      parentWorkItemId: z.string().min(1).nullable().describe('Parent work item id.'),
      title: z.string().min(1).describe('Work item title.'),
      status: WorkItemLifecycleStateSchema.describe('Current lifecycle state.'),
      specPath: z.string().min(1).nullable().describe('Tracked spec path when present.'),
      specCommitSha: z.string().min(1).nullable().describe('Tracked spec commit SHA when present.'),
      dependencies: z.array(DependencyOutputSchema).describe('Dependency work items for this item.'),
      latestDiscovery: DiscoveryArtifactOutputSchema.nullable().describe('Latest discovery artifact, when present.'),
      latestDecisions: z.array(DecisionOutputSchema).describe('Latest decisions for the work item, newest first.'),
      events: z.array(EventOutputSchema).describe('Latest events for the work item, newest first.'),
    }),
  })
  .describe('Output for `plaited kanban` item mode.')

const KanbanReadyQueueOutputSchema = z
  .strictObject({
    ok: z.literal(true).describe('Indicates ready queue projection succeeded.'),
    mode: z.literal(KANBAN_MODES.readyQueue).describe('Echoes ready queue mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    readyItems: z
      .array(
        z.strictObject({
          workItemId: z.string().min(1).describe('Actionable work item id.'),
          title: z.string().min(1).describe('Actionable work item title.'),
          status: WorkItemLifecycleStateSchema.describe('Current lifecycle state.'),
        }),
      )
      .describe('Deterministically ordered items in simple actionable statuses.'),
  })
  .describe('Output for `plaited kanban` ready queue mode.')

const KanbanDecisionAuditOutputSchema = z
  .strictObject({
    ok: z.literal(true).describe('Indicates decision audit projection succeeded.'),
    mode: z.literal(KANBAN_MODES.decisionAudit).describe('Echoes decision audit mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    decisions: z.array(DecisionOutputSchema).describe('Decisions in audit order, newest first.'),
  })
  .describe('Output for `plaited kanban` decision audit mode.')

const KanbanInitDbOutputSchema = z
  .strictObject({
    ok: z.literal(true).describe('Indicates database initialization succeeded.'),
    mode: z.literal(KANBAN_MODES.initDb).describe('Echoes init-db mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
  })
  .describe('Output for `plaited kanban` init-db mode.')

const KanbanCreateWorkItemOutputSchema = z
  .strictObject({
    ok: z.literal(true).describe('Indicates work item creation succeeded.'),
    mode: z.literal(KANBAN_MODES.createWorkItem).describe('Echoes create-work-item mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    workItem: WorkItemSummaryOutputSchema.describe('Created work item summary.'),
  })
  .describe('Output for `plaited kanban` create-work-item mode.')

const KanbanUpdateWorkItemOutputSchema = z
  .strictObject({
    ok: z.literal(true).describe('Indicates work item update succeeded.'),
    mode: z.literal(KANBAN_MODES.updateWorkItem).describe('Echoes update-work-item mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    workItem: WorkItemSummaryOutputSchema.describe('Updated work item summary.'),
  })
  .describe('Output for `plaited kanban` update-work-item mode.')

const KanbanAddDependencyOutputSchema = z
  .strictObject({
    ok: z.literal(true).describe('Indicates dependency creation succeeded.'),
    mode: z.literal(KANBAN_MODES.addDependency).describe('Echoes add-dependency mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    dependency: z.strictObject({
      workItemId: z.string().min(1).describe('Dependent work item id.'),
      dependsOnWorkItemId: z.string().min(1).describe('Dependency work item id.'),
    }),
  })
  .describe('Output for `plaited kanban` add-dependency mode.')

const KanbanRecordDiscoveryOutputSchema = z
  .strictObject({
    ok: z.literal(true).describe('Indicates discovery recording succeeded.'),
    mode: z.literal(KANBAN_MODES.recordDiscovery).describe('Echoes record-discovery mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    discovery: z.strictObject({
      id: z.string().min(1).describe('Discovery artifact id.'),
      workItemId: z.string().min(1).describe('Owning work item id.'),
      artifactVersion: z.number().int().positive().describe('Artifact version.'),
    }),
  })
  .describe('Output for `plaited kanban` record-discovery mode.')

const KanbanRecordDecisionOutputSchema = z
  .strictObject({
    ok: z.literal(true).describe('Indicates decision recording succeeded.'),
    mode: z.literal(KANBAN_MODES.recordDecision).describe('Echoes record-decision mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    decision: DecisionOutputSchema.describe('Recorded decision.'),
  })
  .describe('Output for `plaited kanban` record-decision mode.')

const KanbanRecordEventOutputSchema = z
  .strictObject({
    ok: z.literal(true).describe('Indicates event recording succeeded.'),
    mode: z.literal(KANBAN_MODES.recordEvent).describe('Echoes record-event mode.'),
    dbPath: z.string().min(1).describe('Normalized absolute kanban database path.'),
    event: z.strictObject({
      id: z.string().min(1).describe('Event id.'),
      workItemId: z.string().min(1).describe('Owning work item id.'),
      eventKind: z.string().min(1).describe('Event kind.'),
    }),
  })
  .describe('Output for `plaited kanban` record-event mode.')

/**
 * JSON output schema for all `plaited kanban` read and write modes.
 */
export const KanbanCliOutputSchema = z
  .discriminatedUnion('mode', [
    KanbanBoardOutputSchema,
    KanbanItemOutputSchema,
    KanbanReadyQueueOutputSchema,
    KanbanDecisionAuditOutputSchema,
    KanbanInitDbOutputSchema,
    KanbanCreateWorkItemOutputSchema,
    KanbanUpdateWorkItemOutputSchema,
    KanbanAddDependencyOutputSchema,
    KanbanRecordDiscoveryOutputSchema,
    KanbanRecordDecisionOutputSchema,
    KanbanRecordEventOutputSchema,
  ])
  .describe('Output for the `plaited kanban` durable ledger CLI.')

/**
 * Parsed output type returned by the durable `plaited kanban` ledger command.
 */
export type KanbanCliOutput = z.output<typeof KanbanCliOutputSchema>
