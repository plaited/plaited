/**
 * Pipeline format command - convert results to different output formats.
 *
 * @remarks
 * Transforms graded or extracted results into various formats:
 * - jsonl: Pass-through JSONL (default)
 * - markdown: Human-readable report
 * - csv: Comma-separated values for spreadsheets
 *
 * @packageDocumentation
 */

import { parseArgs } from 'node:util'
import { loadJsonl, logProgress, writeOutput } from '../core.ts'
import type { CaptureResult } from '../schemas.ts'
import type { ExtractedResult, FormatStyle, GradedResult } from './pipeline.types.ts'

/** Union of all formattable result types */
type FormattableResult = ExtractedResult | GradedResult | CaptureResult

/**
 * Check if result has a score (graded).
 */
const isGraded = (
  result: FormattableResult,
): result is GradedResult | (CaptureResult & { score: NonNullable<CaptureResult['score']> }) => {
  return 'score' in result && result.score !== undefined
}

/**
 * Format results as markdown report.
 *
 * @param results - Results to format
 * @returns Markdown string
 */
const formatMarkdown = (results: FormattableResult[]): string => {
  const lines: string[] = [
    '# Evaluation Results',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Total: ${results.length} test cases`,
    '',
  ]

  // Summary statistics if graded
  const gradedResults = results.filter(isGraded)
  if (gradedResults.length > 0) {
    const passed = gradedResults.filter((r) => r.score.pass).length
    const avgScore = gradedResults.reduce((sum, r) => sum + r.score.score, 0) / gradedResults.length

    lines.push('## Summary')
    lines.push('')
    lines.push(
      `- **Pass rate**: ${passed}/${gradedResults.length} (${((passed / gradedResults.length) * 100).toFixed(1)}%)`,
    )
    lines.push(`- **Average score**: ${avgScore.toFixed(3)}`)
    lines.push('')
  }

  lines.push('## Results')
  lines.push('')

  for (const result of results) {
    const input = Array.isArray(result.input) ? result.input.join(' → ') : result.input
    const inputPreview = input.length > 100 ? `${input.slice(0, 100)}...` : input

    lines.push(`### ${result.id}`)
    lines.push('')
    lines.push(`**Input**: ${inputPreview}`)
    lines.push('')

    if (result.hint) {
      lines.push(`**Hint**: ${result.hint}`)
      lines.push('')
    }

    const outputPreview = result.output.length > 500 ? `${result.output.slice(0, 500)}...` : result.output
    lines.push(`**Output**:`)
    lines.push('```')
    lines.push(outputPreview)
    lines.push('```')
    lines.push('')

    if (isGraded(result)) {
      const icon = result.score.pass ? '✅' : '❌'
      lines.push(`**Score**: ${icon} ${result.score.score.toFixed(3)} (${result.score.pass ? 'PASS' : 'FAIL'})`)
      if (result.score.reasoning) {
        lines.push(`**Reasoning**: ${result.score.reasoning}`)
      }
      lines.push('')
    }

    if (result.toolErrors) {
      lines.push('⚠️ **Tool errors detected**')
      lines.push('')
    }

    if ('error' in result && result.error) {
      lines.push(`❌ **Error**: ${result.error}`)
      lines.push('')
    }

    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Format results as CSV.
 *
 * @param results - Results to format
 * @returns CSV string
 */
const formatCsv = (results: FormattableResult[]): string => {
  const lines: string[] = []

  // Header
  const hasScores = results.some(isGraded)
  const headers = ['id', 'input', 'hint', 'output', 'tool_errors', 'duration_ms']
  if (hasScores) {
    headers.push('pass', 'score', 'reasoning')
  }
  lines.push(headers.join(','))

  // Data rows
  for (const result of results) {
    const input = Array.isArray(result.input) ? result.input.join(' | ') : result.input
    const escapeCsv = (str: string) => `"${str.replace(/"/g, '""').replace(/\n/g, '\\n')}"`

    const row = [
      escapeCsv(result.id),
      escapeCsv(input),
      escapeCsv(result.hint ?? ''),
      escapeCsv(result.output),
      result.toolErrors ? 'true' : 'false',
      String(result.timing.total),
    ]

    if (hasScores) {
      if (isGraded(result)) {
        row.push(
          result.score.pass ? 'true' : 'false',
          result.score.score.toFixed(3),
          escapeCsv(result.score.reasoning ?? ''),
        )
      } else {
        row.push('', '', '')
      }
    }

    lines.push(row.join(','))
  }

  return lines.join('\n')
}

/**
 * Execute pipeline format with configuration.
 *
 * @param style - Output format style
 * @param results - Results to format
 * @param outputPath - Optional output file path
 * @param progress - Show progress to stderr
 */
export const runFormat = async (
  style: FormatStyle,
  results: FormattableResult[],
  outputPath?: string,
  progress = false,
): Promise<void> => {
  logProgress(`Formatting ${results.length} results as ${style}`, progress)

  let output: string

  switch (style) {
    case 'jsonl':
      // Pass-through as JSONL
      output = results.map((r) => JSON.stringify(r)).join('\n')
      break

    case 'markdown':
      output = formatMarkdown(results)
      break

    case 'csv':
      output = formatCsv(results)
      break
  }

  await writeOutput(output, outputPath, false)
  logProgress('Done!', progress)
}

/**
 * Read results from stdin.
 *
 * @returns Array of parsed results or null if stdin is empty
 */
const readStdinResults = async (): Promise<FormattableResult[] | null> => {
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
    .map((line) => JSON.parse(line) as FormattableResult)
}

/**
 * Pipeline format command CLI handler.
 *
 * @param args - Command line arguments (after 'format')
 */
export const format = async (args: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args,
    options: {
      style: { type: 'string', short: 'f', default: 'jsonl' },
      output: { type: 'string', short: 'o' },
      progress: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  })

  if (values.help) {
    console.log(`
Usage: agent-eval-harness format [results.jsonl] [options]

Convert results to different output formats.

Arguments:
  results.jsonl     Input file (or pipe from stdin)

Options:
  -f, --style       Output format: jsonl, markdown, csv (default: jsonl)
  -o, --output      Output file (default: stdout)
  --progress        Show progress to stderr
  -h, --help        Show this help message

Examples:
  # Convert to markdown report
  agent-eval-harness format graded.jsonl --style markdown -o report.md

  # Piped from grade
  agent-eval-harness grade extracted.jsonl -g ./grader.ts | agent-eval-harness format -f csv

  # Full pipeline to markdown
  cat prompts.jsonl | \\
    agent-eval-harness run -s claude.json | \\
    agent-eval-harness extract -s claude.json | \\
    agent-eval-harness grade -g ./grader.ts | \\
    agent-eval-harness format -f markdown > report.md
`)
    return
  }

  const style = values.style as FormatStyle
  if (!['jsonl', 'markdown', 'csv'].includes(style)) {
    console.error(`Error: Invalid format style '${style}'. Must be: jsonl, markdown, csv`)
    process.exit(1)
  }

  // Load results from file or stdin
  const inputPath = positionals[0]
  let results: FormattableResult[]

  if (inputPath) {
    results = await loadJsonl<FormattableResult>(inputPath)
  } else {
    const stdinResults = await readStdinResults()
    if (!stdinResults || stdinResults.length === 0) {
      console.error('Error: No results provided (use file argument or pipe to stdin)')
      process.exit(1)
    }
    results = stdinResults
  }

  await runFormat(style, results, values.output, values.progress)
}
