import * as z from 'zod'
import { StorySetMetadataSchema } from '../workshop.schemas.js'

export const TestStoriesInputSchema = z.object({
  storiesMetaData: z.array(StorySetMetadataSchema).describe('Array of story parameters to test'),
  colorSchemeSupport: z.boolean().optional().describe('Whether to test in both light and dark color schemes'),
  hostName: z.union([z.string(), z.instanceof(URL)]).describe('Host name of the currently running test server'),
})

export type TestStoriesInput = z.infer<typeof TestStoriesInputSchema>

export const TestResultSchema = z.object({
  detail: z.unknown().describe('test result details'),
  meta: z.object({
    url: z.string().describe('full URL to the story'),
    filePath: z.string().describe('file path to the story file'),
    exportName: z.string().describe('name of the exported story'),
    colorScheme: z.enum(['light', 'dark']).describe('color scheme used for testing'),
  }),
})

export type TestResult = z.infer<typeof TestResultSchema>

export const TestStoriesOutputSchema = z.object({
  passed: z.array(TestResultSchema).describe('array of passed test results'),
  failed: z.array(TestResultSchema).describe('array of failed test results'),
})

export type TestStoriesOutput = z.infer<typeof TestStoriesOutputSchema>
