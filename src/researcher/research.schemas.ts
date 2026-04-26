import * as z from 'zod'
import { SnapshotMessageSchema, WorkerSnapshotSchema } from '../behavioral.ts'
import {
  DEFAULT_RESEARCH_CONSUMER_WORKER_ID,
  DEFAULT_RESEARCH_CONTEXT_WORKER_ID,
  DEFAULT_RESEARCH_OBSERVATION_PATH,
  DEFAULT_RESEARCH_REVIEW_WORKER_ID,
  DEFAULT_RESEARCH_TIMEOUT_MS,
  RESEARCH_EVENTS,
} from './research.constants.ts'

export const ContextCitationSchema = z
  .object({
    kind: z
      .enum(['doc', 'skill', 'source', 'test', 'other'])
      .describe('Citation kind used by Model A context assembly.'),
    reference: z.string().describe('Path, URL, symbol, or identifier for the cited artifact.'),
    note: z.string().optional().describe('Optional note explaining why this citation matters.'),
  })
  .describe('Single context citation entry.')

export const ContextProvenanceSchema = z
  .object({
    source: z.string().describe('Origin of the context claim, such as file, test, or model trajectory.'),
    evidence: z.string().optional().describe('Optional short evidence excerpt or pointer.'),
    confidence: z.number().min(0).max(1).optional().describe('Optional confidence score between 0 and 1.'),
  })
  .describe('Provenance record for context claims.')

export const ContextPacketSchema = z
  .object({
    summary: z.string().describe('Short summary of the assembled context.'),
    filesToRead: z.array(z.string()).describe('Repository paths that Model B should prioritize.'),
    symbolsOrTargets: z.array(z.string()).describe('Symbols, modules, tests, or targets relevant to the task.'),
    citedDocsSkills: z.array(ContextCitationSchema).describe('Docs or skills cited during context assembly.'),
    claims: z.array(z.string()).describe('Core claims Model A believes are true from gathered context.'),
    rationale: z.string().describe('Why this packet is sufficient and what tradeoffs were made.'),
    openQuestions: z.array(z.string()).describe('Unknowns requiring explicit handling or assumptions.'),
    suggestedChecks: z.array(z.string()).describe('Suggested tests or checks to run for verification.'),
    provenance: z.array(ContextProvenanceSchema).describe('Provenance records supporting the claims.'),
    review: z.string().optional().describe('Model A short review for Model B and grader consumption.'),
  })
  .describe('Structured context packet produced by Model A.')

export type ContextPacket = z.output<typeof ContextPacketSchema>

export const ResearchConsumerResultSchema = z
  .object({
    finalText: z.string().describe('Model B final answer text.'),
    filesWritten: z.array(z.string()).describe('Files Model B claims to have written or modified.'),
    executionOutput: z.string().optional().describe('Optional execution command output summary.'),
    testOutput: z.string().optional().describe('Optional test output summary.'),
    structuredOutcome: z
      .record(z.string(), z.json())
      .optional()
      .describe('Optional extra machine-readable result detail from Model B.'),
  })
  .describe('Structured output packet produced by Model B.')

export type ResearchConsumerResult = z.output<typeof ResearchConsumerResultSchema>

export const ResearchGradeSchema = z
  .object({
    pass: z.boolean().describe('Whether the fixed grader considers the output acceptable.'),
    score: z.number().min(0).max(1).describe('Primary scalar score for first-pass researcher decisions.'),
    reasoning: z.string().describe('Short deterministic explanation for grade outcome.'),
    outcome: z.record(z.string(), z.json()).optional().describe('Optional structured grading diagnostics.'),
  })
  .describe('Fixed researcher grader output.')

export type ResearchGrade = z.output<typeof ResearchGradeSchema>

export const FileStateSnapshotSchema = z
  .object({
    exists: z.boolean(),
    sizeBytes: z.number().int().nonnegative().optional(),
    modifiedMs: z.number().nonnegative().optional(),
  })
  .describe('Observed file state snapshot for write-evidence checks.')

export type FileStateSnapshot = z.output<typeof FileStateSnapshotSchema>

export const ClaimedFileWriteEvidenceSchema = z
  .object({
    path: z.string(),
    absolutePath: z.string(),
    withinCwd: z.boolean(),
    before: FileStateSnapshotSchema,
    after: FileStateSnapshotSchema,
    createdDuringRun: z.boolean(),
    modifiedDuringRun: z.boolean(),
    changedDuringRun: z.boolean(),
  })
  .describe('Run-scoped evidence for one claimed file path from Model B output.')

export type ClaimedFileWriteEvidence = z.output<typeof ClaimedFileWriteEvidenceSchema>

export const FileWriteEvidenceSummarySchema = z
  .object({
    claimedFilesCount: z.number().int().nonnegative(),
    checkedFilesCount: z.number().int().nonnegative(),
    claimedFilesWithinCwdCount: z.number().int().nonnegative(),
    claimedFilesChangedDuringRunCount: z.number().int().nonnegative(),
    files: z.array(ClaimedFileWriteEvidenceSchema),
  })
  .describe('Run-scoped file-change evidence derived from before/after workspace state.')

export type FileWriteEvidenceSummary = z.output<typeof FileWriteEvidenceSummarySchema>

export const ResearchTaskDetailSchema = z
  .object({
    task: z.string(),
    cwd: z.string(),
    contextWorkerId: z.string(),
    consumerWorkerId: z.string(),
    reviewWorkerId: z.string(),
    timeoutMs: z.number().int().positive(),
    observationPath: z.string(),
    contextWorkerEntrypoint: z.string(),
    consumerWorkerEntrypoint: z.string(),
    reviewWorkerEntrypoint: z.string(),
  })
  .describe('Detail payload for research_task orchestration kickoff.')

export type ResearchTaskDetail = z.output<typeof ResearchTaskDetailSchema>

export const WorkerSetupDetailSchema = z
  .object({
    workerId: z.string(),
  })
  .describe('Worker setup request detail.')

export const WorkerRunDetailSchema = z
  .object({
    workerId: z.string(),
    prompt: z.string(),
    cwd: z.string(),
  })
  .describe('Worker run request detail.')

export const WorkerResultDetailSchema = z
  .object({
    workerId: z.string(),
    sessionId: z.string(),
    rawOutput: z.string(),
  })
  .describe('Worker run result detail.')

export const GradeRequestDetailSchema = z
  .object({
    task: z.string(),
  })
  .describe('Grade request detail payload.')

export const GradeResultDetailSchema = z
  .object({
    grade: ResearchGradeSchema,
  })
  .describe('Grade result event detail payload.')

export const ObservationWriteDetailSchema = z
  .object({
    reason: z.enum(['success', 'error']),
    stage: z.string().optional(),
  })
  .describe('Observation write request detail payload.')

export const ResearchDoneDetailSchema = z
  .object({
    observationId: z.string(),
    observationPath: z.string(),
  })
  .describe('Final success event detail.')

export const ResearchErrorDetailSchema = z
  .object({
    stage: z.string(),
    error: z.string(),
    observationId: z.string().optional(),
    observationPath: z.string().optional(),
  })
  .describe('Final error event detail.')

export const ResearchObservationSchema = z
  .object({
    observationId: z.string(),
    timestamp: z.string(),
    durationMs: z.number().int().nonnegative(),
    task: z.string(),
    status: z.enum(['done', 'error']),
    contextPacket: ContextPacketSchema.optional(),
    contextRawOutput: z.string().optional(),
    modelAReview: z.string().optional(),
    consumerResult: ResearchConsumerResultSchema.optional(),
    consumerRawOutput: z.string().optional(),
    fileWriteEvidence: FileWriteEvidenceSummarySchema.optional(),
    grade: ResearchGradeSchema.optional(),
    traces: z.object({
      behavioralSnapshots: z.array(SnapshotMessageSchema),
      contextWorkerSnapshots: z.array(WorkerSnapshotSchema),
      reviewWorkerSnapshots: z.array(WorkerSnapshotSchema),
      consumerWorkerSnapshots: z.array(WorkerSnapshotSchema),
      modelASessionIds: z
        .object({
          context: z.string().optional(),
          review: z.string().optional(),
        })
        .optional(),
      consumerSessionId: z.string().optional(),
    }),
    error: z
      .object({
        stage: z.string(),
        message: z.string(),
      })
      .optional(),
    meta: z.object({
      contextWorkerId: z.string(),
      consumerWorkerId: z.string(),
      reviewWorkerId: z.string(),
      contextWorkerEntrypoint: z.string(),
      consumerWorkerEntrypoint: z.string(),
      reviewWorkerEntrypoint: z.string(),
      observationPath: z.string(),
    }),
  })
  .describe('Durable append-only researcher observation row.')

export type ResearchObservation = z.output<typeof ResearchObservationSchema>

export const ResearchCliInputSchema = z
  .object({
    task: z.string().describe('Research task prompt used by Model A and Model B.'),
    cwd: z.string().optional().describe('Working directory forwarded to worker run payloads.'),
    contextWorkerId: z
      .string()
      .optional()
      .default(DEFAULT_RESEARCH_CONTEXT_WORKER_ID)
      .describe('Worker id used for context assembly worker setup and traces.'),
    consumerWorkerId: z
      .string()
      .optional()
      .default(DEFAULT_RESEARCH_CONSUMER_WORKER_ID)
      .describe('Worker id used for consumer output worker setup and traces.'),
    reviewWorkerId: z
      .string()
      .optional()
      .default(DEFAULT_RESEARCH_REVIEW_WORKER_ID)
      .describe('Worker id used for Model A review worker setup and traces.'),
    observationPath: z
      .string()
      .optional()
      .default(DEFAULT_RESEARCH_OBSERVATION_PATH)
      .describe('JSONL append path for durable observation rows.'),
    timeoutMs: z
      .number()
      .int()
      .positive()
      .optional()
      .default(DEFAULT_RESEARCH_TIMEOUT_MS)
      .describe('Timeout for each worker run completion wait in milliseconds.'),
    contextWorkerEntrypoint: z
      .string()
      .optional()
      .describe('Explicit worker entrypoint path for Model A context assembly runs.'),
    consumerWorkerEntrypoint: z
      .string()
      .optional()
      .describe('Explicit worker entrypoint path for Model B consumer runs.'),
    reviewWorkerEntrypoint: z.string().optional().describe('Explicit worker entrypoint path for Model A review runs.'),
  })
  .describe('Input for researcher first-pass loop: context model, consumer model, grading, and observation write.')

export type ResearchCliInput = z.input<typeof ResearchCliInputSchema>

export const ResearchCliOutputSchema = z
  .object({
    status: z.enum(['done', 'error']).describe('Final researcher terminal status.'),
    observationId: z.string().describe('Observation row id persisted to JSONL output.'),
    observationPath: z.string().describe('JSONL path containing the durable observation row.'),
    durationMs: z.number().int().nonnegative().describe('Total elapsed duration for the research run.'),
    contextPacket: ContextPacketSchema.optional().describe(
      'Parsed context packet from Model A output, when available.',
    ),
    modelAReview: z.string().optional().describe('Model A review over Model B output, when available.'),
    consumerResult: ResearchConsumerResultSchema.optional().describe(
      'Parsed Model B structured output, when available.',
    ),
    fileWriteEvidence: FileWriteEvidenceSummarySchema.optional().describe(
      'Run-scoped before/after file evidence for claimed writes.',
    ),
    grade: ResearchGradeSchema.optional().describe('Fixed grader output when grading completed.'),
    error: ResearchErrorDetailSchema.optional().describe('Error detail when terminal status is error.'),
  })
  .describe('Output for researcher first-pass loop.')

export type ResearchCliOutput = z.output<typeof ResearchCliOutputSchema>

export const ResearchEventDetailSchemas = {
  [RESEARCH_EVENTS.research_task]: ResearchTaskDetailSchema,
  [RESEARCH_EVENTS.context_worker_setup]: WorkerSetupDetailSchema,
  [RESEARCH_EVENTS.context_worker_run]: WorkerRunDetailSchema,
  [RESEARCH_EVENTS.context_worker_result]: WorkerResultDetailSchema,
  [RESEARCH_EVENTS.consumer_worker_setup]: WorkerSetupDetailSchema,
  [RESEARCH_EVENTS.consumer_worker_run]: WorkerRunDetailSchema,
  [RESEARCH_EVENTS.consumer_worker_result]: WorkerResultDetailSchema,
  [RESEARCH_EVENTS.grade_request]: GradeRequestDetailSchema,
  [RESEARCH_EVENTS.grade_result]: GradeResultDetailSchema,
  [RESEARCH_EVENTS.observation_write]: ObservationWriteDetailSchema,
  [RESEARCH_EVENTS.research_done]: ResearchDoneDetailSchema,
  [RESEARCH_EVENTS.research_error]: ResearchErrorDetailSchema,
}
