#!/usr/bin/env bun

/**
 * Execute evaluation prompts against an ACP agent.
 *
 * @remarks
 * Connects to an ACP-compatible agent (Claude Code, Droid, etc.) and
 * runs evaluation prompts, capturing full trajectories for analysis.
 *
 * Usage:
 *   bun scripts/run-harness.ts <prompts.jsonl> --agent <command> -o <results.jsonl>
 */

import { appendFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import type { PlanEntry, SessionNotification, ToolCall } from '@agentclientprotocol/sdk'
import { createACPClient, createPrompt } from 'plaited/acp'
import { z } from 'zod'

// ============================================================================
// Schemas (SDK-compatible MCP server format)
// ============================================================================

const EnvVariableSchema = z.object({
  name: z.string(),
  value: z.string(),
})

const HttpHeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
})

const McpServerStdioSchema = z.object({
  type: z.literal('stdio').optional(),
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()),
  env: z.array(EnvVariableSchema),
})

const McpServerHttpSchema = z.object({
  type: z.literal('http'),
  name: z.string(),
  url: z.string(),
  headers: z.array(HttpHeaderSchema),
})

const McpServerSchema = z.union([McpServerStdioSchema, McpServerHttpSchema])

const PromptCaseSchema = z.object({
  id: z.string(),
  input: z.string(),
  expected: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  timeout: z.number().optional(),
})

const ToolInputSchema = z
  .object({
    file_path: z.string().optional(),
    path: z.string().optional(),
    content: z.string().optional(),
    new_string: z.string().optional(),
  })
  .passthrough()

// ============================================================================
// Types
// ============================================================================

type McpServerConfig = z.infer<typeof McpServerSchema>
type PromptCase = z.infer<typeof PromptCaseSchema>

/** Trajectory step types */
type TrajectoryStep =
  | { type: 'thought'; content: string; timestamp: number }
  | { type: 'message'; content: string; timestamp: number }
  | {
      type: 'tool_call'
      name: string
      status: string
      input?: unknown
      output?: unknown
      duration?: number
      timestamp: number
    }
  | { type: 'plan'; entries: PlanEntry[]; timestamp: number }

/** Full output format */
type FullResult = {
  id: string
  input: string
  output: string
  expected?: string
  trajectory: TrajectoryStep[]
  metadata: Record<string, unknown>
  timing: {
    start: number
    end: number
    firstResponse?: number
  }
  status: 'passed' | 'failed' | 'error' | 'timeout'
  errors?: string[]
}

/** Summary output format */
type SummaryResult = {
  id: string
  input: string
  output: string
  toolCalls: string[]
  status: 'passed' | 'failed' | 'error' | 'timeout'
  duration: number
}

type OutputFormat = 'summary' | 'judge'

/** Step with unique ID for judge format correlation */
type IndexedStep = TrajectoryStep & { stepId: string }

// ============================================================================
// Argument Parsing
// ============================================================================

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    agent: {
      type: 'string',
      short: 'a',
      default: 'claude-code-acp',
    },
    output: {
      type: 'string',
      short: 'o',
    },
    cwd: {
      type: 'string',
      short: 'c',
    },
    timeout: {
      type: 'string',
      short: 't',
      default: '60000',
    },
    format: {
      type: 'string',
      short: 'f',
      default: 'summary',
    },
    progress: {
      type: 'boolean',
      default: false,
    },
    append: {
      type: 'boolean',
      default: false,
    },
    'mcp-server': {
      type: 'string',
      multiple: true,
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
Usage: bun scripts/run-harness.ts <prompts.jsonl> [options]

Arguments:
  prompts.jsonl   Input file with evaluation prompts

Options:
  -a, --agent     ACP agent command (default: "claude-code-acp")
  -o, --output    Output file (default: stdout)
  -c, --cwd       Working directory for agent
  -t, --timeout   Request timeout in ms (default: 60000)
  -f, --format    Output format: summary, judge (default: summary)
  --progress      Show progress to stderr
  --append        Append to output file instead of overwriting
  --mcp-server    MCP server config JSON (repeatable)
  -h, --help      Show this help message

Input Format (JSONL):
  {"id":"test-001","input":"Create a button","expected":"should contain <button>","metadata":{"category":"ui"}}

Output Formats:
  summary - Minimal JSONL: id, input, output, toolCalls, status, duration
  judge   - Two-tier output:
            1. Markdown with step IDs and head/tail previews → <output>.md
            2. Full trajectory JSONL for reference → <output>.full.jsonl

Example:
  bun scripts/run-harness.ts prompts.jsonl -o results.jsonl
  bun scripts/run-harness.ts prompts.jsonl --format judge -o results
  bun scripts/run-harness.ts prompts.jsonl --agent droid-acp -o results.jsonl

Note: Requires an ACP-compatible agent. For Claude Code, install the adapter:
  npm install -g @zed-industries/claude-code-acp
  ANTHROPIC_API_KEY=sk-... bun scripts/run-harness.ts prompts.jsonl -o results.jsonl
`)
  process.exit(values.help ? 0 : 1)
}

// ============================================================================
// Helpers
// ============================================================================

/** Parse agent command string into command array */
const parseAgentCommand = (agent: string): string[] => {
  return agent.split(/\s+/).filter(Boolean)
}

/** Parse MCP server config from JSON string (SDK-compatible format) */
const parseMcpServerConfig = (json: string): McpServerConfig => {
  return McpServerSchema.parse(JSON.parse(json))
}

/** Load prompts from JSONL file */
const loadPrompts = async (path: string): Promise<PromptCase[]> => {
  const content = await Bun.file(path).text()
  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      try {
        return PromptCaseSchema.parse(JSON.parse(line))
      } catch (error) {
        throw new Error(`Invalid prompt at line ${index + 1}: ${error instanceof Error ? error.message : error}`)
      }
    })
}

/** Extract trajectory from session notifications */
const extractTrajectory = (notifications: SessionNotification[], startTime: number): TrajectoryStep[] => {
  const trajectory: TrajectoryStep[] = []
  const toolCallMap = new Map<string, { start: number; step: TrajectoryStep & { type: 'tool_call' } }>()

  for (const notification of notifications) {
    const timestamp = Date.now() - startTime
    const update = notification.update

    if (update.sessionUpdate === 'agent_thought_chunk' && update.content.type === 'text') {
      trajectory.push({
        type: 'thought',
        content: update.content.text,
        timestamp,
      })
    } else if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
      trajectory.push({
        type: 'message',
        content: update.content.text,
        timestamp,
      })
    } else if (update.sessionUpdate === 'tool_call') {
      const toolCall = update as ToolCall
      const existing = toolCallMap.get(toolCall.toolCallId)

      if (existing) {
        // Update existing tool call with completion info
        existing.step.status = toolCall.status ?? 'pending'
        if (toolCall.content) {
          existing.step.output = toolCall.content
        }
        if (toolCall.rawOutput) {
          existing.step.output = toolCall.rawOutput
        }
        existing.step.duration = timestamp - existing.start
      } else {
        // New tool call
        const step: TrajectoryStep & { type: 'tool_call' } = {
          type: 'tool_call',
          name: toolCall.title,
          status: toolCall.status ?? 'pending',
          input: toolCall.rawInput,
          timestamp,
        }
        toolCallMap.set(toolCall.toolCallId, { start: timestamp, step })
        trajectory.push(step)
      }
    } else if (update.sessionUpdate === 'plan') {
      trajectory.push({
        type: 'plan',
        entries: update.entries,
        timestamp,
      })
    }
  }

  return trajectory
}

/** Extract final text output from trajectory */
const extractOutput = (trajectory: TrajectoryStep[]): string => {
  return trajectory
    .filter((step): step is TrajectoryStep & { type: 'message' } => step.type === 'message')
    .map((step) => step.content)
    .join('\n')
}

/** Check if any tool calls failed */
const hasToolErrors = (trajectory: TrajectoryStep[]): boolean => {
  return trajectory.some((step) => step.type === 'tool_call' && step.status === 'failed')
}

/** Head/tail preview configuration */
const HEAD_LINES = 8
const TAIL_LINES = 4
const MAX_CONTENT_LENGTH = 500

/** Extract head and tail lines from content */
const headTailPreview = (content: string, headLines = HEAD_LINES, tailLines = TAIL_LINES): string => {
  const lines = content.split('\n')
  if (lines.length <= headLines + tailLines) {
    return content
  }
  const head = lines.slice(0, headLines).join('\n')
  const tail = lines.slice(-tailLines).join('\n')
  const omitted = lines.length - headLines - tailLines
  return `${head}\n\n// ... ${omitted} lines omitted ...\n\n${tail}`
}

/** Extract file path from tool input if present */
const extractFilePath = (input: unknown): string | undefined => {
  const result = ToolInputSchema.safeParse(input)
  if (!result.success) return undefined
  return result.data.file_path ?? result.data.path
}

/** Extract content from tool input if present */
const extractContent = (input: unknown): string | undefined => {
  const result = ToolInputSchema.safeParse(input)
  if (!result.success) return undefined
  return result.data.content ?? result.data.new_string
}

/** Format result as summary JSONL */
const formatSummary = (result: FullResult): string => {
  const summary: SummaryResult = {
    id: result.id,
    input: result.input,
    output: result.output,
    toolCalls: result.trajectory.filter((s) => s.type === 'tool_call').map((s) => (s as { name: string }).name),
    status: result.status,
    duration: result.timing.end - result.timing.start,
  }
  return JSON.stringify(summary)
}

/** Format result as judge markdown with step IDs */
const formatJudgeMarkdown = (result: FullResult): string => {
  const lines: string[] = [
    `## Evaluation Record: ${result.id}`,
    '',
    `**Input:** ${result.input}`,
    '',
    '**Trajectory:**',
  ]

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
        const preview = content.length > MAX_CONTENT_LENGTH ? headTailPreview(content) : content
        // Detect file extension for syntax highlighting
        const ext = filePath?.split('.').pop() ?? 'typescript'
        lines.push(`   \`\`\`${ext}`)
        lines.push(`   ${preview.split('\n').join('\n   ')}`)
        lines.push(`   \`\`\``)
      }
      stepNum++
    } else if (step.type === 'plan') {
      const planSummary = step.entries.map((e) => `${e.content}: ${e.status}`).join(', ')
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
  lines.push(`**Status:** ${result.status}`)
  lines.push(`**Duration:** ${result.timing.end - result.timing.start}ms`)
  lines.push('')
  lines.push('---')
  lines.push('')

  return lines.join('\n')
}

/** Add step IDs to trajectory for full JSONL output */
const addStepIds = (result: FullResult): FullResult & { trajectory: IndexedStep[] } => {
  let stepNum = 1
  const indexedTrajectory = result.trajectory.map((step) => ({
    ...step,
    stepId: `${result.id}-step-${stepNum++}`,
  }))
  return { ...result, trajectory: indexedTrajectory }
}

/** Format result based on output format (returns markdown for judge, JSONL for summary) */
const formatResult = (result: FullResult, format: OutputFormat): string => {
  if (format === 'summary') {
    return formatSummary(result)
  }
  // Judge format returns markdown
  return formatJudgeMarkdown(result)
}

/** Format result as full JSONL with step IDs (for judge format's paired file) */
const formatFullWithStepIds = (result: FullResult): string => {
  return JSON.stringify(addStepIds(result))
}

/** Write output line (to stdout or file) */
const writeOutput = async (line: string, outputPath?: string, append?: boolean): Promise<void> => {
  if (outputPath) {
    if (append) {
      await appendFile(outputPath, `${line}\n`)
    } else {
      await Bun.write(outputPath, `${line}\n`)
    }
  } else {
    console.log(line)
  }
}

/** Log progress to stderr (doesn't pollute stdout) */
const logProgress = (message: string, showProgress: boolean): void => {
  if (showProgress) {
    console.error(message)
  }
}

/** Resolve path relative to process.cwd() */
const resolvePath = (path: string): string => {
  if (path.startsWith('/')) return path
  return `${process.cwd()}/${path}`
}

// ============================================================================
// Main
// ============================================================================

const main = async () => {
  const promptsPath = positionals[0]
  if (!promptsPath) {
    console.error('Error: prompts.jsonl path is required')
    process.exit(1)
  }

  const agentCommand = parseAgentCommand(values.agent ?? 'claude-code-acp')
  const outputPath = values.output
  const timeout = Number.parseInt(values.timeout ?? '60000', 10)
  const cwd = values.cwd
  const format = (values.format ?? 'summary') as OutputFormat
  const showProgress = values.progress ?? false
  const appendOutput = values.append ?? false

  // Validate format
  if (!['summary', 'judge'].includes(format)) {
    console.error(`Error: Invalid format "${format}". Must be: summary, judge`)
    process.exit(1)
  }

  // Judge format requires output path (creates two files)
  if (format === 'judge' && !outputPath) {
    console.error('Error: --format judge requires --output <path> (creates <path>.md and <path>.full.jsonl)')
    process.exit(1)
  }

  // Parse MCP server configurations (already SDK-compatible format)
  const mcpServers = (values['mcp-server'] ?? []).map(parseMcpServerConfig)

  // Load prompts
  const prompts = await loadPrompts(promptsPath)

  // Resolve output path relative to process.cwd()
  const resolvedOutputPath = outputPath ? resolvePath(outputPath) : undefined

  // Compute output paths for judge format (creates two files)
  const judgeMarkdownPath = format === 'judge' && resolvedOutputPath ? `${resolvedOutputPath}.md` : undefined
  const judgeFullPath = format === 'judge' && resolvedOutputPath ? `${resolvedOutputPath}.full.jsonl` : undefined

  // Log progress info
  logProgress(`Loaded ${prompts.length} prompts from ${promptsPath}`, showProgress)
  logProgress(`Agent: ${agentCommand.join(' ')}`, showProgress)
  logProgress(`Format: ${format}`, showProgress)
  if (format === 'judge') {
    logProgress(`Output: ${judgeMarkdownPath} + ${judgeFullPath}`, showProgress)
  } else if (resolvedOutputPath) {
    logProgress(`Output: ${resolvedOutputPath}`, showProgress)
  }
  if (mcpServers.length > 0) {
    logProgress(`MCP Servers: ${mcpServers.map((s) => s.name).join(', ')}`, showProgress)
  }

  // Create ACP client
  const client = createACPClient({
    command: agentCommand,
    cwd,
    timeout,
  })

  // Clear output file(s) if not appending
  if (resolvedOutputPath && !appendOutput) {
    if (format === 'judge') {
      await Bun.write(judgeMarkdownPath!, '')
      await Bun.write(judgeFullPath!, '')
    } else {
      await Bun.write(resolvedOutputPath, '')
    }
  }

  // Session params with MCP servers
  const sessionParams = {
    cwd: cwd ?? process.cwd(),
    mcpServers,
  }

  let isFirstOutput = true

  try {
    logProgress('Connecting to agent...', showProgress)
    await client.connect()
    logProgress('Connected!', showProgress)

    // Create session with MCP servers
    const session = await client.createSession(sessionParams)
    logProgress(`Session: ${session.id}`, showProgress)

    // Run evaluations sequentially
    for (let i = 0; i < prompts.length; i++) {
      const promptCase = prompts[i]
      if (!promptCase) continue

      logProgress(`[${i + 1}/${prompts.length}] ${promptCase.id}: ${promptCase.input.slice(0, 50)}...`, showProgress)

      const startTime = Date.now()
      let result: FullResult

      try {
        const prompt = createPrompt(promptCase.input)
        const { updates } = await client.promptSync(session.id, prompt)

        const endTime = Date.now()
        const trajectory = extractTrajectory(updates, startTime)
        const output = extractOutput(trajectory)
        const hasErrors = hasToolErrors(trajectory)

        result = {
          id: promptCase.id,
          input: promptCase.input,
          output,
          ...(promptCase.expected && { expected: promptCase.expected }),
          trajectory,
          metadata: {
            ...promptCase.metadata,
            agent: agentCommand.join(' '),
          },
          timing: {
            start: startTime,
            end: endTime,
            firstResponse: trajectory.length > 0 ? trajectory[0]?.timestamp : undefined,
          },
          status: hasErrors ? 'failed' : 'passed',
        }
      } catch (error) {
        const endTime = Date.now()
        const message = error instanceof Error ? error.message : String(error)
        const isTimeout = message.includes('timeout') || message.includes('timed out')

        result = {
          id: promptCase.id,
          input: promptCase.input,
          output: '',
          trajectory: [],
          metadata: {
            ...promptCase.metadata,
            agent: agentCommand.join(' '),
          },
          timing: {
            start: startTime,
            end: endTime,
          },
          status: isTimeout ? 'timeout' : 'error',
          errors: [message],
        }
      }

      // Format and output result
      if (format === 'judge') {
        // Judge format: write markdown to .md, full JSONL to .full.jsonl
        const markdown = formatJudgeMarkdown(result)
        const fullJsonl = formatFullWithStepIds(result)
        await writeOutput(markdown, judgeMarkdownPath, !isFirstOutput)
        await writeOutput(fullJsonl, judgeFullPath, !isFirstOutput)
      } else {
        // Summary format: write to single file
        const formatted = formatResult(result, format)
        await writeOutput(formatted, resolvedOutputPath, !isFirstOutput)
      }
      isFirstOutput = false

      const statusIcon = result.status === 'passed' ? '✓' : result.status === 'failed' ? '✗' : '!'
      logProgress(`  ${statusIcon} ${result.status} (${result.timing.end - result.timing.start}ms)`, showProgress)
    }
  } finally {
    logProgress('Disconnecting...', showProgress)
    await client.disconnect()
  }

  logProgress('Done!', showProgress)
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
