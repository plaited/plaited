import * as z from 'zod'

import { BPEventSchema, FrontierSnapshotSchema, SnapshotMessageSchema, SpecSchema } from '../behavioral.ts'
import {
  BEHAVIORAL_FRONTIER_MODES,
  BEHAVIORAL_FRONTIER_SELECTION_POLICIES,
  BEHAVIORAL_FRONTIER_STRATEGIES,
  BEHAVIORAL_FRONTIER_VERIFY_STATUSES,
} from './behavioral-frontier.constants.ts'

const StrategySchema = z.enum([BEHAVIORAL_FRONTIER_STRATEGIES.bfs, BEHAVIORAL_FRONTIER_STRATEGIES.dfs])

const SelectionPolicySchema = z.enum([
  BEHAVIORAL_FRONTIER_SELECTION_POLICIES['all-enabled'],
  BEHAVIORAL_FRONTIER_SELECTION_POLICIES.scheduler,
])

const SnapshotMessagesSchema = z.array(SnapshotMessageSchema)

const ExploreOptionsShape = {
  snapshotMessages: SnapshotMessagesSchema.optional(),
  triggers: z.array(BPEventSchema).optional(),
  strategy: StrategySchema.optional(),
  selectionPolicy: SelectionPolicySchema.optional(),
  maxDepth: z.number().int().nonnegative().optional(),
}

const ReplayInlineInputSchema = z.strictObject({
  mode: z.literal(BEHAVIORAL_FRONTIER_MODES.replay),
  specs: z.array(SpecSchema),
  snapshotMessages: SnapshotMessagesSchema.optional(),
})

const ReplaySpecPathInputSchema = z.strictObject({
  mode: z.literal(BEHAVIORAL_FRONTIER_MODES.replay),
  specPath: z.string(),
  cwd: z.string().optional(),
  snapshotMessages: SnapshotMessagesSchema.optional(),
})

const ExploreInlineInputSchema = z.strictObject({
  mode: z.literal(BEHAVIORAL_FRONTIER_MODES.explore),
  specs: z.array(SpecSchema),
  ...ExploreOptionsShape,
})

const ExploreSpecPathInputSchema = z.strictObject({
  mode: z.literal(BEHAVIORAL_FRONTIER_MODES.explore),
  specPath: z.string(),
  cwd: z.string().optional(),
  ...ExploreOptionsShape,
})

const VerifyInlineInputSchema = z.strictObject({
  mode: z.literal(BEHAVIORAL_FRONTIER_MODES.verify),
  specs: z.array(SpecSchema),
  ...ExploreOptionsShape,
})

const VerifySpecPathInputSchema = z.strictObject({
  mode: z.literal(BEHAVIORAL_FRONTIER_MODES.verify),
  specPath: z.string(),
  cwd: z.string().optional(),
  ...ExploreOptionsShape,
})

export const BehavioralFrontierInputSchema = z
  .union([
    ReplayInlineInputSchema,
    ReplaySpecPathInputSchema,
    ExploreInlineInputSchema,
    ExploreSpecPathInputSchema,
    VerifyInlineInputSchema,
    VerifySpecPathInputSchema,
  ])
  .describe('Replay, explore, or verify behavioral frontiers from snapshotMessages plus inline specs or specPath.')

export type BehavioralFrontierInput = z.infer<typeof BehavioralFrontierInputSchema>

const FrontierTraceSchema = z.strictObject({
  snapshotMessages: SnapshotMessagesSchema,
})

const DeadlockFindingSchema = z.strictObject({
  code: z.literal('deadlock'),
  snapshotMessages: SnapshotMessagesSchema,
})

const ExploreReportSchema = z.strictObject({
  strategy: StrategySchema,
  selectionPolicy: SelectionPolicySchema,
  visitedCount: z.number().int().nonnegative(),
  findingCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
  maxDepth: z.number().int().nonnegative().optional(),
})

const ReplayOutputSchema = z.strictObject({
  mode: z.literal(BEHAVIORAL_FRONTIER_MODES.replay),
  snapshotMessages: SnapshotMessagesSchema,
  frontier: FrontierSnapshotSchema,
})

const ExploreOutputSchema = z.strictObject({
  mode: z.literal(BEHAVIORAL_FRONTIER_MODES.explore),
  traces: z.array(FrontierTraceSchema),
  findings: z.array(DeadlockFindingSchema),
  report: ExploreReportSchema,
})

const VerifyOutputSchema = z.strictObject({
  mode: z.literal(BEHAVIORAL_FRONTIER_MODES.verify),
  status: z.enum([
    BEHAVIORAL_FRONTIER_VERIFY_STATUSES.verified,
    BEHAVIORAL_FRONTIER_VERIFY_STATUSES.failed,
    BEHAVIORAL_FRONTIER_VERIFY_STATUSES.truncated,
  ]),
  findings: z.array(DeadlockFindingSchema),
  report: ExploreReportSchema,
})

export const BehavioralFrontierOutputSchema = z
  .discriminatedUnion('mode', [ReplayOutputSchema, ExploreOutputSchema, VerifyOutputSchema])
  .describe('Direct behavioral-frontier output shapes.')

export type BehavioralFrontierOutput = z.infer<typeof BehavioralFrontierOutputSchema>
