import { describe, expect, test } from 'bun:test'
import type {
  CreateSessionParams,
  McpServer,
  McpServerHttp,
  McpServerSse,
  McpServerStdio,
  SandboxConfig,
  SandboxFilesystemConfig,
  SandboxNetworkConfig,
} from '../acp.types.ts'

// ============================================================================
// MCP Server Type Tests
// ============================================================================

describe('MCP Server Types', () => {
  describe('McpServerStdio', () => {
    test('has required fields', () => {
      const server: McpServerStdio = {
        type: 'stdio',
        name: 'test-server',
        command: ['node', 'server.js'],
      }

      expect(server.type).toBe('stdio')
      expect(server.name).toBe('test-server')
      expect(server.command).toEqual(['node', 'server.js'])
    })

    test('supports optional env and cwd', () => {
      const server: McpServerStdio = {
        type: 'stdio',
        name: 'test-server',
        command: ['bun', 'run', 'server.ts'],
        env: { NODE_ENV: 'production' },
        cwd: '/path/to/server',
      }

      expect(server.env).toEqual({ NODE_ENV: 'production' })
      expect(server.cwd).toBe('/path/to/server')
    })
  })

  describe('McpServerHttp', () => {
    test('has required fields', () => {
      const server: McpServerHttp = {
        type: 'http',
        name: 'api-server',
        url: 'http://localhost:3000',
      }

      expect(server.type).toBe('http')
      expect(server.name).toBe('api-server')
      expect(server.url).toBe('http://localhost:3000')
    })

    test('supports optional headers', () => {
      const server: McpServerHttp = {
        type: 'http',
        name: 'api-server',
        url: 'https://api.example.com',
        headers: {
          Authorization: 'Bearer token',
          'X-API-Key': 'secret',
        },
      }

      expect(server.headers).toEqual({
        Authorization: 'Bearer token',
        'X-API-Key': 'secret',
      })
    })
  })

  describe('McpServerSse', () => {
    test('has required fields', () => {
      const server: McpServerSse = {
        type: 'sse',
        name: 'stream-server',
        url: 'http://localhost:8080/events',
      }

      expect(server.type).toBe('sse')
      expect(server.name).toBe('stream-server')
      expect(server.url).toBe('http://localhost:8080/events')
    })

    test('supports optional headers', () => {
      const server: McpServerSse = {
        type: 'sse',
        name: 'stream-server',
        url: 'http://localhost:8080/events',
        headers: { 'X-Stream-Token': 'abc123' },
      }

      expect(server.headers).toEqual({ 'X-Stream-Token': 'abc123' })
    })
  })

  describe('McpServer union', () => {
    test('accepts stdio server', () => {
      const server: McpServer = {
        type: 'stdio',
        name: 'fs',
        command: ['mcp-filesystem'],
      }

      expect(server.type).toBe('stdio')
    })

    test('accepts http server', () => {
      const server: McpServer = {
        type: 'http',
        name: 'api',
        url: 'http://localhost:3000',
      }

      expect(server.type).toBe('http')
    })

    test('accepts sse server', () => {
      const server: McpServer = {
        type: 'sse',
        name: 'events',
        url: 'http://localhost:8080/sse',
      }

      expect(server.type).toBe('sse')
    })
  })
})

// ============================================================================
// Sandbox Type Tests
// ============================================================================

describe('Sandbox Types', () => {
  describe('SandboxNetworkConfig', () => {
    test('supports all network options', () => {
      const config: SandboxNetworkConfig = {
        allowedDomains: ['github.com', '*.example.com'],
        deniedDomains: ['malicious.com'],
        allowUnixSockets: ['/var/run/docker.sock'],
        allowLocalBinding: true,
      }

      expect(config.allowedDomains).toContain('github.com')
      expect(config.deniedDomains).toContain('malicious.com')
      expect(config.allowUnixSockets).toContain('/var/run/docker.sock')
      expect(config.allowLocalBinding).toBe(true)
    })

    test('all fields are optional', () => {
      const config: SandboxNetworkConfig = {}

      expect(config.allowedDomains).toBeUndefined()
      expect(config.deniedDomains).toBeUndefined()
    })
  })

  describe('SandboxFilesystemConfig', () => {
    test('supports all filesystem options', () => {
      const config: SandboxFilesystemConfig = {
        denyRead: ['~/.ssh', '~/.aws'],
        allowWrite: ['.', '/tmp'],
        denyWrite: ['.env', '.git/hooks/'],
      }

      expect(config.denyRead).toContain('~/.ssh')
      expect(config.allowWrite).toContain('.')
      expect(config.denyWrite).toContain('.env')
    })

    test('all fields are optional', () => {
      const config: SandboxFilesystemConfig = {}

      expect(config.denyRead).toBeUndefined()
      expect(config.allowWrite).toBeUndefined()
      expect(config.denyWrite).toBeUndefined()
    })
  })

  describe('SandboxConfig', () => {
    test('requires enabled field', () => {
      const config: SandboxConfig = {
        enabled: true,
      }

      expect(config.enabled).toBe(true)
    })

    test('supports full configuration', () => {
      const config: SandboxConfig = {
        enabled: true,
        network: {
          allowedDomains: ['api.github.com'],
          allowLocalBinding: false,
        },
        filesystem: {
          allowWrite: ['.'],
          denyRead: ['~/.ssh'],
        },
      }

      expect(config.enabled).toBe(true)
      expect(config.network?.allowedDomains).toContain('api.github.com')
      expect(config.filesystem?.allowWrite).toContain('.')
    })
  })
})

// ============================================================================
// CreateSessionParams with MCP Servers
// ============================================================================

describe('CreateSessionParams', () => {
  test('supports cwd field', () => {
    const params: CreateSessionParams = {
      cwd: '/path/to/project',
    }

    expect(params.cwd).toBe('/path/to/project')
  })

  test('supports mcpServers field', () => {
    const params: CreateSessionParams = {
      mcpServers: [
        { type: 'stdio', name: 'fs', command: ['mcp-filesystem'] },
        { type: 'http', name: 'api', url: 'http://localhost:3000' },
      ],
    }

    expect(params.mcpServers).toHaveLength(2)
    expect(params.mcpServers?.[0]?.type).toBe('stdio')
    expect(params.mcpServers?.[1]?.type).toBe('http')
  })

  test('supports both cwd and mcpServers', () => {
    const params: CreateSessionParams = {
      cwd: '/path/to/project',
      mcpServers: [{ type: 'stdio', name: 'tools', command: ['mcp-tools'] }],
    }

    expect(params.cwd).toBe('/path/to/project')
    expect(params.mcpServers).toHaveLength(1)
  })

  test('supports _meta field', () => {
    const params: CreateSessionParams = {
      _meta: { customField: 'value' },
    }

    expect(params._meta?.customField).toBe('value')
  })
})
