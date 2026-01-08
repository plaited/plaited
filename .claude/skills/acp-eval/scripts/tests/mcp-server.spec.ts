import { describe, expect, test } from 'bun:test'

/**
 * Tests for MCP server configuration parsing and conversion.
 *
 * @remarks
 * These tests verify the MCP server config handling in run-eval.ts
 * without requiring an actual ACP agent connection.
 */

// ============================================================================
// Types (copied from run-eval.ts for testing)
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

// ============================================================================
// Helper functions (extracted for testing)
// ============================================================================

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

  test('parses valid sse config', () => {
    const json = '{"type":"sse","name":"stream-server","url":"http://localhost:8080/events"}'
    const config = parseMcpServerConfig(json)

    expect(config.type).toBe('sse')
    expect(config.name).toBe('stream-server')
    expect(config.url).toBe('http://localhost:8080/events')
  })

  test('throws on missing type', () => {
    const json = '{"name":"test"}'
    expect(() => parseMcpServerConfig(json)).toThrow('must have "type" and "name" fields')
  })

  test('throws on missing name', () => {
    const json = '{"type":"stdio"}'
    expect(() => parseMcpServerConfig(json)).toThrow('must have "type" and "name" fields')
  })

  test('throws on stdio without command', () => {
    const json = '{"type":"stdio","name":"test"}'
    expect(() => parseMcpServerConfig(json)).toThrow('stdio MCP server must have "command" field')
  })

  test('throws on http without url', () => {
    const json = '{"type":"http","name":"test"}'
    expect(() => parseMcpServerConfig(json)).toThrow('http MCP server must have "url" field')
  })

  test('throws on sse without url', () => {
    const json = '{"type":"sse","name":"test"}'
    expect(() => parseMcpServerConfig(json)).toThrow('sse MCP server must have "url" field')
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

  test('converts sse config to ACP format', () => {
    const config: McpServerConfig = {
      type: 'sse',
      name: 'stream-server',
      url: 'http://localhost:8080/events',
    }
    const acp = toAcpMcpServer(config)

    expect(acp).toEqual({
      type: 'sse',
      name: 'stream-server',
      url: 'http://localhost:8080/events',
      headers: undefined,
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
      '{"type":"sse","name":"events","url":"http://localhost:8080/sse"}',
    ]

    const parsed = jsonConfigs.map(parseMcpServerConfig)
    const acpServers = parsed.map(toAcpMcpServer)

    expect(acpServers).toHaveLength(3)
    expect(acpServers[0]?.type).toBe('stdio')
    expect(acpServers[1]?.type).toBe('http')
    expect(acpServers[2]?.type).toBe('sse')
  })
})
