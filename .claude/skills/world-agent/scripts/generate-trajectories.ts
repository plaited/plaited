#!/usr/bin/env bun

/**
 * Generate training trajectories from story files.
 *
 * Usage:
 *   bun scripts/generate-trajectories.ts <paths...> [options]
 *
 * Options:
 *   --output, -o   Output file path (default: stdout as JSON)
 *   --format, -f   Output format: json | jsonl (default: jsonl)
 *   --help, -h     Show this help message
 *
 * Examples:
 *   bun scripts/generate-trajectories.ts src/templates
 *   bun scripts/generate-trajectories.ts src/templates --output trajectories.jsonl
 *   bun scripts/generate-trajectories.ts src/ui src/features -o data.jsonl
 */

import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import {
  computeTrajectoryStats,
  type ExecutionTrace,
  formatTrajectoriesJsonl,
  generateTrajectoryFromTrace,
  type Trajectory,
} from 'plaited/agent'

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    output: { type: 'string', short: 'o' },
    format: { type: 'string', short: 'f', default: 'jsonl' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
})

if (values.help || positionals.length === 0) {
  console.log(`
Generate training trajectories from story files.

Usage:
  bun scripts/generate-trajectories.ts <paths...> [options]

Options:
  --output, -o   Output file path (default: stdout as JSON)
  --format, -f   Output format: json | jsonl (default: jsonl)
  --help, -h     Show this help message

Examples:
  bun scripts/generate-trajectories.ts src/templates
  bun scripts/generate-trajectories.ts src/templates --output trajectories.jsonl
`)
  process.exit(values.help ? 0 : 1)
}

const paths = positionals

/**
 * Story export with intent field.
 *
 * @remarks
 * The `intent` field is now unified with Plaited's story types.
 * It serves both as test documentation and training data.
 */
type StoryExport = {
  exportName: string
  filePath: string
  intent: string
}

/**
 * Extracts story exports with intents from a story file.
 *
 * @remarks
 * Stories now use a unified `intent` field that serves both as
 * test documentation and training data for the world agent.
 */
const extractStoryExports = async (filePath: string): Promise<StoryExport[]> => {
  const absolutePath = resolve(process.cwd(), filePath)
  const module = await import(absolutePath)
  const exports: StoryExport[] = []

  for (const [name, value] of Object.entries(module)) {
    // Skip meta and non-object exports
    if (name === 'meta' || typeof value !== 'object' || value === null) continue

    const story = value as Record<string, unknown>

    // Only include stories with intent field
    if (typeof story.intent === 'string') {
      exports.push({
        exportName: name,
        filePath,
        intent: story.intent,
      })
    }
  }

  return exports
}

/**
 * Generate mock execution trace for a story export.
 * In production, this would connect to the actual workshop test runner.
 */
const generateMockTrace = (story: StoryExport): ExecutionTrace => {
  console.error(`[mock] Processing story: ${story.exportName} (${story.filePath})`)

  return {
    intent: story.intent,
    toolSchemas: [
      {
        name: 'writeTemplate',
        description: 'Write a JSX template file with FunctionalTemplate components',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Output file path (e.g., src/button.tsx)' },
            content: { type: 'string', description: 'JSX template content with imports' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'writeStyles',
        description: 'Write a CSS-in-JS styles file using createStyles',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Output file path (e.g., src/button.css.ts)' },
            content: { type: 'string', description: 'Styles file with createStyles' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'writeStory',
        description: 'Write a story file for testing templates with browser automation',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Output file path (e.g., src/button.stories.tsx)' },
            content: { type: 'string', description: 'Story file with story() exports' },
          },
          required: ['path', 'content'],
        },
      },
    ],
    functionCalls: [
      {
        name: 'writeTemplate',
        arguments: JSON.stringify({
          path: story.filePath.replace('.stories.tsx', '.tsx'),
          content: `// Generated template for ${story.exportName}`,
        }),
      },
    ],
    storyResult: {
      passed: true,
      totalAssertions: 1,
      passedAssertions: 1,
      a11yPassed: true,
      errors: [],
    },
  }
}

const main = async () => {
  const patterns = paths.map((p) => `${p}/**/*.stories.tsx`)
  // Only wrap in braces for multiple patterns - single patterns don't need braces
  const storyPattern = patterns.length > 1 ? `{${patterns.join(',')}}` : patterns[0]!

  console.error(`Generating trajectories from: ${paths.join(', ')}`)
  console.error(`Pattern: ${storyPattern}`)

  const glob = new Bun.Glob(storyPattern)
  const trajectories: Trajectory[] = []
  let totalStories = 0

  for await (const filePath of glob.scan()) {
    try {
      const storyExports = await extractStoryExports(filePath)
      totalStories += storyExports.length

      for (const story of storyExports) {
        const trace = generateMockTrace(story)
        const trajectory = generateTrajectoryFromTrace(trace)
        trajectories.push(trajectory)
      }
    } catch (error) {
      console.warn(`Failed to process ${filePath}:`, error)
    }
  }

  const stats = computeTrajectoryStats(trajectories)
  console.error(`\nFound ${totalStories} stories with intents`)
  console.error(`Generated ${stats.count} trajectories`)
  console.error(`Mean reward: ${stats.meanReward.toFixed(3)}`)
  console.error(`Pass rate: ${(stats.passRate * 100).toFixed(1)}%`)
  console.error(`A11y pass rate: ${(stats.a11yPassRate * 100).toFixed(1)}%`)

  const output =
    values.format === 'jsonl' ? formatTrajectoriesJsonl(trajectories) : JSON.stringify(trajectories, null, 2)

  if (values.output) {
    await Bun.write(values.output, output)
    console.error(`\nWritten to: ${values.output}`)
  } else {
    console.log(output)
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
