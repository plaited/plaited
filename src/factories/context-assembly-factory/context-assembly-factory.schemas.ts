import * as z from 'zod'

export const AssembledContextBlockSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  sourceIds: z.array(z.string()),
})
export type AssembledContextBlock = z.infer<typeof AssembledContextBlockSchema>

export const AssembledRequestSchema = z.object({
  phase: z.string().min(1),
  blocks: z.array(AssembledContextBlockSchema),
})
export type AssembledRequest = z.infer<typeof AssembledRequestSchema>
