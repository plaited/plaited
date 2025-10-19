import * as z from 'zod'

export const GetFilePathsInputSchema = z.object({
  dir: z.string().optional().describe('Absolute path to a directory that must be within the project root'),
})

export const GetStorySetPathsOutputSchema = z.object({
  files: z
    .array(z.string())
    .describe('Array of absolute file paths to all story set files (*.stories.tsx) found in the codebase'),
})

export const GetTemplatePathsOutputSchema = z.object({
  files: z
    .array(z.string())
    .describe(
      'Array of absolute file paths to all template files (*.tsx) excluding story files (*.stories.tsx) found in the codebase',
    ),
})
