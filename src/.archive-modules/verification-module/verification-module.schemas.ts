import * as z from 'zod'

export const VerificationStatusSchema = z.enum(['verified', 'unverified', 'failed', 'blocked'])
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>

export const VerificationFindingSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
})
export type VerificationFinding = z.infer<typeof VerificationFindingSchema>

export const VerificationReportSchema = z.object({
  status: VerificationStatusSchema,
  findings: z.array(VerificationFindingSchema),
  checkedAt: z.number().int().nonnegative(),
})
export type VerificationReport = z.infer<typeof VerificationReportSchema>

export const NullableVerificationReportSchema = VerificationReportSchema.nullable()
