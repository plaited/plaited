import * as z from 'zod'
import { BPEventSchema, SnapshotMessageSchema } from '../behavioral.ts'

export const TraceEventSchema = BPEventSchema.extend({
  source: z.string().optional().describe('Optional runtime/source provenance label.'),
  timestamp: z.number().optional().describe('Optional event timestamp (epoch milliseconds).'),
}).describe('Runtime event row captured during post-run analysis.')

export type TraceEvent = z.output<typeof TraceEventSchema>

export const RuntimeOutputSchema = z
  .object({
    kind: z.string().describe('Runtime output/result channel label.'),
    status: z.enum(['ok', 'error']).optional().describe('Optional output status classification.'),
    type: z.string().optional().describe('Optional event or runtime output type label.'),
    detail: z.record(z.string(), z.unknown()).optional().describe('Optional structured runtime payload.'),
    error: z.string().optional().describe('Optional error text associated with this output.'),
    timestamp: z.number().optional().describe('Optional output timestamp (epoch milliseconds).'),
  })
  .describe('Runtime output/result row adjacent to behavioral snapshots.')

export type RuntimeOutput = z.output<typeof RuntimeOutputSchema>

export const PlaitedTraceSchema = z
  .object({
    snapshots: z.array(SnapshotMessageSchema).optional().describe('Behavioral snapshot stream from the concrete run.'),
    selectedEvents: z
      .array(TraceEventSchema)
      .optional()
      .describe('Selected events observed or reconstructed during execution.'),
    emittedEvents: z.array(TraceEventSchema).optional().describe('Adjacent emitted runtime events, if available.'),
    runtimeOutputs: z.array(RuntimeOutputSchema).optional().describe('Adjacent runtime outputs/results/errors.'),
    metadata: z.record(z.string(), z.unknown()).optional().describe('Additional runtime-defined trace metadata.'),
  })
  .describe('Snapshot-native process trace captured for one run.')

export type PlaitedTrace = z.output<typeof PlaitedTraceSchema>

export const ProcessTraceCoverageSchema = z
  .enum(['none', 'snapshots-only', 'events-only', 'snapshots-and-events'])
  .describe('Coverage level of runtime process trace evidence.')

export type ProcessTraceCoverage = z.output<typeof ProcessTraceCoverageSchema>

export const TrialProcessSummarySchema = z
  .object({
    coverage: ProcessTraceCoverageSchema.describe('Coverage level for this trial trace.'),
    snapshotCount: z.number().int().min(0).describe('Total snapshot messages observed.'),
    selectionCount: z.number().int().min(0).describe('Selection snapshot count.'),
    selectedEventCount: z.number().int().min(0).describe('Selected event count from snapshots/events.'),
    emittedEventCount: z.number().int().min(0).describe('Emitted event count when available.'),
    deadlockCount: z.number().int().min(0).describe('Deadlock snapshot count.'),
    feedbackErrorCount: z.number().int().min(0).describe('Feedback error snapshot count.'),
    runtimeErrorCount: z.number().int().min(0).describe('Runtime error count including runner/runtime errors.'),
    runtimeOutputCount: z.number().int().min(0).describe('Runtime outputs/results row count.'),
    runtimeOutputErrorCount: z.number().int().min(0).describe('Runtime output rows classified as errors.'),
    blockedBidCount: z.number().int().min(0).describe('Count of bids with blocker attribution.'),
    interruptedBidCount: z.number().int().min(0).describe('Count of bids with interrupter attribution.'),
    repeatedSelectionCount: z.number().int().min(0).describe('Consecutive same-type selection repeats (loop signal).'),
    maxConsecutiveSelectionTypeCount: z
      .number()
      .int()
      .min(0)
      .describe('Maximum consecutive selections of the same event type.'),
    runnerErrorCount: z.number().int().min(0).describe('Runner-level execution error count.'),
    runnerTimeoutCount: z.number().int().min(0).describe('Runner timeout count.'),
    deadlockDetected: z.boolean().describe('True when any deadlock snapshot is present.'),
    feedbackErrorDetected: z.boolean().describe('True when any feedback error snapshot is present.'),
    runtimeErrorDetected: z.boolean().describe('True when runtime/runner errors are detected.'),
  })
  .describe('Snapshot-native process metrics summary for one trial.')

export type TrialProcessSummary = z.output<typeof TrialProcessSummarySchema>
