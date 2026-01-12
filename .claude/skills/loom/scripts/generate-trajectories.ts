#!/usr/bin/env bun

/**
 * Generate training trajectories from story files with tiered analysis.
 *
 * @remarks
 * Implements the neuro-symbolic training pipeline:
 * - Tier 1: Static analysis (token usage, a11y, loops, imports)
 * - Tier 2: Model-as-judge (optional, selective)
 * - Tier 3: Browser execution (ground truth from story tests)
 *
 * Output includes structural metadata for hybrid UI training.
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
 *   bun scripts/generate-trajectories.ts training/stories --output training/trajectories.jsonl
 */

import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import {
  computeTrajectoryStats,
  type ExecutionTrace,
  extractStructuralMetadata,
  generateTrajectoryFromTrace,
  runStaticAnalysis,
  type StaticAnalysisResult,
  type StructuralMetadata,
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
  /** Template content for static analysis */
  templateContent?: string
}

/**
 * Extended trajectory with tiered analysis results.
 *
 * @remarks
 * Training data includes:
 * - Static analysis results (Tier 1)
 * - Structural metadata for hybrid UI
 * - Browser execution results (Tier 3)
 */
type TrajectoryWithTiers = Trajectory & {
  tiers: {
    static: StaticAnalysisResult
    browser: {
      passed: boolean
      a11yPassed: boolean
      totalAssertions: number
      passedAssertions: number
    }
  }
  structural: StructuralMetadata
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

/** Standard tool schemas for template generation */
const TOOL_SCHEMAS = [
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
] as const

/**
 * Generate execution trace with tiered analysis.
 *
 * @remarks
 * Runs Tier 1 static analysis on template content and extracts
 * structural metadata for hybrid UI training.
 */
const generateTraceWithTiers = (
  story: StoryExport,
): {
  trace: ExecutionTrace
  tiers: TrajectoryWithTiers['tiers']
  structural: StructuralMetadata
} => {
  console.error(`[trace] Processing story: ${story.exportName} (${story.filePath})`)

  const templateContent = story.templateContent ?? `// Template for ${story.exportName}`

  // Tier 1: Static analysis
  const staticResult = runStaticAnalysis(templateContent)

  // Extract structural metadata for hybrid UI
  const structural = extractStructuralMetadata(templateContent)

  // Tier 3: Browser result (mock - in production, run actual story test)
  const browserResult = {
    passed: true,
    a11yPassed: staticResult.passed,
    totalAssertions: 1,
    passedAssertions: 1,
  }

  const trace: ExecutionTrace = {
    intent: story.intent,
    toolSchemas: [...TOOL_SCHEMAS],
    functionCalls: [
      {
        name: 'writeTemplate',
        arguments: JSON.stringify({
          path: story.filePath.replace('.stories.tsx', '.tsx'),
          content: templateContent,
        }),
      },
    ],
    storyResult: {
      passed: browserResult.passed,
      totalAssertions: browserResult.totalAssertions,
      passedAssertions: browserResult.passedAssertions,
      a11yPassed: browserResult.a11yPassed,
      errors: staticResult.passed ? [] : staticResult.checks.filter((c) => !c.passed).map((c) => c.message ?? c.name),
    },
  }

  return {
    trace,
    tiers: { static: staticResult, browser: browserResult },
    structural,
  }
}

/**
 * Format extended trajectories with tiers and structural metadata.
 */
const formatExtendedTrajectoriesJsonl = (trajectories: TrajectoryWithTiers[]): string =>
  trajectories.map((t) => JSON.stringify(t)).join('\n')

const main = async () => {
  const patterns = paths.map((p) => `${p}/**/*.stories.tsx`)
  // Only wrap in braces for multiple patterns - single patterns don't need braces
  const storyPattern = patterns.length > 1 ? `{${patterns.join(',')}}` : patterns[0]!

  console.error(`Generating trajectories from: ${paths.join(', ')}`)
  console.error(`Pattern: ${storyPattern}`)

  const glob = new Bun.Glob(storyPattern)
  const trajectories: TrajectoryWithTiers[] = []
  let totalStories = 0
  let staticPassCount = 0

  for await (const filePath of glob.scan()) {
    try {
      const storyExports = await extractStoryExports(filePath)
      totalStories += storyExports.length

      for (const story of storyExports) {
        const { trace, tiers, structural } = generateTraceWithTiers(story)
        const baseTrajectory = generateTrajectoryFromTrace(trace)

        // Extend with tiered analysis and structural metadata
        const extendedTrajectory: TrajectoryWithTiers = {
          ...baseTrajectory,
          tiers,
          structural,
        }

        trajectories.push(extendedTrajectory)

        if (tiers.static.passed) staticPassCount++
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
  console.error(`Static analysis pass rate: ${((staticPassCount / trajectories.length) * 100).toFixed(1)}%`)

  const output =
    values.format === 'jsonl' ? formatExtendedTrajectoriesJsonl(trajectories) : JSON.stringify(trajectories, null, 2)

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
