/**
 * Pipeline grade command - apply grader to extracted results.
 *
 * @remarks
 * Takes ExtractedResult from `extract` command and adds grader scores.
 * Uses the same grader loading mechanism as the capture command.
 *
 * @packageDocumentation
 */

import { parseArgs } from 'node:util'
import { loadJsonl, logProgress, writeOutput } from '../core.ts'
import { loadGrader } from '../schemas/grader-loader.ts'
import type { ExtractedResult, GradedResult } from './pipeline.types.ts'

/**
 * Execute pipeline grade with configuration.
 *
 * @param graderPath - Path to grader module or executable
 * @param extractedResults - Extracted results from extract command
 * @param outputPath - Optional output file path
 * @param progress - Show progress to stderr
 */
export const runGrade = async (
  graderPath: string,
  extractedResults: ExtractedResult[],
  outputPath?: string,
  progress = false,
): Promise<void> => {
  // Load grader
  const grader = await loadGrader(graderPath)

  logProgress(`Grading with: ${graderPath}`, progress)

  let isFirstOutput = true

  // Clear output file if specified
  if (outputPath) {
    await Bun.write(outputPath, '')
  }

  for (let i = 0; i < extractedResults.length; i++) {
    const extracted = extractedResults[i]
    if (!extracted) continue

    logProgress(`[${i + 1}/${extractedResults.length}] ${extracted.id}`, progress)

    // Apply grader
    const score = await grader({
      input: extracted.input,
      output: extracted.output,
      hint: extracted.hint,
      trajectory: extracted.trajectory,
      metadata: extracted.metadata,
      cwd: extracted.cwd,
    })

    const graded: GradedResult = {
      ...extracted,
      score,
    }

    // Merge outcome from grader if present
    if (score.outcome) {
      graded.outcome = score.outcome
    }

    const icon = score.pass ? '✓' : '✗'
    logProgress(`  ${icon} score=${score.score.toFixed(2)}`, progress)

    await writeOutput(JSON.stringify(graded), outputPath, !isFirstOutput)
    isFirstOutput = false
  }

  logProgress('Done!', progress)
}

/**
 * Read extracted results from stdin.
 *
 * @returns Array of parsed extracted results or null if stdin is empty
 */
const readStdinExtracted = async (): Promise<ExtractedResult[] | null> => {
  if (process.stdin.isTTY) {
    return null
  }

  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }

  const content = Buffer.concat(chunks).toString('utf-8').trim()
  if (!content) return null

  return content
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ExtractedResult)
}

/**
 * Pipeline grade command CLI handler.
 *
 * @param args - Command line arguments (after 'grade')
 */
export const grade = async (args: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args,
    options: {
      grader: { type: 'string', short: 'g' },
      output: { type: 'string', short: 'o' },
      progress: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  })

  if (values.help) {
    console.log(`
Usage: agent-eval-harness grade [extracted.jsonl] --grader <grader> [options]

Apply grader to extracted results.

Arguments:
  extracted.jsonl   Input file from 'extract' command (or pipe from stdin)

Options:
  -g, --grader      Path to grader (.ts/.js module or executable script) (required)
  -o, --output      Output file (default: stdout)
  --progress        Show progress to stderr
  -h, --help        Show this help message

Graders:
  TS/JS modules must export a 'grade' function.
  Executable scripts (Python, etc.) use stdin/stdout JSON protocol.

Examples:
  # From file
  agent-eval-harness grade extracted.jsonl --grader ./grader.ts -o graded.jsonl

  # Piped from extract
  agent-eval-harness extract raw.jsonl -s claude.json | agent-eval-harness grade -g ./grader.ts

  # Full pipeline
  cat prompts.jsonl | \\
    agent-eval-harness run -s claude.json | \\
    agent-eval-harness extract -s claude.json | \\
    agent-eval-harness grade -g ./grader.ts > results.jsonl
`)
    return
  }

  if (!values.grader) {
    console.error('Error: --grader is required')
    process.exit(1)
  }

  // Load extracted results from file or stdin
  const inputPath = positionals[0]
  let extractedResults: ExtractedResult[]

  if (inputPath) {
    extractedResults = await loadJsonl<ExtractedResult>(inputPath)
  } else {
    const stdinResults = await readStdinExtracted()
    if (!stdinResults || stdinResults.length === 0) {
      console.error('Error: No extracted results provided (use file argument or pipe to stdin)')
      process.exit(1)
    }
    extractedResults = stdinResults
  }

  await runGrade(values.grader, extractedResults, values.output, values.progress)
}
