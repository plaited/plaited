import * as z from 'zod'

export const PermissionAuditRecordSchema = z.object({
  capabilityId: z.string().min(1),
  decision: z.enum(['approved', 'autonomous', 'confirm_first', 'owner_only']),
  boundary: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
})
export type PermissionAuditRecord = z.infer<typeof PermissionAuditRecordSchema>

export const PermissionAuditLedgerSchema = z.array(PermissionAuditRecordSchema)
