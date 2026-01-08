#!/usr/bin/env bun

/**
 * Execute evaluation suite against an ACP agent.
 *
 * @remarks
 * Connects to an ACP-compatible agent (Claude Code, Droid, etc.) and
 * runs evaluation prompts, capturing responses and metrics.
 *
 * Usage:
 *   bun scripts/run-eval.ts <suite.jsonl> --agent <command> -o <results-dir>
 *
 * Example:
 *   bun scripts/run-eval.ts evals/suite.jsonl --agent "claude code" -o results/
 */

import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { createACPClient, createPrompt, summarizeResponse } from 'plaited/acp'

// ============================================================================
// Types
// ============================================================================

type McpServerConfig = {
  type: 'stdio' | 'http' | 'sse'
  name: string
  command?: string[]
  url?: string
  env?: Record<string, string>
  cwd?: string
  headers?: Record<string, string>
}

type EvalCase = {
  id: string
  intent: string
  source: string
  export: string
  expectedTools?: string[]
  timeout?: number
  tags?: string[]
}

type EvalResult = {
  id: string
  status: 'passed' | 'failed' | 'error' | 'timeout'
  response: string
  toolCalls: Array<{
    name: string
    status: string
    duration?: number
  }>
  timing: {
    startTime: number
    firstResponseTime?: number
    endTime: number
    totalDuration: number
  }
  errors?: string[]
  updates: number
}

type EvalSummary = {
  total: number
  passed: number
  failed: number
  errors: number
  timeouts: number
  avgDuration: number
  startTime: string
  endTime: string
  agent: string
}

// ============================================================================
// Argument Parsing
// ============================================================================

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    agent: {
      type: 'string',
      short: 'a',
      default: 'claude code',
    },
    output: {
      type: 'string',
      short: 'o',
      default: 'results/',
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
    concurrency: {
      type: 'string',
      default: '1',
    },
    'mcp-server': {
      type: 'string',
      multiple: true,
      description: 'MCP server config JSON (repeatable)',
    },
    'skills-dir': {
      type: 'string',
      short: 's',
      description: 'Skills directory path (relative to cwd)',
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
Usage: bun scripts/run-eval.ts <suite.jsonl> [options]

Arguments:
  suite.jsonl     Evaluation suite JSONL file

Options:
  -a, --agent       Agent command (default: "claude code")
  -o, --output      Results directory (default: results/)
  -c, --cwd         Working directory for agent
  -t, --timeout     Request timeout in ms (default: 60000)
  --concurrency     Parallel evaluations (default: 1)
  --mcp-server      MCP server config JSON (repeatable)
  -s, --skills-dir  Skills directory path (relative to cwd)
  -h, --help        Show this help message

MCP Server Format:
  --mcp-server '{"type":"stdio","name":"my-server","command":["node","server.js"]}'
  --mcp-server '{"type":"http","name":"api-server","url":"http://localhost:3000"}'

Example:
  bun scripts/run-eval.ts evals/suite.jsonl --agent "claude code" -o results/
  bun scripts/run-eval.ts evals/suite.jsonl --agent "droid" --cwd /path/to/project
  bun scripts/run-eval.ts evals/suite.jsonl --mcp-server '{"type":"stdio","name":"fs","command":["mcp-fs"]}'
`)
  process.exit(values.help ? 0 : 1)
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse agent command string into command array
 */
const parseAgentCommand = (agent: string): string[] => {
  // Handle quoted strings and simple space-separated commands
  return agent.split(/\s+/).filter(Boolean)
}

/**
 * Parse MCP server config from JSON string
 */
const parseMcpServerConfig = (json: string): McpServerConfig => {
  const config = JSON.parse(json) as McpServerConfig
  if (!config.type || !config.name) {
    throw new Error('MCP server config must have "type" and "name" fields')
  }
  if (config.type === 'stdio' && !config.command) {
    throw new Error('stdio MCP server must have "command" field')
  }
  if ((config.type === 'http' || config.type === 'sse') && !config.url) {
    throw new Error(`${config.type} MCP server must have "url" field`)
  }
  return config
}

/**
 * Convert internal MCP config to ACP protocol format
 */
const toAcpMcpServer = (config: McpServerConfig) => {
  if (config.type === 'stdio') {
    return {
      type: 'stdio' as const,
      name: config.name,
      command: config.command ?? [],
      env: config.env,
      cwd: config.cwd,
    }
  }
  return {
    type: config.type,
    name: config.name,
    url: config.url ?? '',
    headers: config.headers,
  }
}

/**
 * Load eval cases from JSONL file
 */
const loadEvalCases = async (path: string): Promise<EvalCase[]> => {
  const content = await Bun.file(path).text()
  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as EvalCase)
}

/**
 * Run a single evaluation case
 */
const runEvalCase = async (
  client: ReturnType<typeof createACPClient>,
  sessionId: string,
  evalCase: EvalCase,
): Promise<EvalResult> => {
  const startTime = Date.now()
  let firstResponseTime: number | undefined
  const errors: string[] = []

  try {
    const prompt = createPrompt(evalCase.intent)

    const { updates } = await client.promptSync(sessionId, prompt)

    // Calculate first response time from updates
    if (updates.length > 0) {
      firstResponseTime = startTime + 100 // Approximate - in real impl would track actual timing
    }

    const summary = summarizeResponse(updates)
    const endTime = Date.now()

    // Determine status
    let status: EvalResult['status'] = 'passed'
    if (summary.hasErrors) {
      status = 'failed'
      errors.push(...summary.erroredToolCalls.map((tc) => `Tool ${tc.name} failed`))
    }

    return {
      id: evalCase.id,
      status,
      response: summary.text,
      toolCalls: summary.completedToolCalls.map((tc) => ({
        name: tc.name,
        status: tc.status,
      })),
      timing: {
        startTime,
        firstResponseTime,
        endTime,
        totalDuration: endTime - startTime,
      },
      updates: updates.length,
      ...(errors.length > 0 && { errors }),
    }
  } catch (error) {
    const endTime = Date.now()
    const message = error instanceof Error ? error.message : String(error)

    // Determine if timeout
    const isTimeout = message.includes('timeout') || message.includes('timed out')

    return {
      id: evalCase.id,
      status: isTimeout ? 'timeout' : 'error',
      response: '',
      toolCalls: [],
      timing: {
        startTime,
        endTime,
        totalDuration: endTime - startTime,
      },
      updates: 0,
      errors: [message],
    }
  }
}

// ============================================================================
// Main
// ============================================================================

const main = async () => {
  const suitePath = positionals[0]
  const agentCommand = parseAgentCommand(values.agent ?? 'claude code')
  const outputDir = values.output ?? 'results/'
  const timeout = Number.parseInt(values.timeout ?? '60000', 10)
  const cwd = values.cwd
  const skillsDir = values['skills-dir']

  // Parse MCP server configurations
  const mcpServerConfigs = (values['mcp-server'] ?? []).map(parseMcpServerConfig)
  const mcpServers = mcpServerConfigs.map(toAcpMcpServer)

  // Load eval cases
  const evalCases = await loadEvalCases(suitePath)
  console.log(`Loaded ${evalCases.length} eval cases from ${suitePath}`)
  console.log(`Agent: ${agentCommand.join(' ')}`)
  console.log(`Output: ${outputDir}`)
  if (mcpServers.length > 0) {
    console.log(`MCP Servers: ${mcpServers.map((s) => s.name).join(', ')}`)
  }
  if (skillsDir) {
    console.log(`Skills Dir: ${skillsDir}`)
  }
  console.log('')

  // Ensure output directory exists
  await Bun.write(join(outputDir, '.gitkeep'), '')

  // Create ACP client
  const client = createACPClient({
    command: agentCommand,
    cwd,
    timeout,
  })

  const startTime = new Date()
  const results: EvalResult[] = []

  // Session params with MCP servers
  const sessionParams = {
    ...(cwd && { cwd }),
    ...(mcpServers.length > 0 && { mcpServers }),
  }

  try {
    console.log('Connecting to agent...')
    await client.connect()
    console.log('Connected!\n')

    // Create session with MCP servers
    const session = await client.createSession(sessionParams)
    console.log(`Session created: ${session.id}\n`)

    // Run evaluations sequentially (concurrency support can be added later)
    for (let i = 0; i < evalCases.length; i++) {
      const evalCase = evalCases[i]
      if (!evalCase) continue

      console.log(`[${i + 1}/${evalCases.length}] ${evalCase.id}`)
      console.log(`  Intent: ${evalCase.intent.slice(0, 60)}...`)

      const result = await runEvalCase(client, session.id, evalCase)
      results.push(result)

      // Write individual result
      await Bun.write(join(outputDir, `${evalCase.id}.json`), JSON.stringify(result, null, 2))

      // Print status
      const statusIcon = result.status === 'passed' ? '✓' : result.status === 'failed' ? '✗' : '!'
      console.log(`  ${statusIcon} ${result.status} (${result.timing.totalDuration}ms)`)
      console.log('')
    }
  } finally {
    console.log('Disconnecting...')
    await client.disconnect()
  }

  const endTime = new Date()

  // Calculate summary
  const summary: EvalSummary = {
    total: results.length,
    passed: results.filter((r) => r.status === 'passed').length,
    failed: results.filter((r) => r.status === 'failed').length,
    errors: results.filter((r) => r.status === 'error').length,
    timeouts: results.filter((r) => r.status === 'timeout').length,
    avgDuration: results.reduce((sum, r) => sum + r.timing.totalDuration, 0) / results.length,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    agent: agentCommand.join(' '),
  }

  // Write summary
  await Bun.write(join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2))

  // Print summary
  console.log('═'.repeat(50))
  console.log('Summary')
  console.log('═'.repeat(50))
  console.log(`Total:    ${summary.total}`)
  console.log(`Passed:   ${summary.passed} (${((summary.passed / summary.total) * 100).toFixed(1)}%)`)
  console.log(`Failed:   ${summary.failed}`)
  console.log(`Errors:   ${summary.errors}`)
  console.log(`Timeouts: ${summary.timeouts}`)
  console.log(`Avg time: ${summary.avgDuration.toFixed(0)}ms`)
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
