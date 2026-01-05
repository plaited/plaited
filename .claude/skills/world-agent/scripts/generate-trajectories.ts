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

import { parseArgs } from 'node:util'
import {
  computeTrajectoryStats,
  type ExecutionTrace,
  formatTrajectoriesJsonl,
  generateTrajectoriesFromStories,
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
 * Mock story runner for demonstration.
 * In production, this would connect to the actual workshop test runner.
 */
const mockRunStory = async (path: string): Promise<ExecutionTrace> => {
  // This is a placeholder - in real usage, this would:
  // 1. Run the story via workshop CLI
  // 2. Capture the tool calls made during generation
  // 3. Collect the story result

  console.error(`[mock] Running story: ${path}`)

  return {
    intent: `Generate UI from ${path}`,
    toolSchemas: [
      {
        name: 'writeTemplate',
        description: 'Write a JSX template file',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['path', 'content'],
        },
      },
    ],
    functionCalls: [
      {
        name: 'writeTemplate',
        arguments: JSON.stringify({
          path: path.replace('.stories.tsx', '.tsx'),
          content: '// Generated template',
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
  const storyPattern = paths.map((p) => `${p}/**/*.stories.tsx`).join(',')

  console.error(`Generating trajectories from: ${paths.join(', ')}`)
  console.error(`Pattern: ${storyPattern}`)

  const trajectories = await generateTrajectoriesFromStories({
    storyPattern: `{${storyPattern}}`,
    runStory: mockRunStory,
  })

  const stats = computeTrajectoryStats(trajectories)
  console.error(`\nGenerated ${stats.count} trajectories`)
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
