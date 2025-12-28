/**
 * @internal
 * @module collect-stories
 *
 * Fast story collection using direct module imports (runtime analysis).
 * Alternative to TypeScript compilation-based discovery.
 *
 * @remarks
 * Performance: ~30x faster than compilation approach (~50ms vs ~1500ms).
 * Trade-offs: Faster and simpler, but requires executable story files.
 * Use for test execution where performance is critical.
 */

import { statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { Glob } from 'bun'
import { DEFAULT_PLAY_TIMEOUT, STORY_IDENTIFIER } from '../testing/testing.constants.ts'
import type { StoryExport } from '../testing/testing.types.ts'
import { isTypeOf } from '../utils.ts'
import { getPaths } from './get-paths.ts'
import type { StoryMetadata } from './workshop.types.ts'
import { globFiles } from './workshop.utils.ts'

export const isStoryExport = (obj: unknown): obj is StoryExport => {
  return isTypeOf<StoryExport>(obj, 'object') && obj.$ === STORY_IDENTIFIER
}

/**
 * @internal
 * Converts a StoryExport to StoryMetadata.
 *
 * @param exportName - Name of the export
 * @param filePath - Absolute path to the story file
 * @param storyExport - Runtime story export object
 * @returns StoryMetadata object
 */
const toStoryMetadata = ({
  route,
  exportName,
  filePath,
  storyExport,
  entryPath,
}: {
  route: string
  exportName: string
  filePath: string
  storyExport: StoryExport
  entryPath: string
}): StoryMetadata => {
  return {
    route,
    exportName,
    filePath,
    entryPath,
    type: storyExport.type,
    hasPlay: !!storyExport.play,
    hasArgs: storyExport.args !== undefined,
    hasTemplate: storyExport.template !== undefined,
    hasParameters: storyExport.parameters !== undefined,
    timeout: storyExport.parameters?.timeout || DEFAULT_PLAY_TIMEOUT,
    flag: storyExport.only === true ? 'only' : storyExport.skip === true ? 'skip' : undefined,
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
export const getStoryMetadata = async (cwd: string, filePath: string) => {
  const metadata = new Map<string, StoryMetadata>()
  let hasOnlyStories = false
  let storyCount = 0
  try {
    // Dynamic import to load the module
    const module = (await import(filePath)) as Record<string, unknown>
    // Check each export
    for (const [exportName, storyExport] of Object.entries(module)) {
      // Skip default exports and non-story exports
      if (exportName === 'default') {
        continue
      }

      // Check if this export is a StoryExport
      if (isStoryExport(storyExport)) {
        storyCount++
        if (!hasOnlyStories && storyExport.only) {
          metadata.clear()
          hasOnlyStories = true
        }
        if (hasOnlyStories && !storyExport.only) continue
        if (storyExport.skip) continue
        const { route, entryPath } = getPaths({
          cwd,
          filePath,
          exportName,
        })
        metadata.set(route, toStoryMetadata({ exportName, filePath, storyExport, route, entryPath }))
      }
    }
  } catch (error) {
    console.error(`Failed to import story file: ${filePath}`, error)
    throw error
  }
  const skippedCount = storyCount - metadata.size
  if (skippedCount) {
    if (hasOnlyStories) {
      console.log(`⚡ Running ${metadata.size} .only() stories (${skippedCount} skipped)`)
    } else {
      console.log(`⏭️  Skipping ${skippedCount} stories`)
    }
  }
  return metadata
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
 * - Applies .only() and .skip() filtering PER-FILE (not globally)
 * - Each file's .only()/.skip() only affects stories within that file
 *
 * @see {@link getStoryMetadata} for single file collection
 * @see {@link filterStoryMetadata} for filtering logic
 */
export const discoverStoryMetadata = async (cwd: string, exclude?: string) => {
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

  const maps = await Promise.all(files.map((file) => getStoryMetadata(cwd, file)))

  return maps
}

export const collectStories = async (cwd: string, paths: string[]) => {
  console.log(`   Paths: ${paths.join(', ')}`)

  console.log('\n🔍 Discovering stories from provided paths...')

  const maps: Map<string, StoryMetadata>[] = []

  for (const pathArg of paths) {
    const absolutePath = resolve(cwd, pathArg)

    try {
      const stats = statSync(absolutePath)

      if (stats.isDirectory()) {
        console.log(`📂 Scanning directory: ${absolutePath}`)
        const data = await discoverStoryMetadata(absolutePath)
        maps.push(...data.flat())
      } else if (stats.isFile()) {
        console.log(`📄 Analyzing file: ${absolutePath}`)
        const data = await getStoryMetadata(dirname(absolutePath), absolutePath)
        maps.push(data)
      } else {
        console.error(`🚩 Error: Path is neither file nor directory: ${absolutePath}`)
        process.exit(1)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.error(`🚩 Error: Path does not exist: ${absolutePath}`)
      } else {
        console.error(`🚩 Error processing path ${absolutePath}:`, error)
      }
      process.exit(1)
    }
  }
  const metadata = new Map<string, StoryMetadata>(maps.flatMap((m) => [...m]))
  if (metadata.size === 0) {
    console.warn('\n⚠️  No story exports found in provided paths')
  }
  console.log(`✅ Discovered ${metadata.size} story exports`)
  return metadata
}

/**
 * Custom tool for Claude Agent SDK to discover story files in the codebase.
 *
 * @remarks
 * This tool enables AI agents to discover all story files (*.stories.tsx) in specified paths,
 * returning comprehensive metadata for each story including routes, file paths, and test flags.
 *
 * Uses direct module imports for fast discovery (~30x faster than TypeScript compilation).
 * Respects .only() and .skip() story modifiers for selective test execution.
 *
 * @see {@link collectStories} for the underlying implementation
 *
 * @public
 */
export const discoverStoriesTool = {
  name: 'discover_stories',
  description:
    'Discover all story files in specified paths. Returns story metadata including file paths, routes, and test flags.',
  parameters: {
    type: 'object',
    properties: {
      cwd: { type: 'string', description: 'Current working directory (project root)' },
      paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of file or directory paths to search for stories',
      },
    },
    required: ['cwd', 'paths'],
  },
  execute: async ({ cwd, paths }: { cwd: string; paths: string[] }) => {
    const stories = await collectStories(cwd, paths)
    return {
      stories: Array.from(stories.values()).map((story) => ({
        route: story.route,
        exportName: story.exportName,
        filePath: story.filePath,
        hasPlay: story.hasPlay,
        flag: story.flag,
      })),
    }
  },
}
