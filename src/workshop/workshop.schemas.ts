/**
 * @module workshop.schemas
 *
 * Zod schemas for workshop tool input validation.
 *
 * @remarks
 * Provides type-safe input validation schemas for workshop discovery tools.
 * These schemas define the expected input parameters for story discovery,
 * behavioral element discovery, and story URL generation.
 *
 * @public
 */

import { z } from 'zod'
import { type BPEvent, isBPEvent } from '../main.ts'

/**
 * Schema for validating BPEvent objects.
 * Uses the framework's `isBPEvent` type guard for runtime validation.
 *
 * @public
 */
export const BPEventSchema = z.custom<BPEvent>(isBPEvent)

/**
 * Input schema for story discovery.
 * Validates parameters for the `collectStories` function.
 *
 * @public
 */
export const DiscoverStoriesInputSchema = z.object({
  cwd: z.string().describe('Current working directory (project root)'),
  paths: z.array(z.string()).describe('Array of file or directory paths to search for stories'),
})

/**
 * Input type for story discovery.
 * @public
 */
export type DiscoverStoriesInput = z.infer<typeof DiscoverStoriesInputSchema>

/**
 * Input schema for behavioral element discovery.
 * Validates parameters for the `discoverBehavioralTemplateMetadata` function.
 *
 * @public
 */
export const DiscoverBehavioralElementsInputSchema = z.object({
  cwd: z.string().describe('Current working directory to search'),
})

/**
 * Input type for behavioral element discovery.
 * @public
 */
export type DiscoverBehavioralElementsInput = z.infer<typeof DiscoverBehavioralElementsInputSchema>

/**
 * Input schema for story URL generation.
 * Validates parameters for the `getStoryUrl` function.
 *
 * @public
 */
export const GetStoryUrlInputSchema = z.object({
  cwd: z.string().describe('Current working directory (project root)'),
  filePath: z.string().describe('Absolute path to story file'),
  exportName: z.string().describe('Story export name'),
  port: z.number().optional().describe('Dev server port (default: 3000)'),
})

/**
 * Input type for story URL generation.
 * @public
 */
export type GetStoryUrlInput = z.infer<typeof GetStoryUrlInputSchema>
