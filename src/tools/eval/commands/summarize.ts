/**
 * Summarize command - derive compact views from full trajectory results.
 *
 * @remarks
 * Transforms full trajectory JSONL into:
 * - Summary JSONL: Compact format for jq analysis
 * - Markdown: Human-readable format for LLM-as-judge workflows
 *
 * @packageDocumentation
 */

import { parseArgs } from 'node:util'
import { extractContent, extractFilePath, headTailPreview, loadResults, resolvePath } from '../core.ts'
import { HEAD_LINES, MAX_CONTENT_LENGTH, TAIL_LINES } from '../schemas/constants.ts'
import type { CaptureResult, SummaryResult } from '../schemas.ts'

// ============================================================================
// Types
// ============================================================================

/** Configuration for summarize command */
export type SummarizeConfig = {
  /** Path to results.jsonl file */
  resultsPath: string
  /** Output file path */
  outputPath?: string
  /** Output as markdown instead of JSONL */
  markdown?: boolean
}

/**
 * Format capture result as compact summary.
 *
 * @param result - Full capture result
 * @returns Compact summary result
 *
 * @public
 */
export const formatSummary = (result: CaptureResult): SummaryResult => {
  const inputText = Array.isArray(result.input) ? result.input.join('\n') : result.input
  return {
    id: result.id,
    input: inputText,
    output: result.output,
    toolCalls: result.trajectory.flatMap((s) => (s.type === 'tool_call' ? [s.name] : [])),
    duration: result.timing.end - result.timing.start,
  }
}

/**
 * Format capture result as markdown with step IDs.
 *
 * @param result - Full capture result
 * @returns Markdown formatted string
 *
 * @public
 */
export const formatMarkdown = (result: CaptureResult): string => {
  const inputText = Array.isArray(result.input) ? result.input.join('\n') : result.input
  const lines: string[] = [`## Evaluation Record: ${result.id}`, '', `**Input:** ${inputText}`, '', '**Trajectory:**']

  let stepNum = 1
  for (const step of result.trajectory) {
    const stepId = `${result.id}-step-${stepNum}`

    if (step.type === 'thought') {
      const preview = step.content.slice(0, 100)
      const truncated = step.content.length > 100 ? '...' : ''
      lines.push(`${stepNum}. [THOUGHT] ${preview}${truncated} [→${stepId}]`)
      stepNum++
    } else if (step.type === 'tool_call') {
      const duration = step.duration ? ` (${step.duration}ms)` : ''
      const filePath = extractFilePath(step.input)
      const content = extractContent(step.input)

      lines.push(`${stepNum}. [TOOL:${step.name}] -> ${step.status}${duration} [→${stepId}]`)

      // Add file path if present
      if (filePath) {
        const charCount = content?.length ?? 0
        lines.push(`   File: ${filePath}${charCount > 0 ? ` (${charCount} chars)` : ''}`)
      }

      // Add head/tail preview for content-producing tools
      if (content && content.length > 0) {
        const preview = content.length > MAX_CONTENT_LENGTH ? headTailPreview(content, HEAD_LINES, TAIL_LINES) : content
        // Detect file extension for syntax highlighting
        const ext = filePath?.split('.').pop() ?? 'typescript'
        lines.push(`   \`\`\`${ext}`)
        lines.push(`   ${preview.split('\n').join('\n   ')}`)
        lines.push('   ```')
      }
      stepNum++
    } else if (step.type === 'plan') {
      const entries = step.entries as Array<{ content: string; status: string }>
      const planSummary = entries.map((e) => `${e.content}: ${e.status}`).join(', ')
      const truncated = planSummary.length > 80 ? '...' : ''
      lines.push(`${stepNum}. [PLAN] ${planSummary.slice(0, 80)}${truncated} [→${stepId}]`)
      stepNum++
    } else if (step.type === 'message') {
      const preview = step.content.slice(0, 100)
      const truncated = step.content.length > 100 ? '...' : ''
      lines.push(`${stepNum}. [MESSAGE] ${preview}${truncated} [→${stepId}]`)
      stepNum++
    }
  }

  lines.push('')
  const outputPreview = result.output.slice(0, 200)
  const outputTruncated = result.output.length > 200 ? '...' : ''
  lines.push(`**Output:** ${outputPreview}${outputTruncated}`)
  lines.push('')

  const metadataStr = Object.entries(result.metadata)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ')
  lines.push(`**Metadata:** ${metadataStr}`)
  lines.push(`**Tool Errors:** ${result.toolErrors}`)
  lines.push(`**Duration:** ${result.timing.end - result.timing.start}ms`)

  if (result.score) {
    lines.push(`**Score:** ${result.score.pass ? 'PASS' : 'FAIL'} (${result.score.score})`)
    if (result.score.reasoning) {
      lines.push(`**Reasoning:** ${result.score.reasoning}`)
    }
  }

  lines.push('')
  lines.push('---')
  lines.push('')

  return lines.join('\n')
}

// ============================================================================
// Summarize Implementation
// ============================================================================

/**
 * Execute summarize with configuration object.
 *
 * @param config - Summarize configuration
 * @returns Formatted output string
 */
export const runSummarize = async (config: SummarizeConfig): Promise<string> => {
  const { resultsPath, outputPath, markdown = false } = config

  // Load results
  const results = await loadResults(resultsPath)

  // Format output
  let output: string
  if (markdown) {
    output = results.map(formatMarkdown).join('\n')
  } else {
    output = results.map((r) => JSON.stringify(formatSummary(r))).join('\n')
  }

  // Write output
  if (outputPath) {
    await Bun.write(resolvePath(outputPath), output)
  } else {
    console.log(output)
  }

  return output
}

// ============================================================================
// CLI Entry Point
// ============================================================================

/**
 * Summarize command CLI handler.
 *
 * @param args - Command line arguments (after 'summarize')
 */
export const summarize = async (args: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args,
    options: {
      output: { type: 'string', short: 'o' },
      markdown: { type: 'boolean', short: 'm', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  })

  if (values.help) {
    console.log(`
Usage: agent-eval-harness summarize <results.jsonl> [options]

Arguments:
  results.jsonl     Input file with capture results

Options:
  -o, --output      Output file (default: stdout)
  -m, --markdown    Output as markdown instead of JSONL
  -h, --help        Show this help message

Output Formats:
  JSONL (default): Compact summary with id, input, output, toolCalls, duration
  Markdown (-m):   Human-readable format with step IDs for LLM-as-judge

Examples:
  # Summary JSONL for jq analysis
  agent-eval-harness summarize results.jsonl -o summary.jsonl

  # Markdown for LLM evaluation
  agent-eval-harness summarize results.jsonl --markdown -o results.md
`)
    return
  }

  const resultsPath = positionals[0]
  if (!resultsPath) {
    console.error('Error: results.jsonl path is required')
    process.exit(1)
  }

  await runSummarize({
    resultsPath,
    outputPath: values.output,
    markdown: values.markdown ?? false,
  })
}
