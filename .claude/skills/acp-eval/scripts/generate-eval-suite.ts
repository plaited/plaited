#!/usr/bin/env bun

/**
 * Generate an evaluation suite from stories with intents.
 *
 * @remarks
 * Scans story files for exports with `intent` fields and generates
 * a JSONL file suitable for running evaluations.
 *
 * Usage:
 *   bun scripts/generate-eval-suite.ts <stories-path> -o <output.jsonl>
 *
 * Example:
 *   bun scripts/generate-eval-suite.ts training/stories -o evals/suite.jsonl
 */

import { basename, join, relative } from 'node:path'
import { parseArgs } from 'node:util'
import { Glob } from 'bun'

// ============================================================================
// Types
// ============================================================================

type EvalCase = {
  /** Unique identifier */
  id: string
  /** Natural language intent/prompt */
  intent: string
  /** Source story file */
  source: string
  /** Story export name */
  export: string
  /** Optional tags for filtering */
  tags?: string[]
}

type StoryExport = {
  intent?: string
  template?: unknown
  play?: unknown
}

type StoryMeta = {
  title?: string
  tags?: string[]
}

// ============================================================================
// Argument Parsing
// ============================================================================

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    output: {
      type: 'string',
      short: 'o',
      default: 'evals/suite.jsonl',
    },
    filter: {
      type: 'string',
      short: 'f',
      description: 'Filter stories by pattern',
    },
    help: {
      type: 'boolean',
      short: 'h',
    },
  },
  allowPositionals: true,
})

if (values.help || positionals.length === 0) {
  console.log(`
Usage: bun scripts/generate-eval-suite.ts <stories-path> [options]

Arguments:
  stories-path    Directory containing *.stories.tsx files

Options:
  -o, --output    Output JSONL file (default: evals/suite.jsonl)
  -f, --filter    Filter stories by export name pattern
  -h, --help      Show this help message

Example:
  bun scripts/generate-eval-suite.ts training/stories -o evals/suite.jsonl
  bun scripts/generate-eval-suite.ts src/templates -f "Button*"
`)
  process.exit(values.help ? 0 : 1)
}

// ============================================================================
// Story Discovery
// ============================================================================

const storiesPath = positionals[0]
const outputPath = values.output ?? 'evals/suite.jsonl'
const filterPattern = values.filter ? new RegExp(values.filter) : undefined

/**
 * Generate a slug from export name for use as eval ID
 */
const toSlug = (name: string): string => {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

/**
 * Extract stories with intents from a file
 */
const extractStoriesFromFile = async (filePath: string): Promise<EvalCase[]> => {
  const cases: EvalCase[] = []
  const relativePath = relative(process.cwd(), filePath)
  const fileName = basename(filePath, '.stories.tsx')

  try {
    const module = (await import(filePath)) as Record<string, unknown>
    const meta = (module.meta ?? {}) as StoryMeta
    const baseTags = meta.tags ?? []

    for (const [exportName, value] of Object.entries(module)) {
      // Skip meta and non-story exports
      if (exportName === 'meta' || exportName === 'default') continue

      const story = value as StoryExport
      if (!story?.intent) continue

      // Apply filter if specified
      if (filterPattern && !filterPattern.test(exportName)) continue

      const id = `${fileName}-${toSlug(exportName)}`

      cases.push({
        id,
        intent: story.intent,
        source: relativePath,
        export: exportName,
        ...(baseTags.length > 0 && { tags: baseTags }),
      })
    }
  } catch (error) {
    console.error(`Error processing ${relativePath}:`, error)
  }

  return cases
}

// ============================================================================
// Main
// ============================================================================

const main = async () => {
  const glob = new Glob('**/*.stories.tsx')
  const storyFiles: string[] = []

  for await (const file of glob.scan({ cwd: storiesPath, absolute: true })) {
    storyFiles.push(file)
  }

  if (storyFiles.length === 0) {
    console.error(`No story files found in ${storiesPath}`)
    process.exit(1)
  }

  console.log(`Found ${storyFiles.length} story files`)

  const allCases: EvalCase[] = []

  for (const file of storyFiles) {
    const cases = await extractStoriesFromFile(file)
    allCases.push(...cases)
  }

  if (allCases.length === 0) {
    console.error('No stories with intents found')
    process.exit(1)
  }

  // Ensure output directory exists
  const outputDir = join(outputPath, '..')
  await Bun.write(join(outputDir, '.gitkeep'), '')

  // Write JSONL output
  const jsonl = `${allCases.map((c) => JSON.stringify(c)).join('\n')}\n`
  await Bun.write(outputPath, jsonl)

  console.log(`Generated ${allCases.length} eval cases to ${outputPath}`)

  // Print summary
  const bySource = new Map<string, number>()
  for (const c of allCases) {
    bySource.set(c.source, (bySource.get(c.source) ?? 0) + 1)
  }

  console.log('\nBy source:')
  for (const [source, count] of bySource) {
    console.log(`  ${source}: ${count}`)
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
