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
      onPermissionRequest: async () => ({ outcome: { outcome: 'cancelled' } }),
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

    await expect(client.createSession({ cwd: '/tmp', mcpServers: [] })).rejects.toThrow('Not connected')
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
