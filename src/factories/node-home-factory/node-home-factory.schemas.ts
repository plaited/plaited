import * as z from 'zod'

export const NodeHomeStatusSchema = z.enum(['active', 'checkpoint_pending', 'handoff_ready', 'restoring'])
export type NodeHomeStatus = z.infer<typeof NodeHomeStatusSchema>

export const NodeHomeArtifactSchema = z.object({
  kind: z.string().min(1),
  summary: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
})
export type NodeHomeArtifact = z.infer<typeof NodeHomeArtifactSchema>

export const NodeHomePromotionModeSchema = z.enum(['export', 'import', 'handoff'])
export type NodeHomePromotionMode = z.infer<typeof NodeHomePromotionModeSchema>

export const NodeHomePromotionRecordSchema = z.object({
  mode: NodeHomePromotionModeSchema,
  status: z.enum(['completed']),
  timestamp: z.number().int().nonnegative(),
  targetHost: z.string().min(1).optional(),
  sourceHost: z.string().min(1).optional(),
  bundleId: z.string().min(1).optional(),
})
export type NodeHomePromotionRecord = z.infer<typeof NodeHomePromotionRecordSchema>

export const NodeHomeStateSchema = z.object({
  ownerHost: z.string().min(1),
  status: NodeHomeStatusSchema,
  durableArtifacts: z.array(NodeHomeArtifactSchema),
  lastCheckpointAt: z.number().int().nonnegative().optional(),
  lastRestoredAt: z.number().int().nonnegative().optional(),
  lastPromotion: NodeHomePromotionRecordSchema.optional(),
})
export type NodeHomeState = z.infer<typeof NodeHomeStateSchema>

export const NodeHomeCheckpointDetailSchema = z.object({
  reason: z.string().min(1).optional(),
})
export type NodeHomeCheckpointDetail = z.infer<typeof NodeHomeCheckpointDetailSchema>

export const NodeHomeExportDetailSchema = z.object({
  targetHost: z.string().min(1),
  bundleId: z.string().min(1).optional(),
})
export type NodeHomeExportDetail = z.infer<typeof NodeHomeExportDetailSchema>

export const NodeHomeImportDetailSchema = z.object({
  sourceHost: z.string().min(1),
  bundleId: z.string().min(1).optional(),
})
export type NodeHomeImportDetail = z.infer<typeof NodeHomeImportDetailSchema>

export const NodeHomeHandoffDetailSchema = z.object({
  targetHost: z.string().min(1),
  bundleId: z.string().min(1).optional(),
})
export type NodeHomeHandoffDetail = z.infer<typeof NodeHomeHandoffDetailSchema>

export const NodeHomeRestoreDetailSchema = z.object({
  ownerHost: z.string().min(1).optional(),
})
export type NodeHomeRestoreDetail = z.infer<typeof NodeHomeRestoreDetailSchema>
