import * as z from 'zod'
import {
  BEHAVIORAL_FRONTIER_EVENT_SOURCES,
  BEHAVIORAL_FRONTIER_MODES,
  BEHAVIORAL_FRONTIER_STRATEGIES,
  BEHAVIORAL_FRONTIER_VERIFY_STATUSES,
} from './behavioral-frontier.constants.ts'

const FrontierStatusSchema = z
  .enum(['ready', 'deadlock', 'idle'])
  .describe('Scheduler-facing frontier status after evaluating pending thread requests.')

const JsonDetailSchema = z
  .union([z.json(), z.null()])
  .optional()
  .describe('Optional JSON detail payload associated with an event.')

/**
 * Replay history event accepted by the frontier CLI.
 *
 * @public
 */
export const BehavioralFrontierHistoryEventSchema = z
  .object({
    type: z.string().describe('Event type selected at this replay step.'),
    source: z
      .enum([BEHAVIORAL_FRONTIER_EVENT_SOURCES.trigger, BEHAVIORAL_FRONTIER_EVENT_SOURCES.request])
      .describe('Event provenance used for source-aware listener matching.'),
    detail: JsonDetailSchema,
  })
  .describe('Single replay-history event row for frontier reconstruction.')

const BehavioralFrontierBaseInputSchema = z.object({
  modulePath: z.string().describe('Path to a module that exports replay-safe behavioral thread factories.'),
  exportName: z
    .string()
    .optional()
    .describe('Optional named export to load when the module does not use a default export.'),
  cwd: z
    .string()
    .optional()
    .describe('Optional base directory for resolving modulePath and historyPath (defaults to process.cwd()).'),
})

const BehavioralFrontierReplayInputSchema = BehavioralFrontierBaseInputSchema.extend({
  mode: z.literal(BEHAVIORAL_FRONTIER_MODES.replay),
  history: z
    .array(BehavioralFrontierHistoryEventSchema)
    .optional()
    .describe('Inline replay history. Use either history or historyPath, not both.'),
  historyPath: z.string().optional().describe('Path to replay history file (supports JSON arrays and JSONL rows).'),
}).superRefine((value, ctx) => {
  const hasHistory = Object.hasOwn(value, 'history')
  const hasHistoryPath = Object.hasOwn(value, 'historyPath')
  if (hasHistory && hasHistoryPath) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Specify either history or historyPath for replay mode, not both.',
      path: ['historyPath'],
    })
  }
})

const BehavioralFrontierExploreInputSchema = BehavioralFrontierBaseInputSchema.extend({
  mode: z.literal(BEHAVIORAL_FRONTIER_MODES.explore),
  strategy: z
    .enum([BEHAVIORAL_FRONTIER_STRATEGIES.bfs, BEHAVIORAL_FRONTIER_STRATEGIES.dfs])
    .optional()
    .describe('Frontier traversal order: breadth-first (bfs) or depth-first (dfs). Defaults to bfs.'),
  maxDepth: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Optional maximum replay depth. Histories at this depth are not expanded further.'),
  includeFrontierSummaries: z
    .boolean()
    .optional()
    .describe('When true, include per-history frontier status summaries in output. Defaults to false.'),
})

const BehavioralFrontierVerifyInputSchema = BehavioralFrontierBaseInputSchema.extend({
  mode: z.literal(BEHAVIORAL_FRONTIER_MODES.verify),
  strategy: z
    .enum([BEHAVIORAL_FRONTIER_STRATEGIES.bfs, BEHAVIORAL_FRONTIER_STRATEGIES.dfs])
    .optional()
    .describe('Frontier traversal order used by the verification pass. Defaults to bfs.'),
  maxDepth: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Optional exploration depth cap. Verification reports truncated when capped branches remain.'),
  includeFrontierSummaries: z
    .boolean()
    .optional()
    .describe('When true, include frontier summaries while exploring prior to verification status derivation.'),
})

/**
 * Input schema for `behavioral-frontier`.
 *
 * @public
 */
export const BehavioralFrontierInputSchema = z
  .discriminatedUnion('mode', [
    BehavioralFrontierReplayInputSchema,
    BehavioralFrontierExploreInputSchema,
    BehavioralFrontierVerifyInputSchema,
  ])
  .describe('Input for `behavioral-frontier`: load replay-safe threads from modulePath and run replay/explore/verify.')

/** @public */
export type BehavioralFrontierInput = z.infer<typeof BehavioralFrontierInputSchema>

/** @public */
export type BehavioralFrontierReplayInput = z.infer<typeof BehavioralFrontierReplayInputSchema>

const BehavioralFrontierModuleSchema = z
  .object({
    modulePath: z.string().describe('Module path provided by the caller.'),
    resolvedModulePath: z.string().describe('Absolute module path resolved by the CLI.'),
    exportName: z.string().describe('Export name used to load replay-safe threads.'),
  })
  .describe('Resolved module descriptor used for replay-safe thread loading.')

const BehavioralFrontierCandidateSchema = z
  .object({
    label: z.string().describe('Thread label that emitted the candidate event.'),
    priority: z.number().int().describe('Thread priority used for candidate selection ordering.'),
    source: z
      .enum([BEHAVIORAL_FRONTIER_EVENT_SOURCES.trigger, BEHAVIORAL_FRONTIER_EVENT_SOURCES.request])
      .describe('Candidate provenance (`trigger` ingress or `request` from a thread).'),
    type: z.string().describe('Candidate event type.'),
    detail: JsonDetailSchema,
    ingress: z.boolean().optional().describe('True when candidate originated from ingress replay/trigger flow.'),
  })
  .describe('Stable candidate-event summary exposed by the frontier CLI.')

const BehavioralFrontierSnapshotSchema = z
  .object({
    status: FrontierStatusSchema,
    candidateCount: z.number().int().nonnegative().describe('Total request candidates present in this frontier.'),
    enabledCount: z.number().int().nonnegative().describe('Candidates still enabled after block-listener filtering.'),
    candidates: z.array(BehavioralFrontierCandidateSchema).describe('All request candidates in frontier order.'),
    enabled: z.array(BehavioralFrontierCandidateSchema).describe('Subset of candidates eligible for selection.'),
  })
  .describe('Serializable frontier snapshot used by replay/explore outputs.')

const BehavioralFrontierPendingSummarySchema = z
  .object({
    label: z.string().describe('Thread label currently pending at a synchronization point.'),
    priority: z.number().int().describe('Thread priority retained while pending.'),
    source: z
      .enum([BEHAVIORAL_FRONTIER_EVENT_SOURCES.trigger, BEHAVIORAL_FRONTIER_EVENT_SOURCES.request])
      .describe('Pending thread provenance.'),
    ingress: z.boolean().optional().describe('True when pending thread came from ingress replay/trigger flow.'),
    hasRequest: z.boolean().describe('Whether the pending thread currently requests an event.'),
    requestType: z.string().optional().describe('Requested event type when hasRequest=true.'),
    waitForTypes: z.array(z.string()).describe('waitFor listener event types on this pending thread.'),
    blockTypes: z.array(z.string()).describe('block listener event types on this pending thread.'),
    interruptTypes: z.array(z.string()).describe('interrupt listener event types on this pending thread.'),
  })
  .describe('Stable pending-state summary row for replay diagnostics.')

const BehavioralFrontierFindingSummarySchema = z
  .object({
    candidateCount: z.number().int().nonnegative().describe('Candidate count at deadlock frontier.'),
    enabledCount: z
      .number()
      .int()
      .nonnegative()
      .describe('Enabled-candidate count at deadlock frontier (typically 0).'),
  })
  .describe('Deadlock finding rollup counters.')

const BehavioralFrontierDeadlockFindingSchema = z
  .object({
    code: z.literal('deadlock').describe('Finding code emitted for unreachable selection state.'),
    history: z.array(BehavioralFrontierHistoryEventSchema).describe('Replay history that reconstructs the finding.'),
    status: z.literal('deadlock').describe('Frontier status observed for this finding.'),
    candidates: z
      .array(BehavioralFrontierCandidateSchema)
      .describe('All candidates reconstructed at the finding frontier.'),
    enabled: z
      .array(BehavioralFrontierCandidateSchema)
      .describe('Enabled candidates reconstructed at the finding frontier.'),
    summary: BehavioralFrontierFindingSummarySchema,
  })
  .describe('Deadlock finding reconstructed from replay-safe frontier exploration.')

const BehavioralFrontierReportSchema = z
  .object({
    strategy: z
      .enum([BEHAVIORAL_FRONTIER_STRATEGIES.bfs, BEHAVIORAL_FRONTIER_STRATEGIES.dfs])
      .describe('Traversal strategy used during frontier exploration.'),
    visitedCount: z.number().int().nonnegative().describe('Number of histories replayed during exploration.'),
    findingCount: z.number().int().nonnegative().describe('Number of findings collected during exploration.'),
    truncated: z.boolean().describe('True when expansion stopped early due to maxDepth over a non-terminal frontier.'),
    maxDepth: z.number().int().nonnegative().optional().describe('Applied depth cap when maxDepth is provided.'),
  })
  .describe('Exploration report emitted by explore/verify modes.')

const BehavioralFrontierHistorySummarySchema = z
  .object({
    history: z.array(BehavioralFrontierHistoryEventSchema).describe('History prefix represented by this summary row.'),
    status: FrontierStatusSchema,
  })
  .describe('Optional per-history frontier status summary row.')

const BehavioralFrontierReplayOutputSchema = z
  .object({
    mode: z.literal(BEHAVIORAL_FRONTIER_MODES.replay),
    module: BehavioralFrontierModuleSchema,
    history: z.array(BehavioralFrontierHistoryEventSchema).describe('Effective replay history used by this run.'),
    frontier: BehavioralFrontierSnapshotSchema,
    pendingSummary: z
      .array(BehavioralFrontierPendingSummarySchema)
      .describe('Stable pending-thread summaries reconstructed after replay.'),
  })
  .describe('Replay-mode output for `behavioral-frontier`.')

const BehavioralFrontierExploreOutputSchema = z
  .object({
    mode: z.literal(BEHAVIORAL_FRONTIER_MODES.explore),
    module: BehavioralFrontierModuleSchema,
    report: BehavioralFrontierReportSchema,
    visitedHistories: z
      .array(z.array(BehavioralFrontierHistoryEventSchema))
      .describe('All replay histories visited during exploration.'),
    findings: z.array(BehavioralFrontierDeadlockFindingSchema).describe('Deadlock findings discovered by exploration.'),
    frontierSummaries: z
      .array(BehavioralFrontierHistorySummarySchema)
      .optional()
      .describe('Optional per-history frontier statuses when includeFrontierSummaries=true.'),
  })
  .describe('Explore-mode output for `behavioral-frontier`.')

const BehavioralFrontierVerifyOutputSchema = z
  .object({
    mode: z.literal(BEHAVIORAL_FRONTIER_MODES.verify),
    module: BehavioralFrontierModuleSchema,
    status: z
      .enum([
        BEHAVIORAL_FRONTIER_VERIFY_STATUSES.verified,
        BEHAVIORAL_FRONTIER_VERIFY_STATUSES.failed,
        BEHAVIORAL_FRONTIER_VERIFY_STATUSES.truncated,
      ])
      .describe('Verification status derived from frontier exploration findings/report.'),
    report: BehavioralFrontierReportSchema,
    findings: z
      .array(BehavioralFrontierDeadlockFindingSchema)
      .describe('Deadlock findings used for verification status.'),
    frontierSummaries: z
      .array(BehavioralFrontierHistorySummarySchema)
      .optional()
      .describe('Optional per-history frontier statuses when includeFrontierSummaries=true.'),
  })
  .describe('Verify-mode output for `behavioral-frontier`.')

/**
 * Output schema for `behavioral-frontier`.
 *
 * @public
 */
export const BehavioralFrontierOutputSchema = z
  .discriminatedUnion('mode', [
    BehavioralFrontierReplayOutputSchema,
    BehavioralFrontierExploreOutputSchema,
    BehavioralFrontierVerifyOutputSchema,
  ])
  .describe('Mode-specific structured output for `behavioral-frontier`.')

/** @public */
export type BehavioralFrontierOutput = z.infer<typeof BehavioralFrontierOutputSchema>

/** @public */
export type BehavioralFrontierCandidate = z.infer<typeof BehavioralFrontierCandidateSchema>

/** @public */
export type BehavioralFrontierPendingSummary = z.infer<typeof BehavioralFrontierPendingSummarySchema>

/** @public */
export type BehavioralFrontierDeadlockFinding = z.infer<typeof BehavioralFrontierDeadlockFindingSchema>
