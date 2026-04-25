import * as z from 'zod'
import { WORKER_EVENTS } from './worker.constants.ts'

export const WorkerSetupEventSchema = z.object({
  type: z.literal(WORKER_EVENTS.setup),
  detail: z.object({
    workerId: z.string(),
  }),
})

export type WorkerSetupEventDetail = z.output<typeof WorkerSetupEventSchema>

export const WorkerCancelEventSchema = z.object({
  type: z.literal(WORKER_EVENTS.cancel),
  detail: z.object({
    sessionId: z.string(),
  }),
})

export type WorkerCancelEventDetail = z.output<typeof WorkerCancelEventSchema>

export const WorkerRunEventSchema = z.object({
  type: z.literal(WORKER_EVENTS.run),
  detail: z.object({
    prompt: z.string(),
    cwd: z.string(),
  }),
})

export type WorkerRunEventDetail = z.output<typeof WorkerRunEventSchema>
