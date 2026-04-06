import * as z from 'zod'

export const BashExecutionProfileSchema = z.enum(['read_only', 'workspace_write', 'destructive', 'background'])
export type BashExecutionProfile = z.infer<typeof BashExecutionProfileSchema>

export const BashExecutionStatusSchema = z.enum([
  'requested',
  'running',
  'completed',
  'malformed_output',
  'needs_followup',
])
export type BashExecutionStatus = z.infer<typeof BashExecutionStatusSchema>

export const BashExecutionStateSchema = z.object({
  path: z.string().min(1),
  args: z.array(z.string()),
  profile: BashExecutionProfileSchema,
  status: BashExecutionStatusSchema,
  summary: z.string().optional(),
})
export type BashExecutionState = z.infer<typeof BashExecutionStateSchema>

export const NullableBashExecutionStateSchema = BashExecutionStateSchema.nullable()

export const RequestBashExecutionDetailSchema = z.object({
  path: z.string().min(1),
  args: z.array(z.string()).default([]),
})
export type RequestBashExecutionDetail = z.infer<typeof RequestBashExecutionDetailSchema>

export const MarkBashExecutionResultDetailSchema = z.object({
  status: BashExecutionStatusSchema,
  summary: z.string().optional(),
})
export type MarkBashExecutionResultDetail = z.infer<typeof MarkBashExecutionResultDetailSchema>
