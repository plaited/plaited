import { describe, expect, test } from 'bun:test'
import { ACPTransportError } from '../acp-transport.ts'

// ============================================================================
// ACPTransportError Tests
// ============================================================================

describe('ACPTransportError', () => {
  test('creates error with message only', () => {
    const error = new ACPTransportError('Connection failed')
    expect(error.message).toBe('Connection failed')
    expect(error.name).toBe('ACPTransportError')
    expect(error.code).toBeUndefined()
    expect(error.data).toBeUndefined()
  })

  test('creates error with code', () => {
    const error = new ACPTransportError('Request failed', -32600)
    expect(error.code).toBe(-32600)
  })

  test('creates error with data', () => {
    const error = new ACPTransportError('Invalid params', -32602, { param: 'foo' })
    expect(error.data).toEqual({ param: 'foo' })
  })

  test('fromJsonRpcError creates from RPC error', () => {
    const rpcError = {
      code: -32601,
      message: 'Method not found',
      data: { method: 'unknown' },
    }
    const error = ACPTransportError.fromJsonRpcError(rpcError)
    expect(error.message).toBe('Method not found')
    expect(error.code).toBe(-32601)
    expect(error.data).toEqual({ method: 'unknown' })
  })

  test('is instance of Error', () => {
    const error = new ACPTransportError('Test')
    expect(error instanceof Error).toBe(true)
    expect(error instanceof ACPTransportError).toBe(true)
  })
})

// ============================================================================
// Transport Creation Tests (without spawning)
// ============================================================================

describe('createACPTransport', () => {
  test('throws on empty command', async () => {
    const { createACPTransport } = await import('../acp-transport.ts')

    const transport = createACPTransport({
      command: [],
    })

    await expect(transport.start()).rejects.toThrow('Command array is empty')
  })

  test('isConnected returns false before start', async () => {
    const { createACPTransport } = await import('../acp-transport.ts')

    const transport = createACPTransport({
      command: ['echo', 'test'],
    })

    expect(transport.isConnected()).toBe(false)
  })

  test('request throws when not connected', async () => {
    const { createACPTransport } = await import('../acp-transport.ts')

    const transport = createACPTransport({
      command: ['echo', 'test'],
    })

    await expect(transport.request('test/method')).rejects.toThrow('Transport is not connected')
  })

  test('notify throws when not connected', async () => {
    const { createACPTransport } = await import('../acp-transport.ts')

    const transport = createACPTransport({
      command: ['echo', 'test'],
    })

    await expect(transport.notify('test/notification')).rejects.toThrow('Transport is not connected')
  })

  test('close is safe when not started', async () => {
    const { createACPTransport } = await import('../acp-transport.ts')

    const transport = createACPTransport({
      command: ['echo', 'test'],
    })

    // Should not throw
    await transport.close()
    expect(transport.isConnected()).toBe(false)
  })
})

// ============================================================================
// Mock Subprocess Integration Tests
// ============================================================================

describe('Transport with mock subprocess', () => {
  test('starts transport with valid command', async () => {
    const { createACPTransport } = await import('../acp-transport.ts')

    const transport = createACPTransport({
      command: ['cat'], // cat echoes back input
      timeout: 1000,
    })

    await transport.start()
    expect(transport.isConnected()).toBe(true)

    // Close immediately since cat doesn't speak JSON-RPC
    await transport.close(false)
    expect(transport.isConnected()).toBe(false)
  })

  test('throws on duplicate start', async () => {
    const { createACPTransport } = await import('../acp-transport.ts')

    const transport = createACPTransport({
      command: ['cat'],
      timeout: 1000,
    })

    await transport.start()

    try {
      await expect(transport.start()).rejects.toThrow('Transport already started')
    } finally {
      await transport.close(false)
    }
  })

  test('handles process exit', async () => {
    const { createACPTransport } = await import('../acp-transport.ts')

    let closeCalled = false
    let closeCode: number | null = null

    const transport = createACPTransport({
      command: ['true'], // exits immediately with code 0
      timeout: 1000,
      onClose: (code) => {
        closeCalled = true
        closeCode = code
      },
    })

    await transport.start()

    // Wait for process to exit
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(closeCalled).toBe(true)
    expect(closeCode === 0).toBe(true)
  })

  test('handles invalid command', async () => {
    const { createACPTransport } = await import('../acp-transport.ts')

    const transport = createACPTransport({
      command: ['nonexistent-command-that-does-not-exist-12345'],
      timeout: 1000,
    })

    // Bun.spawn may throw or exit with error depending on the command
    try {
      await transport.start()
      // If it doesn't throw, wait for process exit
      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch {
      // Expected - command not found
    }
  })
})
