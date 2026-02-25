/**
 * Calibrate command - sample failures for grader review.
 *
 * @remarks
 * Helps identify grader bugs by sampling failures for human review.
 * Can optionally re-score with a different grader for comparison.
 *
 * @packageDocumentation
 */

import { parseArgs } from 'node:util'
import { loadResults, resolvePath } from '../core.ts'
import { DEFAULT_CALIBRATION_SAMPLE_SIZE } from '../schemas/constants.ts'
import { loadGraderOrExit } from '../schemas/grader-loader.ts'
import type { CalibrationSample, Grader, GraderResult, TrajectoryStep } from '../schemas.ts'

// ============================================================================
// Types
// ============================================================================

/** Configuration for calibrate command */
export type CalibrateConfig = {
  /** Path to results.jsonl file */
  resultsPath: string
  /** Output file path */
  outputPath?: string
  /** Number of samples to include */
  sample?: number
  /** Optional grader for re-scoring */
  grader?: Grader
}

/**
 * Randomly sample n elements from an array using Fisher-Yates shuffle.
 *
 * @param arr - Array to sample from
 * @param n - Number of samples to take
 * @returns Array of sampled elements in random order
 *
 * @remarks
 * Uses Fisher-Yates (Knuth) shuffle for uniform distribution.
 * Creates a copy to avoid mutating the input array.
 * O(n) time complexity with O(n) space for the copy.
 * Not cryptographically secure (uses Math.random).
 *
 * @public
 */
export const sampleArray = <T>(arr: T[], n: number): T[] => {
  if (n <= 0) return []
  if (n >= arr.length) return [...arr]

  const copy = [...arr]

  // Fisher-Yates shuffle working backwards through array
  // Only shuffle enough elements to get n samples
  const limit = copy.length - n
  for (let i = copy.length - 1; i >= limit && i > 0; i--) {
    // Random index from 0 to i (inclusive)
    const j = Math.floor(Math.random() * (i + 1))
    // Swap elements
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }

  return copy.slice(-n)
}

/**
 * Get snippet of trajectory for review.
 *
 * @remarks
 * Includes first 2 steps, middle step, and last 2 steps.
 *
 * @param trajectory - Full trajectory
 * @param maxSteps - Maximum number of steps to include
 * @returns Trajectory snippet
 *
 * @public
 */
export const getTrajectorySnippet = (trajectory: TrajectoryStep[], maxSteps = 5): TrajectoryStep[] => {
  // Include first and last steps, plus some from the middle
  if (trajectory.length <= maxSteps) return trajectory

  const result: TrajectoryStep[] = []

  // First 2 steps
  result.push(...trajectory.slice(0, 2))

  // Middle step
  const mid = Math.floor(trajectory.length / 2)
  result.push(trajectory[mid] as TrajectoryStep)

  // Last 2 steps
  result.push(...trajectory.slice(-2))

  return result
}

/** Format calibration sample as markdown */
const formatCalibrationMarkdown = (samples: CalibrationSample[]): string => {
  const lines: string[] = [
    '# Grader Calibration Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Samples: ${samples.length}`,
    '',
    '## Instructions',
    '',
    'Review each failure below and mark whether:',
    '- [ ] **Valid failure** - Grader correctly identified a problem',
    '- [ ] **Grader bug** - Output was actually correct, grader was wrong',
    '- [ ] **Ambiguous** - Unclear if the output is correct or not',
    '',
    '---',
    '',
  ]

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]
    if (!sample) continue

    lines.push(`## Sample ${i + 1}: ${sample.id}`)
    lines.push('')
    lines.push(`**Input:** ${sample.input}`)
    lines.push('')

    if (sample.hint) {
      lines.push(`**Hint:** ${sample.hint}`)
      lines.push('')
    }

    lines.push(`**Output:** ${sample.output.slice(0, 500)}${sample.output.length > 500 ? '...' : ''}`)
    lines.push('')

    lines.push(`**Original Score:** ${sample.originalScore.pass ? 'PASS' : 'FAIL'} (${sample.originalScore.score})`)
    if (sample.originalScore.reasoning) {
      lines.push(`**Reasoning:** ${sample.originalScore.reasoning}`)
    }
    lines.push('')

    if (sample.rescoredResult) {
      lines.push(`**Re-scored:** ${sample.rescoredResult.pass ? 'PASS' : 'FAIL'} (${sample.rescoredResult.score})`)
      if (sample.rescoredResult.reasoning) {
        lines.push(`**Re-score Reasoning:** ${sample.rescoredResult.reasoning}`)
      }
      lines.push('')
    }

    lines.push('**Trajectory Snippet:**')
    lines.push('```')
    for (const step of sample.trajectorySnippet) {
      if (step.type === 'tool_call') {
        lines.push(`[${step.type}] ${step.name}: ${step.status}`)
      } else if (step.type === 'message' || step.type === 'thought') {
        lines.push(`[${step.type}] ${step.content.slice(0, 100)}...`)
      } else if (step.type === 'plan') {
        lines.push(`[${step.type}] ${(step.entries as Array<{ content: string }>).length} entries`)
      }
    }
    lines.push('```')
    lines.push('')

    lines.push('**Review:**')
    lines.push('- [ ] Valid failure')
    lines.push('- [ ] Grader bug')
    lines.push('- [ ] Ambiguous')
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

// ============================================================================
// Calibrate Implementation
// ============================================================================

/**
 * Execute calibrate with configuration object.
 *
 * @param config - Calibrate configuration
 * @returns Calibration samples
 */
export const runCalibrate = async (config: CalibrateConfig): Promise<CalibrationSample[]> => {
  const { resultsPath, outputPath, sample = DEFAULT_CALIBRATION_SAMPLE_SIZE, grader } = config

  // Load results
  const results = await loadResults(resultsPath)

  // Filter to failures (or results without scores)
  const failures = results.filter((r) => r.score && !r.score.pass)

  if (failures.length === 0) {
    console.error('No failures found in results')
    return []
  }

  // Sample failures
  const sampled = sampleArray(failures, Math.min(sample, failures.length))

  // Build calibration samples
  const samples: CalibrationSample[] = []

  for (const result of sampled) {
    const calibrationSample: CalibrationSample = {
      id: result.id,
      input: result.input,
      output: result.output,
      hint: result.hint,
      originalScore: result.score as GraderResult,
      trajectorySnippet: getTrajectorySnippet(result.trajectory),
    }

    // Re-score with different grader if provided
    if (grader) {
      calibrationSample.rescoredResult = await grader({
        input: result.input,
        output: result.output,
        hint: result.hint,
        trajectory: result.trajectory,
        metadata: result.metadata,
      })
    }

    samples.push(calibrationSample)
  }

  // Format as markdown
  const markdown = formatCalibrationMarkdown(samples)

  // Write output
  if (outputPath) {
    await Bun.write(resolvePath(outputPath), markdown)
  } else {
    console.log(markdown)
  }

  return samples
}

// ============================================================================
// CLI Entry Point
// ============================================================================

/**
 * Calibrate command CLI handler.
 *
 * @param args - Command line arguments (after 'calibrate')
 */
export const calibrate = async (args: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args,
    options: {
      output: { type: 'string', short: 'o' },
      sample: { type: 'string', short: 's', default: String(DEFAULT_CALIBRATION_SAMPLE_SIZE) },
      grader: { type: 'string', short: 'g' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  })

  if (values.help) {
    console.log(`
Usage: agent-eval-harness calibrate <results.jsonl> [options]

Arguments:
  results.jsonl     Input file with scored capture results

Options:
  -o, --output      Output file (default: stdout)
  -s, --sample      Number of failures to sample (default: ${DEFAULT_CALIBRATION_SAMPLE_SIZE})
  -g, --grader      Path to alternative grader (.ts/.js module or executable script)
  -h, --help        Show this help message

Output:
  Markdown report with sampled failures for human review.
  Includes checkboxes for labeling (valid failure / grader bug / ambiguous).

Examples:
  # Sample failures for review
  agent-eval-harness calibrate results.jsonl --sample 10 -o calibration.md

  # Re-score with different grader to compare
  agent-eval-harness calibrate results.jsonl --grader ./loose-grader.ts -o comparison.md
`)
    return
  }

  const resultsPath = positionals[0]
  if (!resultsPath) {
    console.error('Error: results.jsonl path is required')
    process.exit(1)
  }

  // Load grader if specified
  const grader = values.grader ? await loadGraderOrExit(values.grader) : undefined

  await runCalibrate({
    resultsPath,
    outputPath: values.output,
    sample: Number.parseInt(values.sample ?? String(DEFAULT_CALIBRATION_SAMPLE_SIZE), 10),
    grader,
  })
}
