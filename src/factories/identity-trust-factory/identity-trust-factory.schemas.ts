import * as z from 'zod'

export const TrustServiceProfileSchema = z.enum(['local_store', 'self_hosted_service', 'provider_managed'])
export type TrustServiceProfile = z.infer<typeof TrustServiceProfileSchema>

export const PeerTrustLevelSchema = z.enum(['unverified', 'trusted', 'restricted'])
export type PeerTrustLevel = z.infer<typeof PeerTrustLevelSchema>

export const PeerVerificationModeSchema = z.enum(['signed_card', 'did_document', 'service_attested'])
export type PeerVerificationMode = z.infer<typeof PeerVerificationModeSchema>

export const PeerTrustRecordSchema = z.object({
  peerId: z.string().min(1),
  locator: z.string().min(1),
  trustLevel: PeerTrustLevelSchema,
  verificationMode: PeerVerificationModeSchema,
  claims: z.array(z.string()),
  verifiedAt: z.number().int().nonnegative(),
})
export type PeerTrustRecord = z.infer<typeof PeerTrustRecordSchema>

export const IdentityTrustStateSchema = z.object({
  localIdentityId: z.string().min(1),
  discoveryNodeId: z.string().min(1).optional(),
  trustServiceProfile: TrustServiceProfileSchema,
  auditBoundaries: z.array(z.string()),
  peers: z.array(PeerTrustRecordSchema),
})
export type IdentityTrustState = z.infer<typeof IdentityTrustStateSchema>

export const VerifyPeerDetailSchema = z.object({
  peerId: z.string().min(1),
  locator: z.string().min(1),
  verificationMode: PeerVerificationModeSchema,
  claims: z.array(z.string()).default([]),
  success: z.boolean(),
})
export type VerifyPeerDetail = z.infer<typeof VerifyPeerDetailSchema>
