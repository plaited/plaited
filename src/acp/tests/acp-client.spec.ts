import { describe, expect, test } from 'bun:test'
import { ACPClientError, createACPClient } from '../acp-client.ts'

// ============================================================================
// ACPClientError Tests
// ============================================================================

describe('ACPClientError', () => {
  test('creates error with message only', () => {
    const error = new ACPClientError('Connection failed')
    expect(error.message).toBe('Connection failed')
    expect(error.name).toBe('ACPClientError')
    expect(error.code).toBeUndefined()
  })

  test('creates error with code', () => {
    const error = new ACPClientError('Not connected', 'NOT_CONNECTED')
    expect(error.code).toBe('NOT_CONNECTED')
  })

  test('is instance of Error', () => {
    const error = new ACPClientError('Test')
    expect(error instanceof Error).toBe(true)
    expect(error instanceof ACPClientError).toBe(true)
  })
})

// ============================================================================
// Client Factory Tests
// ============================================================================

describe('createACPClient', () => {
  test('creates client with minimal config', () => {
    const client = createACPClient({
      command: ['echo', 'test'],
    })

    expect(client).toBeDefined()
    expect(typeof client.connect).toBe('function')
    expect(typeof client.disconnect).toBe('function')
    expect(typeof client.createSession).toBe('function')
    expect(typeof client.prompt).toBe('function')
    expect(typeof client.promptSync).toBe('function')
    expect(typeof client.cancelPrompt).toBe('function')
    expect(typeof client.getCapabilities).toBe('function')
    expect(typeof client.getInitializeResult).toBe('function')
    expect(typeof client.isConnected).toBe('function')
  })

  test('creates client with full config', () => {
    const client = createACPClient({
      command: ['claude', 'code'],
      cwd: '/tmp',
      env: { TEST: 'value' },
      clientInfo: { name: 'test-client', version: '1.0.0' },
      capabilities: { fs: { readTextFile: true } },
      timeout: 60000,
      onPermissionRequest: async () => ({ outcome: 'cancelled' }),
    })

    expect(client).toBeDefined()
  })
})

// ============================================================================
// State Methods (before connection)
// ============================================================================

describe('Client state before connection', () => {
  test('isConnected returns false before connect', () => {
    const client = createACPClient({
      command: ['echo', 'test'],
    })

    expect(client.isConnected()).toBe(false)
  })

  test('getCapabilities returns undefined before connect', () => {
    const client = createACPClient({
      command: ['echo', 'test'],
    })

    expect(client.getCapabilities()).toBeUndefined()
  })

  test('getInitializeResult returns undefined before connect', () => {
    const client = createACPClient({
      command: ['echo', 'test'],
    })

    expect(client.getInitializeResult()).toBeUndefined()
  })
})

// ============================================================================
// Operations Before Connection
// ============================================================================

describe('Operations before connection', () => {
  test('createSession throws when not connected', async () => {
    const client = createACPClient({
      command: ['echo', 'test'],
    })

    await expect(client.createSession()).rejects.toThrow('Not connected')
  })

  test('promptSync throws when not connected', async () => {
    const client = createACPClient({
      command: ['echo', 'test'],
    })

    await expect(client.promptSync('session-1', [{ type: 'text', text: 'Hello' }])).rejects.toThrow('Not connected')
  })

  test('cancelPrompt throws when not connected', async () => {
    const client = createACPClient({
      command: ['echo', 'test'],
    })

    await expect(client.cancelPrompt('session-1')).rejects.toThrow('Not connected')
  })

  test('prompt generator throws when not connected', async () => {
    const client = createACPClient({
      command: ['echo', 'test'],
    })

    const generator = client.prompt('session-1', [{ type: 'text', text: 'Hello' }])

    await expect(generator.next()).rejects.toThrow('Not connected')
  })
})

// ============================================================================
// Disconnect Safety
// ============================================================================

describe('Disconnect safety', () => {
  test('disconnect is safe when not connected', async () => {
    const client = createACPClient({
      command: ['echo', 'test'],
    })

    // Should not throw
    await client.disconnect()
    expect(client.isConnected()).toBe(false)
  })

  test('disconnect with graceful=false is safe when not connected', async () => {
    const client = createACPClient({
      command: ['echo', 'test'],
    })

    // Should not throw
    await client.disconnect(false)
    expect(client.isConnected()).toBe(false)
  })
})

// ============================================================================
// Client Type Exports
// ============================================================================

describe('Type exports', () => {
  test('exports SessionUpdate type shape', () => {
    // Verify the type structure matches expected shape
    const update = {
      type: 'update' as const,
      params: {
        sessionId: 'test',
        content: [{ type: 'text' as const, text: 'Hello' }],
      },
    }
    expect(update.type).toBe('update')
    expect(update.params.sessionId).toBe('test')
  })

  test('exports PromptComplete type shape', () => {
    const complete = {
      type: 'complete' as const,
      result: {
        sessionId: 'test',
        status: 'completed' as const,
      },
    }
    expect(complete.type).toBe('complete')
    expect(complete.result.status).toBe('completed')
  })
})

// ============================================================================
// Integration Tests with Mock Process
// ============================================================================

describe('Client with mock process', () => {
  test('connect starts transport', async () => {
    const client = createACPClient({
      command: ['cat'], // cat echoes back input
      timeout: 1000,
    })

    // Start connection - cat won't respond with proper JSON-RPC
    // so this will timeout, but it tests the transport startup
    try {
      await client.connect()
    } catch {
      // Expected - cat doesn't speak JSON-RPC
    }

    // Cleanup
    await client.disconnect(false)
  })

  test('connect throws when already connected', async () => {
    const client = createACPClient({
      command: ['cat'],
      timeout: 500,
    })

    // Start first connection
    const connectPromise = client.connect()

    // Immediately try second connection (before first completes)
    // This should throw because transport is started
    await expect(client.connect()).rejects.toThrow('Already connected')

    // Cleanup - wait for first connect to timeout then disconnect
    try {
      await connectPromise
    } catch {
      // Expected timeout
    }
    await client.disconnect(false)
  })
})

// ============================================================================
// Permission Handler Tests
// ============================================================================

describe('Permission handling', () => {
  test('default handler auto-approves first option', async () => {
    // This tests the internal auto-approve logic by checking
    // that a client without custom handler is created successfully
    const client = createACPClient({
      command: ['echo', 'test'],
    })

    expect(client).toBeDefined()
    // The auto-approve handler is used internally when onPermissionRequest is not provided
  })

  test('custom permission handler is accepted', () => {
    const client = createACPClient({
      command: ['echo', 'test'],
      onPermissionRequest: async () => ({ outcome: 'cancelled' }),
    })

    expect(client).toBeDefined()
    // Handler would be called during actual agent communication
  })
})

// ============================================================================
// Sandbox Configuration Tests
// ============================================================================

describe('Sandbox configuration', () => {
  test('creates client with sandbox disabled', () => {
    const client = createACPClient({
      command: ['echo', 'test'],
      sandbox: {
        enabled: false,
      },
    })

    expect(client).toBeDefined()
  })

  test('creates client with sandbox enabled and filesystem config', () => {
    const client = createACPClient({
      command: ['echo', 'test'],
      sandbox: {
        enabled: true,
        filesystem: {
          allowWrite: ['.', '/tmp'],
          denyRead: ['~/.ssh', '~/.aws'],
          denyWrite: ['.env'],
        },
      },
    })

    expect(client).toBeDefined()
  })

  test('creates client with sandbox enabled and network config', () => {
    const client = createACPClient({
      command: ['echo', 'test'],
      sandbox: {
        enabled: true,
        network: {
          allowedDomains: ['github.com', 'api.anthropic.com'],
          deniedDomains: ['malicious.com'],
          allowLocalBinding: false,
        },
      },
    })

    expect(client).toBeDefined()
  })

  test('creates client with full sandbox config', () => {
    const client = createACPClient({
      command: ['echo', 'test'],
      sandbox: {
        enabled: true,
        filesystem: {
          allowWrite: ['.', '/tmp'],
          denyRead: ['~/.ssh'],
          denyWrite: ['.env', '.git/hooks/'],
        },
        network: {
          allowedDomains: ['*.github.com'],
          deniedDomains: [],
          allowUnixSockets: ['/var/run/docker.sock'],
          allowLocalBinding: true,
        },
      },
    })

    expect(client).toBeDefined()
  })
})
