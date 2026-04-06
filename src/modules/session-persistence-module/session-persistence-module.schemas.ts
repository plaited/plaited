import * as z from 'zod'

export const SessionArtifactSchema = z.object({
  kind: z.string().min(1),
  summary: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
})
export type SessionArtifact = z.infer<typeof SessionArtifactSchema>

export const SessionPersistenceStateSchema = z.object({
  recentArtifacts: z.array(SessionArtifactSchema),
  lastRestoredAt: z.number().int().nonnegative().optional(),
})
export type SessionPersistenceState = z.infer<typeof SessionPersistenceStateSchema>
