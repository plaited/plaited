import * as z from 'zod'

/**
 * Severity model for bounded notifications.
 *
 * @public
 */
export const NotificationSeveritySchema = z.enum(['status', 'warning', 'completion'])

/** @public */
export type NotificationSeverity = z.infer<typeof NotificationSeveritySchema>

/**
 * Bounded notification entry.
 *
 * @public
 */
export const NotificationEntrySchema = z.object({
  severity: NotificationSeveritySchema,
  eventType: z.string().min(1),
  message: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
})

/** @public */
export type NotificationEntry = z.infer<typeof NotificationEntrySchema>

/**
 * Signal schema for notification history.
 *
 * @public
 */
export const NotificationHistorySchema = z.array(NotificationEntrySchema)
