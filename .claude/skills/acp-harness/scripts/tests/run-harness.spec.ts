import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

/**
 * Tests for MCP server configuration parsing and conversion.
 *
 * @remarks
 * These tests verify the MCP server config handling in run-harness.ts
 * without requiring an actual ACP agent connection.
 */

// ============================================================================
// Schemas (mirrors run-harness.ts)
// ============================================================================

const McpServerConfigSchema = z.object({
  type: z.enum(['stdio', 'http']),
  name: z.string(),
  command: z.array(z.string()).optional(),
  url: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  cwd: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
})

type McpServerConfig = z.infer<typeof McpServerConfigSchema>

// ============================================================================
// Helper functions (extracted for testing)
// ============================================================================

/**
 * Parse MCP server config from JSON string
 */
const parseMcpServerConfig = (json: string): McpServerConfig => {
  const config = McpServerConfigSchema.parse(JSON.parse(json))

  if (config.type === 'stdio' && !config.command) {
    throw new Error('stdio MCP server must have "command" field')
  }
  if (config.type === 'http' && !config.url) {
    throw new Error('http MCP server must have "url" field')
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
  // HTTP transport
  return {
    type: 'http' as const,
    name: config.name,
    url: config.url ?? '',
    headers: config.headers,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('parseMcpServerConfig', () => {
  test('parses valid stdio config', () => {
    const json = '{"type":"stdio","name":"test-server","command":["node","server.js"]}'
    const config = parseMcpServerConfig(json)

    expect(config.type).toBe('stdio')
    expect(config.name).toBe('test-server')
    expect(config.command).toEqual(['node', 'server.js'])
  })

  test('parses stdio config with env and cwd', () => {
    const json = JSON.stringify({
      type: 'stdio',
      name: 'test-server',
      command: ['bun', 'run', 'server.ts'],
      env: { DEBUG: 'true' },
      cwd: '/path/to/server',
    })
    const config = parseMcpServerConfig(json)

    expect(config.env).toEqual({ DEBUG: 'true' })
    expect(config.cwd).toBe('/path/to/server')
  })

  test('parses valid http config', () => {
    const json = '{"type":"http","name":"api-server","url":"http://localhost:3000"}'
    const config = parseMcpServerConfig(json)

    expect(config.type).toBe('http')
    expect(config.name).toBe('api-server')
    expect(config.url).toBe('http://localhost:3000')
  })

  test('parses http config with headers', () => {
    const json = JSON.stringify({
      type: 'http',
      name: 'auth-server',
      url: 'https://api.example.com',
      headers: { Authorization: 'Bearer token' },
    })
    const config = parseMcpServerConfig(json)

    expect(config.headers).toEqual({ Authorization: 'Bearer token' })
  })

  test('throws on missing type', () => {
    const json = '{"name":"test"}'
    expect(() => parseMcpServerConfig(json)).toThrow()
  })

  test('throws on missing name', () => {
    const json = '{"type":"stdio"}'
    expect(() => parseMcpServerConfig(json)).toThrow()
  })

  test('throws on stdio without command', () => {
    const json = '{"type":"stdio","name":"test"}'
    expect(() => parseMcpServerConfig(json)).toThrow('stdio MCP server must have "command" field')
  })

  test('throws on http without url', () => {
    const json = '{"type":"http","name":"test"}'
    expect(() => parseMcpServerConfig(json)).toThrow('http MCP server must have "url" field')
  })

  test('throws on invalid JSON', () => {
    expect(() => parseMcpServerConfig('not json')).toThrow()
  })
})

describe('toAcpMcpServer', () => {
  test('converts stdio config to ACP format', () => {
    const config: McpServerConfig = {
      type: 'stdio',
      name: 'test-server',
      command: ['node', 'server.js'],
      env: { DEBUG: 'true' },
      cwd: '/path/to/server',
    }
    const acp = toAcpMcpServer(config)

    expect(acp).toEqual({
      type: 'stdio',
      name: 'test-server',
      command: ['node', 'server.js'],
      env: { DEBUG: 'true' },
      cwd: '/path/to/server',
    })
  })

  test('converts http config to ACP format', () => {
    const config: McpServerConfig = {
      type: 'http',
      name: 'api-server',
      url: 'http://localhost:3000',
      headers: { 'X-API-Key': 'secret' },
    }
    const acp = toAcpMcpServer(config)

    expect(acp).toEqual({
      type: 'http',
      name: 'api-server',
      url: 'http://localhost:3000',
      headers: { 'X-API-Key': 'secret' },
    })
  })

  test('handles stdio config without optional fields', () => {
    const config: McpServerConfig = {
      type: 'stdio',
      name: 'minimal',
      command: ['server'],
    }
    const acp = toAcpMcpServer(config)

    expect(acp.type).toBe('stdio')
    expect(acp.command).toEqual(['server'])
    expect(acp.env).toBeUndefined()
    expect(acp.cwd).toBeUndefined()
  })
})

describe('MCP server type integration', () => {
  test('full workflow: parse and convert multiple servers', () => {
    const jsonConfigs = [
      '{"type":"stdio","name":"fs","command":["mcp-filesystem","/data"]}',
      '{"type":"http","name":"api","url":"http://localhost:3000"}',
    ]

    const parsed = jsonConfigs.map(parseMcpServerConfig)
    const acpServers = parsed.map(toAcpMcpServer)

    expect(acpServers).toHaveLength(2)
    expect(acpServers[0]?.type).toBe('stdio')
    expect(acpServers[1]?.type).toBe('http')
  })
})

// ============================================================================
// Output Format Schemas (for downstream validation)
// ============================================================================

const SummaryResultSchema = z.object({
  id: z.string(),
  input: z.string(),
  output: z.string(),
  toolCalls: z.array(z.string()),
  status: z.enum(['passed', 'failed', 'error', 'timeout']),
  duration: z.number(),
})

const TrajectoryStepSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('thought'),
    content: z.string(),
    timestamp: z.number(),
    stepId: z.string(),
  }),
  z.object({
    type: z.literal('message'),
    content: z.string(),
    timestamp: z.number(),
    stepId: z.string(),
  }),
  z.object({
    type: z.literal('tool_call'),
    name: z.string(),
    status: z.string(),
    input: z.unknown().optional(),
    output: z.unknown().optional(),
    duration: z.number().optional(),
    timestamp: z.number(),
    stepId: z.string(),
  }),
  z.object({
    type: z.literal('plan'),
    entries: z.array(
      z.object({
        content: z.string(),
        status: z.string(),
      }),
    ),
    timestamp: z.number(),
    stepId: z.string(),
  }),
])

const FullResultSchema = z.object({
  id: z.string(),
  input: z.string(),
  output: z.string(),
  expected: z.string().optional(),
  trajectory: z.array(TrajectoryStepSchema),
  metadata: z.record(z.string(), z.unknown()),
  timing: z.object({
    start: z.number(),
    end: z.number(),
    firstResponse: z.number().optional(),
  }),
  status: z.enum(['passed', 'failed', 'error', 'timeout']),
  errors: z.array(z.string()).optional(),
})

// ============================================================================
// Sample Output Data (matches harness output format)
// ============================================================================

const SAMPLE_SUMMARY_JSONL = `{"id":"test-001","input":"Create a button","output":"I created the button","toolCalls":["Write"],"status":"passed","duration":1234}
{"id":"test-002","input":"Fix the bug","output":"I fixed the bug","toolCalls":["Read","Edit"],"status":"passed","duration":2567}
{"id":"test-003","input":"Broken test","output":"","toolCalls":[],"status":"failed","duration":500}`

const SAMPLE_FULL_JSONL = `{"id":"test-001","input":"Create a button","output":"I created the button","trajectory":[{"type":"thought","content":"I'll create a button template","timestamp":100,"stepId":"test-001-step-1"},{"type":"tool_call","name":"Write","status":"completed","input":{"file_path":"src/button.tsx","content":"export const Button = () => <button>Click</button>"},"output":"File written","duration":234,"timestamp":150,"stepId":"test-001-step-2"},{"type":"message","content":"I created the button","timestamp":500,"stepId":"test-001-step-3"}],"metadata":{"category":"ui","agent":"claude-code-acp"},"timing":{"start":1704067200000,"end":1704067201234,"firstResponse":100},"status":"passed"}
{"id":"test-002","input":"Fix the bug","output":"I fixed the bug","trajectory":[{"type":"tool_call","name":"Read","status":"completed","input":{"file_path":"src/app.ts"},"output":"file contents...","duration":100,"timestamp":50,"stepId":"test-002-step-1"},{"type":"tool_call","name":"Edit","status":"completed","input":{"file_path":"src/app.ts","old_string":"bug","new_string":"fix"},"duration":150,"timestamp":200,"stepId":"test-002-step-2"},{"type":"message","content":"I fixed the bug","timestamp":400,"stepId":"test-002-step-3"}],"metadata":{"category":"bugfix","agent":"claude-code-acp"},"timing":{"start":1704067300000,"end":1704067302567},"status":"passed"}`

// ============================================================================
// Downstream Pattern Tests
// ============================================================================

describe('downstream patterns: summary JSONL', () => {
  const parseResults = (jsonl: string) =>
    jsonl
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))

  test('parses summary JSONL correctly', () => {
    const results = parseResults(SAMPLE_SUMMARY_JSONL)

    expect(results).toHaveLength(3)
    for (const result of results) {
      expect(() => SummaryResultSchema.parse(result)).not.toThrow()
    }
  })

  test('filters by status (jq pattern)', () => {
    const results = parseResults(SAMPLE_SUMMARY_JSONL)
    const failed = results.filter((r) => r.status === 'failed')

    expect(failed).toHaveLength(1)
    expect(failed[0]?.id).toBe('test-003')
  })

  test('calculates average duration (jq pattern)', () => {
    const results = parseResults(SAMPLE_SUMMARY_JSONL)
    const avg = results.reduce((sum, r) => sum + r.duration, 0) / results.length

    expect(avg).toBeCloseTo(1433.67, 0)
  })

  test('counts tool usage (jq pattern)', () => {
    const results = parseResults(SAMPLE_SUMMARY_JSONL)
    const allTools = results.flatMap((r) => r.toolCalls)
    const toolCounts = allTools.reduce<Record<string, number>>((acc, tool) => {
      acc[tool] = (acc[tool] ?? 0) + 1
      return acc
    }, {})

    expect(toolCounts).toEqual({ Write: 1, Read: 1, Edit: 1 })
  })

  test('calculates pass rate (jq pattern)', () => {
    const results = parseResults(SAMPLE_SUMMARY_JSONL)
    const passed = results.filter((r) => r.status === 'passed').length
    const total = results.length

    expect(passed).toBe(2)
    expect(total).toBe(3)
    expect(passed / total).toBeCloseTo(0.667, 2)
  })
})

describe('downstream patterns: full JSONL', () => {
  const parseResults = (jsonl: string) =>
    jsonl
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))

  test('parses full JSONL with trajectories', () => {
    const results = parseResults(SAMPLE_FULL_JSONL)

    expect(results).toHaveLength(2)
    for (const result of results) {
      expect(() => FullResultSchema.parse(result)).not.toThrow()
    }
  })

  test('step IDs follow expected format', () => {
    const results = parseResults(SAMPLE_FULL_JSONL)

    for (const result of results) {
      for (const step of result.trajectory) {
        expect(step.stepId).toMatch(new RegExp(`^${result.id}-step-\\d+$`))
      }
    }
  })

  test('step-level retrieval pattern works', () => {
    const results = parseResults(SAMPLE_FULL_JSONL)

    // Build step index (pattern from downstream.md)
    const stepIndex = new Map<string, unknown>()
    for (const result of results) {
      for (const step of result.trajectory) {
        stepIndex.set(step.stepId, step)
      }
    }

    // Retrieve specific step by ID
    const step = stepIndex.get('test-001-step-2') as { name: string; input: { file_path: string } }
    expect(step).toBeDefined()
    expect(step.name).toBe('Write')
    expect(step.input.file_path).toBe('src/button.tsx')
  })

  test('extracts tool calls from trajectory', () => {
    const results = parseResults(SAMPLE_FULL_JSONL)
    const result = results[1] // test-002

    const toolCalls = result.trajectory.filter((s: { type: string }) => s.type === 'tool_call')
    expect(toolCalls).toHaveLength(2)
    expect(toolCalls.map((t: { name: string }) => t.name)).toEqual(['Read', 'Edit'])
  })

  test('filters by metadata category', () => {
    const results = parseResults(SAMPLE_FULL_JSONL)
    const uiResults = results.filter((r) => r.metadata.category === 'ui')

    expect(uiResults).toHaveLength(1)
    expect(uiResults[0]?.id).toBe('test-001')
  })
})

describe('downstream patterns: advanced filtering', () => {
  const parseResults = (jsonl: string) =>
    jsonl
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))

  test('filters by tool usage (jq contains pattern)', () => {
    const results = parseResults(SAMPLE_SUMMARY_JSONL)
    const withWrite = results.filter((r) => r.toolCalls.includes('Write'))

    expect(withWrite).toHaveLength(1)
    expect(withWrite[0]?.id).toBe('test-001')
  })

  test('filters by duration threshold (slow evaluations)', () => {
    const results = parseResults(SAMPLE_SUMMARY_JSONL)
    const slow = results.filter((r) => r.duration > 2000)

    expect(slow).toHaveLength(1)
    expect(slow[0]?.id).toBe('test-002')
  })

  test('finds slowest evaluations (sorted)', () => {
    const results = parseResults(SAMPLE_SUMMARY_JSONL)
    const sorted = [...results].sort((a, b) => b.duration - a.duration)
    const top2 = sorted.slice(0, 2)

    expect(top2[0]?.id).toBe('test-002')
    expect(top2[1]?.id).toBe('test-001')
  })

  test('deduplicates by ID keeping latest (merge pattern)', () => {
    const combinedJsonl = `${SAMPLE_SUMMARY_JSONL}
{"id":"test-001","input":"Create a button v2","output":"I created the button v2","toolCalls":["Write","Edit"],"status":"passed","duration":1500}`

    const results = parseResults(combinedJsonl)

    // Group by ID and keep last occurrence (simulates jq group_by + last)
    const byId = new Map<string, unknown>()
    for (const result of results) {
      byId.set(result.id, result)
    }
    const deduped = Array.from(byId.values())

    expect(deduped).toHaveLength(3) // test-001, test-002, test-003
    const test001 = deduped.find((r) => (r as { id: string }).id === 'test-001') as { input: string }
    expect(test001?.input).toBe('Create a button v2')
  })

  test('groups by category and counts', () => {
    const results = parseResults(SAMPLE_FULL_JSONL)

    // Group by category (simulates jq group_by pattern)
    const grouped = results.reduce<Record<string, number>>((acc, r) => {
      const cat = r.metadata.category as string
      acc[cat] = (acc[cat] ?? 0) + 1
      return acc
    }, {})

    expect(grouped).toEqual({ ui: 1, bugfix: 1 })
  })

  test('extracts timing information', () => {
    const results = parseResults(SAMPLE_FULL_JSONL)
    const result = results[0]

    expect(result.timing.start).toBe(1704067200000)
    expect(result.timing.end).toBe(1704067201234)
    expect(result.timing.firstResponse).toBe(100)
    expect(result.timing.end - result.timing.start).toBe(1234) // matches duration
  })
})
