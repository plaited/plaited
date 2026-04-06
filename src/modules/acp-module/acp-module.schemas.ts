import * as z from 'zod'

export const AcpAdvertisedCapabilitySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
})
export type AcpAdvertisedCapability = z.infer<typeof AcpAdvertisedCapabilitySchema>

export const AcpSessionStatusSchema = z.enum(['idle', 'running', 'cancelled'])
export type AcpSessionStatus = z.infer<typeof AcpSessionStatusSchema>

export const AcpSessionSchema = z.object({
  sessionId: z.string().min(1),
  promptCount: z.number().int().nonnegative(),
  status: AcpSessionStatusSchema,
  lastPrompt: z.string().optional(),
})
export type AcpSession = z.infer<typeof AcpSessionSchema>

export const AcpModuleStateSchema = z.object({
  transport: z.enum(['stdio', 'local_http']),
  advertisedCapabilities: z.array(AcpAdvertisedCapabilitySchema),
  sessions: z.array(AcpSessionSchema),
})
export type AcpModuleState = z.infer<typeof AcpModuleStateSchema>

export const OpenAcpSessionDetailSchema = z.object({
  sessionId: z.string().min(1),
})
export const SubmitAcpTurnDetailSchema = z.object({
  sessionId: z.string().min(1),
  prompt: z.string().min(1),
})
export const CancelAcpSessionDetailSchema = z.object({
  sessionId: z.string().min(1),
})
