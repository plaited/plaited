/**
 * @internal
 * @module collect-stories
 *
 * Purpose: Fast story collection using direct module imports (runtime analysis)
 * Architecture: Alternative to TypeScript compilation-based discovery
 * Performance: ~30x faster than TypeScript compilation approach
 *
 * Key differences from discover-story-metadata.ts:
 * - Uses dynamic imports instead of TypeScript compiler
 * - Analyzes runtime objects instead of AST
 * - ~50ms vs ~1500ms for typical project
 *
 * Trade-offs:
 * - Pros: Much faster, simpler code, no TypeScript dependency
 * - Cons: Requires story files to be executable, runtime errors if invalid
 *
 * Usage:
 * - Use for test execution (performance critical)
 * - Consider discover-story-metadata.ts for static analysis tools
 */

import { Glob } from 'bun'
import { isStoryExport } from '../testing/testing.utils.js'
import type { StoryMetadata } from './workshop.types.js'
import type { StoryExport } from '../testing/testing.types.js'
import { globFiles } from './workshop.utils.js'

/**
 * @internal
 * Converts a StoryExport to StoryMetadata.
 *
 * @param exportName - Name of the export
 * @param filePath - Absolute path to the story file
 * @param storyExport - Runtime story export object
 * @returns StoryMetadata object
 */
const toStoryMetadata = (exportName: string, filePath: string, storyExport: StoryExport): StoryMetadata => {
  return {
    exportName,
    filePath,
    type: storyExport.type,
    hasPlay: !!storyExport.play,
    hasArgs: storyExport.args !== undefined,
    hasTemplate: storyExport.template !== undefined,
    hasParameters: storyExport.parameters !== undefined,
    only: storyExport.only,
    skip: storyExport.skip,
  }
}

/**
 * Collects story metadata from a single file using direct module import.
 * Fast alternative to TypeScript compilation for runtime story discovery.
 *
 * @param filePath - Absolute path to the story file
 * @returns Array of story metadata (filtered by .only() and .skip())
 *
 * @remarks
 * - Uses dynamic import instead of TypeScript compiler
 * - Analyzes runtime objects instead of AST
 * - ~30x faster than TypeScript compilation approach
 * - Requires story files to be valid executable TypeScript/TSX
 * - Applies .only() and .skip() filtering per-file
 *
 * @see {@link discoverStoryMetadata} for directory-based discovery
 * @see {@link filterStoryMetadata} for filtering logic
 */
export const getStoryMetadata = async (filePath: string): Promise<StoryMetadata[]> => {
  const metadata: StoryMetadata[] = []

  try {
    // Dynamic import to load the module
    const module = (await import(filePath)) as Record<string, unknown>

    // Check each export
    for (const [exportName, exportValue] of Object.entries(module)) {
      // Skip default exports and non-story exports
      if (exportName === 'default') {
        continue
      }

      // Check if this export is a StoryExport
      if (isStoryExport(exportValue)) {
        metadata.push(toStoryMetadata(exportName, filePath, exportValue))
      }
    }
  } catch (error) {
    console.error(`Failed to import story file: ${filePath}`, error)
    throw error
  }

  // Apply .only() and .skip() filtering per-file
  return filterStoryMetadata(metadata)
}

/**
 * @internal
 * Filters story metadata based on .only() and .skip() flags.
 * Implements Jest/Vitest-style focused test execution.
 *
 * @param metadata - Array of story metadata to filter
 * @returns Filtered array of story metadata
 *
 * @remarks
 * Filtering rules (applied in order):
 * 1. If any story has only: true, return ONLY those stories
 * 2. Otherwise, exclude stories with skip: true
 * 3. Preserves original order of stories
 *
 * @see {@link StoryMetadata} for metadata structure
 */
export const filterStoryMetadata = (metadata: StoryMetadata[]): StoryMetadata[] => {
  // Check if any story has .only()
  const onlyStories = metadata.filter((story) => story.only)

  if (onlyStories.length > 0) {
    const skippedCount = metadata.length - onlyStories.length
    if (skippedCount > 0) {
      console.log(`⚡ Running ${onlyStories.length} .only() stories (${skippedCount} skipped)`)
    }
    return onlyStories
  }

  // Otherwise filter out .skip()
  const activeStories = metadata.filter((story) => !story.skip)
  const skippedCount = metadata.length - activeStories.length

  if (skippedCount > 0) {
    console.log(`⏭️  Skipping ${skippedCount} stories`)
  }

  return activeStories
}

/**
 * Discovers all story files and their metadata in a directory using direct imports.
 * Fast alternative to TypeScript compilation-based discovery.
 *
 * @param cwd - Current working directory (project root)
 * @param exclude - Pattern to exclude from discovery (defaults to test spec files)
 * @returns Array of story metadata
 *
 * @remarks
 * - Uses direct imports for ~30x faster discovery than TypeScript compilation
 * - Files must be executable TypeScript/TSX
 * - Errors in story files will cause discovery to fail
 * - Applies .only() and .skip() filtering
 *
 * @see {@link getStoryMetadata} for single file collection
 * @see {@link filterStoryMetadata} for filtering logic
 */
export const discoverStoryMetadata = async (cwd: string, exclude?: string): Promise<StoryMetadata[]> => {
  console.log(`🔍 Discovering story metadata in: ${cwd}`)
  if (exclude) {
    console.log(`📋 Excluding pattern: ${exclude}`)
  }

  // Get all .stories.tsx files
  const allFiles = await globFiles(cwd, '**/*.stories.tsx')

  // Filter out exclude pattern using glob matching
  const excludeGlob = exclude && new Glob(exclude)
  const files = exclude ? allFiles.filter((file) => !excludeGlob?.match(file)) : allFiles

  if (files.length === 0) {
    console.log(
      `⚠️  No story files (*.stories.tsx) found in directory '${cwd}'${exclude ? ` (excluding ${exclude})` : ''}`,
    )
    return []
  }

  console.log(`📄 Found ${files.length} story files`)

  // Collect metadata from all files in parallel
  const metadataArrays = await Promise.all(files.map((file) => getStoryMetadata(file)))
  const metadata = metadataArrays.flat()

  console.log(`✅ Discovered ${metadata.length} story exports`)

  // Apply .only() and .skip() filtering
  return filterStoryMetadata(metadata)
}
