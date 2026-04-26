import * as z from 'zod'
import { WorkerSnapshotSchema } from '../behavioral.ts'
import {
  ContextPacketSchema,
  FileWriteEvidenceSummarySchema,
  ResearchConsumerResultSchema,
} from './research.schemas.ts'

export const ResearchGraderInputSchema = z.object({
  task: z.string(),
  contextPacket: ContextPacketSchema,
  consumerResult: ResearchConsumerResultSchema,
  modelAReview: z.string().optional(),
  contextWorkerSnapshots: z.array(WorkerSnapshotSchema),
  reviewWorkerSnapshots: z.array(WorkerSnapshotSchema),
  consumerWorkerSnapshots: z.array(WorkerSnapshotSchema),
  fileWriteEvidence: FileWriteEvidenceSummarySchema,
})

export type ResearchGraderInput = z.output<typeof ResearchGraderInputSchema>
