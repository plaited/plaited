import { z } from 'zod'

/**
 * Zod schema for zip function parameters.
 * Validates content compression requirements for HTTP responses.
 */
export const ZipParamsSchema = z.object({
  content: z.string(),
  contentType: z.string(),
  headers: z.instanceof(Headers).optional(),
})

/**
 * Type for zip function parameters inferred from Zod schema.
 */
export type ZipParams = z.infer<typeof ZipParamsSchema>

/**
 * Zod schema for create-story-dir function parameters.
 * Validates file path string for story directory creation.
 */
export const CreateStoryDirParamsSchema = z.object({
  filePath: z.string(),
})

/**
 * Type for create-story-dir function parameters inferred from Zod schema.
 */
export type CreateStoryDirParams = z.infer<typeof CreateStoryDirParamsSchema>

/**
 * Zod schema for create-story-id function parameters.
 * Validates export name and story name for story ID generation.
 */
export const CreateStoryIdParamsSchema = z.object({
  exportName: z.string(),
  storyName: z.string(),
})

/**
 * Type for create-story-id function parameters inferred from Zod schema.
 */
export type CreateStoryIdParams = z.infer<typeof CreateStoryIdParamsSchema>

/**
 * Zod schema for create-story-route function parameters.
 * Validates story route generation parameters.
 */
export const CreateStoryRouteParamsSchema = z.object({
  filePath: z.string(),
  exportName: z.string(),
  storyName: z.string(),
})

/**
 * Type for create-story-route function parameters inferred from Zod schema.
 */
export type CreateStoryRouteParams = z.infer<typeof CreateStoryRouteParamsSchema>

/**
 * Zod schema for get-template-exports function parameters.
 * Validates file path for template export extraction.
 */
export const GetTemplateExportsParamsSchema = z.object({
  filePath: z.string(),
})

/**
 * Type for get-template-exports function parameters inferred from Zod schema.
 */
export type GetTemplateExportsParams = z.infer<typeof GetTemplateExportsParamsSchema>

/**
 * Zod schema for glob-files function parameters.
 * Validates directory and pattern parameters for file globbing.
 */
export const GlobFilesParamsSchema = z.object({
  cwd: z.string(),
  pattern: z.string(),
})

/**
 * Type for glob-files function parameters inferred from Zod schema.
 */
export type GlobFilesParams = z.infer<typeof GlobFilesParamsSchema>
