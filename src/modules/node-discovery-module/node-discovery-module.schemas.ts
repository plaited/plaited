import * as z from 'zod'

export const NodeDiscoveryPublicationStatusSchema = z.enum(['idle', 'publish_required', 'published'])
export type NodeDiscoveryPublicationStatus = z.infer<typeof NodeDiscoveryPublicationStatusSchema>

export const NodeDiscoveryStateSchema = z.object({
  nodeId: z.string().min(1),
  ownerHost: z.string().min(1),
  publicCardUrl: z.string().min(1),
  privateExtensionUrl: z.string().min(1).optional(),
  publicationStatus: NodeDiscoveryPublicationStatusSchema,
  lastPublishedAt: z.number().int().nonnegative().optional(),
})
export type NodeDiscoveryState = z.infer<typeof NodeDiscoveryStateSchema>

export const BindDiscoveryTargetDetailSchema = z.object({
  ownerHost: z.string().min(1),
  publicCardUrl: z.string().min(1),
  privateExtensionUrl: z.string().min(1).optional(),
})
export type BindDiscoveryTargetDetail = z.infer<typeof BindDiscoveryTargetDetailSchema>

export const PublishDiscoveryDetailSchema = z.object({
  timestamp: z.number().int().nonnegative().optional(),
})
export type PublishDiscoveryDetail = z.infer<typeof PublishDiscoveryDetailSchema>
