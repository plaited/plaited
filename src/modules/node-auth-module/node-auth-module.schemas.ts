import * as z from 'zod'

export const NodeAuthModeSchema = z.enum(['webauthn', 'platform_jwt', 'enterprise_oidc', 'dev'])
export type NodeAuthMode = z.infer<typeof NodeAuthModeSchema>

export const NodeExposureLevelSchema = z.enum(['public', 'trusted', 'private'])
export type NodeExposureLevel = z.infer<typeof NodeExposureLevelSchema>

export const NodeAuthSessionSchema = z.object({
  principalId: z.string().min(1),
  trustClass: z.enum(['local_user', 'platform_edge', 'enterprise_gateway', 'developer']),
  capabilities: z.array(z.string()),
  authenticatedAt: z.number().int().nonnegative(),
})
export type NodeAuthSession = z.infer<typeof NodeAuthSessionSchema>

export const NodeAuthStateSchema = z.object({
  mode: NodeAuthModeSchema,
  exposureLevel: NodeExposureLevelSchema,
  authorityPolicy: z.enum(['strict', 'balanced', 'open']),
  session: NodeAuthSessionSchema.nullable(),
})
export type NodeAuthState = z.infer<typeof NodeAuthStateSchema>

export const SetNodeAuthModeDetailSchema = z.object({
  mode: NodeAuthModeSchema,
})
export type SetNodeAuthModeDetail = z.infer<typeof SetNodeAuthModeDetailSchema>

export const AuthenticateNodeAuthDetailSchema = z.object({
  principalId: z.string().min(1),
  trustClass: NodeAuthSessionSchema.shape.trustClass,
  capabilities: z.array(z.string()).default([]),
})
export type AuthenticateNodeAuthDetail = z.infer<typeof AuthenticateNodeAuthDetailSchema>
