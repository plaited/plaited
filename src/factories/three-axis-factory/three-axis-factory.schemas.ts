import * as z from 'zod'

export const CapabilityAutonomyModeSchema = z.enum(['autonomous', 'confirm_first', 'owner_only'])
export type CapabilityAutonomyMode = z.infer<typeof CapabilityAutonomyModeSchema>

export const CapabilityDecisionSchema = z.object({
  capabilityId: z.string().min(1),
  authorityScope: z.string().min(1),
  autonomyMode: CapabilityAutonomyModeSchema,
  verificationRequired: z.boolean(),
})
export type CapabilityDecision = z.infer<typeof CapabilityDecisionSchema>

export const ThreeAxisStateSchema = z.object({
  decisions: z.array(CapabilityDecisionSchema),
})
export type ThreeAxisState = z.infer<typeof ThreeAxisStateSchema>
