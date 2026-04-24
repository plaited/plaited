import * as z from 'zod'
import { SpecSchema } from '../behavioral.ts'
import { WORKER_EVENTS } from './agent.constants.ts'

export const WorkerSetupEventSchema = z.object({
  type: z.literal(WORKER_EVENTS.setup),
  detail: z.object({
    meta: z.object({
      workerId: z.string(),
      name: z.string(),
      description: z.string(),
      cwd: z.string(),
    }),
    socketPath: z.string(),
    specs: z.array(SpecSchema),
  }),
})

export type WorkerSetupEventDetail = z.output<typeof WorkerSetupEventSchema>

export const WorkerGetContextEventSchema = z.object({
  type: z.literal(WORKER_EVENTS.get_context),
  detail: SpecSchema,
})

export type WorkerGetContextEventDetail = z.output<typeof WorkerGetContextEventSchema>

export const WorkerHeartbeatEventSchema = z.object({
  type: z.literal(WORKER_EVENTS.heartbeat),
})

export type WorkerHeartbeatEventDetail = z.output<typeof WorkerHeartbeatEventSchema>

export const WorkerPromptEventSchema = z.object({
  type: z.literal(WORKER_EVENTS.prompt),
  detail: z.object({
    prompt: z.string(),
  }),
})

export type WorkerPromptEventDetail = z.output<typeof WorkerPromptEventSchema>

export const HarnessMessageSchema = z.discriminatedUnion('type', [
  WorkerSetupEventSchema,
  WorkerGetContextEventSchema,
  WorkerHeartbeatEventSchema,
  WorkerPromptEventSchema,
])

export type HarnessMessage = z.output<typeof HarnessMessageSchema>

export const WorkerReadDetailSchema = z.object({
  planId: z.string(),
  path: z.string(),
  encoding: z.enum(['utf8', 'bytes']).optional().default('utf8'),
  maxBytes: z.number().int().positive().optional(),
})

export type WorkerReadDetail = z.output<typeof WorkerReadDetailSchema>

export const WorkerShellDetailSchema = z.object({
  planId: z.string(),
  command: z.array(z.string()),
  timeoutMs: z.number().optional(),
  maxOutputBytes: z.number().optional(),
})

export type WorkerShellDetail = z.output<typeof WorkerShellDetailSchema>

export const WorkerUpdateSpecsDetailSchema = z.object({
  planId: z.string(),
  specs: z.array(SpecSchema),
})

export type WorkerUpdateSpecsDetail = z.output<typeof WorkerUpdateSpecsDetailSchema>

export const WorkerWriteDetailSchema = z.object({
  planId: z.string(),
  path: z.string(),
  content: z.string(),
  encoding: z.enum(['utf8', 'base64']).optional().default('utf8'),
})

export type WorkerWriteDetail = z.output<typeof WorkerWriteDetailSchema>

const InferenceReadActionSchema = z.object({
  type: z.literal(WORKER_EVENTS.read),
  detail: WorkerReadDetailSchema.omit({
    planId: true,
  }),
})

const InferenceShellActionSchema = z.object({
  type: z.literal(WORKER_EVENTS.shell),
  detail: WorkerShellDetailSchema.omit({
    planId: true,
  }),
})

const InferenceUpdateSpecsActionSchema = z.object({
  type: z.literal(WORKER_EVENTS.write),
  detail: WorkerUpdateSpecsDetailSchema.omit({
    planId: true,
  }),
})

const InferenceWriteActionSchema = z.object({
  type: z.literal(WORKER_EVENTS.write),
  detail: WorkerWriteDetailSchema.omit({
    planId: true,
  }),
})

export const InferenceActionSchema = z.discriminatedUnion('type', [
  InferenceReadActionSchema,
  InferenceShellActionSchema,
  InferenceWriteActionSchema,
  InferenceUpdateSpecsActionSchema,
])

export const PlanCompleteSchema = z.object({
  analysis: z.string(),
  plan: z.string(),
  actions: z.array(InferenceActionSchema),
  taskComplete: z.boolean().optional(),
})

export type PlanComplete = z.output<typeof PlanCompleteSchema>
export type InferenceAction = z.output<typeof InferenceActionSchema>
