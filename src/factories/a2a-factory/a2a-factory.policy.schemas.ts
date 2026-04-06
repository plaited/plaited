import * as z from 'zod'
import { AgentCardSchema } from './a2a.schemas.ts'

export const A2APeerRecordSchema = z.object({
  peerId: z.string().min(1),
  locator: z.string().min(1),
  trustLevel: z.string().min(1),
})
export type A2APeerRecord = z.infer<typeof A2APeerRecordSchema>

export const A2ATaskRecordSchema = z.object({
  taskId: z.string().min(1),
  messageId: z.string().min(1),
  status: z.enum(['submitted', 'completed']),
  peerId: z.string().min(1).optional(),
})
export type A2ATaskRecord = z.infer<typeof A2ATaskRecordSchema>

export const A2AFactoryStateSchema = z.object({
  card: AgentCardSchema,
  peers: z.array(A2APeerRecordSchema),
  recentTasks: z.array(A2ATaskRecordSchema),
})
export type A2AFactoryState = z.infer<typeof A2AFactoryStateSchema>

export const ReceiveA2AMessageDetailSchema = z.object({
  peerId: z.string().min(1).optional(),
  messageId: z.string().min(1),
  taskId: z.string().min(1),
})

export const RegisterA2APeerDetailSchema = z.object({
  peerId: z.string().min(1),
  locator: z.string().min(1),
  trustLevel: z.string().min(1),
})

export const CompleteA2ATaskDetailSchema = z.object({
  taskId: z.string().min(1),
})
