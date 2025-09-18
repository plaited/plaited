import * as z from 'zod/v3'

/**
 * Zod schema for create-story-dir function parameters.
 * Validates file path string for story directory creation.
 */
export const GetStorySetMetaDataInputSchema = z.object({
  filePath: z.string().describe('path from root to .stories.tsx file containing story set'),
})

/**
 * Zod schema for story set metadata output.
 * Validates array of story export details with their properties and types.
 */
export const StorySetMetadataSchema = z.object({
  name: z.string(),
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

export const GetStorySetMetaDataOutputSchema = z.object({
  metadata: z.array(StorySetMetadataSchema),
})
