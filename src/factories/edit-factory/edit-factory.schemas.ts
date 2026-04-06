import * as z from 'zod'

export const EditStrategySchema = z.enum(['targeted_patch', 'multi_file', 'doc_only', 'repair'])
export type EditStrategy = z.infer<typeof EditStrategySchema>

export const EditStatusSchema = z.enum(['proposed', 'applying', 'partial', 'ready_for_verification', 'needs_repair'])
export type EditStatus = z.infer<typeof EditStatusSchema>

export const EditStateSchema = z.object({
  intent: z.string().min(1),
  files: z.array(z.string()).min(1),
  strategy: EditStrategySchema,
  status: EditStatusSchema,
  changedFiles: z.array(z.string()),
  note: z.string().optional(),
})
export type EditState = z.infer<typeof EditStateSchema>

export const NullableEditStateSchema = EditStateSchema.nullable()

export const RequestEditDetailSchema = z.object({
  intent: z.string().min(1),
  files: z.array(z.string()).min(1),
})
export type RequestEditDetail = z.infer<typeof RequestEditDetailSchema>

export const ApplyEditDetailSchema = z.object({
  changedFiles: z.array(z.string()).min(1),
  note: z.string().optional(),
})
export type ApplyEditDetail = z.infer<typeof ApplyEditDetailSchema>
