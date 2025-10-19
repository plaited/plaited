import { z } from 'zod'

/**
 * Zod schema for story set metadata output.
 * Validates array of story export details with their properties and types.
 */
export const StorySetMetadataSchema = z.object({
  exportName: z.string(),
  filePath: z.string(),
  type: z.enum(['interaction', 'snapshot', 'unknown']),
  hasPlay: z.boolean(),
  hasArgs: z.boolean(),
  hasTemplate: z.boolean(),
  hasParameters: z.boolean(),
})

/**
 * Type for story set export metadata inferred from Zod schema.
 */
export type StoryMetadata = z.infer<typeof StorySetMetadataSchema>
