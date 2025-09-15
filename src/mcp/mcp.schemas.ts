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
export const GetStoryDirParamsSchema = z.object({
  filePath: z.string(),
})

/**
 * Type for create-story-dir function parameters inferred from Zod schema.
 */
export type GetStoryDirParams = z.infer<typeof GetStoryDirParamsSchema>

/**
 * Zod schema for create-story-id function parameters.
 * Validates export name and story name for story ID generation.
 */
export const GetStoryIdParamsSchema = z.object({
  exportName: z.string(),
  storyName: z.string(),
})

/**
 * Type for create-story-id function parameters inferred from Zod schema.
 */
export type GetStoryIdParams = z.infer<typeof GetStoryIdParamsSchema>

/**
 * Zod schema for create-story-route function parameters.
 * Validates story route generation parameters.
 */
export const GetStoryRouteParamsSchema = z.object({
  filePath: z.string(),
  exportName: z.string(),
  storyName: z.string(),
})

/**
 * Type for create-story-route function parameters inferred from Zod schema.
 */
export type GetStoryRouteParams = z.infer<typeof GetStoryRouteParamsSchema>

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
