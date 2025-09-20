import * as z from 'zod'

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

/**
 * @internal Zod schema for validating `RunnerMessage` objects.
 * This schema ensures that messages received from the story fixture conform to the expected structure,
 * including properties like `colorScheme`, `pathname`, and a `snapshot` array with specific object shapes.
 * It is used by the story runner to validate incoming data.
 */
export const RunnerMessageSchema = z.object({
  colorScheme: z.string(),
  pathname: z.string(),
  snapshot: z.array(
    z.object({
      thread: z.string(),
      trigger: z.boolean(),
      selected: z.boolean(),
      type: z.string(),
      detail: z.optional(z.unknown()),
      priority: z.number(),
      blockedBy: z.optional(z.string()),
      interrupts: z.optional(z.string()),
    }),
  ),
})

/**
 * Zod schema for create-story-route function parameters.
 * Validates story route generation parameters.
 */
export const GetStoryRouteParamsInputSchema = z.object({
  filePath: z.string(),
  exportName: z.string(),
})

/**
 * Type for create-story-route function parameters inferred from Zod schema.
 */
export type GetStoryRouteParams = z.infer<typeof GetStoryRouteParamsInputSchema>
