import * as z from 'zod'

import { LINK_ACTIVITY_KINDS } from './create-link.constants.ts'

/**
 * Message envelope used by agent links.
 *
 * @public
 */
export const LinkMessageSchema = z.object({
  type: z.string(),
  detail: z.unknown().optional(),
})

/**
 * Observable createLink activity.
 *
 * @public
 */
export const LinkActivitySchema = z.object({
  kind: z.enum(LINK_ACTIVITY_KINDS),
  linkId: z.string(),
  subscriptionId: z.string().optional(),
  message: LinkMessageSchema.optional(),
  error: z.string().optional(),
})

export type LinkActivity = z.infer<typeof LinkActivitySchema>
