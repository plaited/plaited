import { describe, expect, test } from 'bun:test'
import { ACP_METHODS, JSON_RPC_ERRORS } from '../acp.types.ts'
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
// Constants Tests
// ============================================================================

describe('JSON_RPC_ERRORS', () => {
  test('has standard error codes', () => {
    expect(JSON_RPC_ERRORS.PARSE_ERROR).toBe(-32700)
    expect(JSON_RPC_ERRORS.INVALID_REQUEST).toBe(-32600)
    expect(JSON_RPC_ERRORS.METHOD_NOT_FOUND).toBe(-32601)
    expect(JSON_RPC_ERRORS.INVALID_PARAMS).toBe(-32602)
    expect(JSON_RPC_ERRORS.INTERNAL_ERROR).toBe(-32603)
    expect(JSON_RPC_ERRORS.REQUEST_CANCELLED).toBe(-32800)
  })
})

describe('ACP_METHODS', () => {
  test('has lifecycle methods', () => {
    expect(ACP_METHODS.INITIALIZE).toBe('initialize')
    expect(ACP_METHODS.SHUTDOWN).toBe('shutdown')
  })

  test('has session methods', () => {
    expect(ACP_METHODS.CREATE_SESSION).toBe('session/create')
    expect(ACP_METHODS.PROMPT).toBe('session/prompt')
    expect(ACP_METHODS.CANCEL).toBe('session/cancel')
    expect(ACP_METHODS.UPDATE).toBe('session/update')
    expect(ACP_METHODS.REQUEST_PERMISSION).toBe('session/request_permission')
  })

  test('has file system methods', () => {
    expect(ACP_METHODS.READ_TEXT_FILE).toBe('fs/read_text_file')
    expect(ACP_METHODS.WRITE_TEXT_FILE).toBe('fs/write_text_file')
  })

  test('has terminal methods', () => {
    expect(ACP_METHODS.TERMINAL_CREATE).toBe('terminal/create')
    expect(ACP_METHODS.TERMINAL_OUTPUT).toBe('terminal/output')
  })
})

// ============================================================================
// Transport Creation Tests (without spawning)
// ============================================================================

describe('createACPTransport', () => {
  // Note: Full transport tests would require spawning a mock subprocess.
  // These tests verify the transport factory configuration.

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
      command: ['cat'], // cat will echo back what we write
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

// ============================================================================
// JSON-RPC Message Format Tests
// ============================================================================

describe('JSON-RPC message structures', () => {
  test('request format', () => {
    const request = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'test/method',
      params: { foo: 'bar' },
    }
    expect(request.jsonrpc).toBe('2.0')
    expect(typeof request.id).toBe('number')
    expect(request.method).toBe('test/method')
  })

  test('notification format (no id)', () => {
    const notification = {
      jsonrpc: '2.0' as const,
      method: 'test/notification',
      params: { data: 'value' },
    }
    expect(notification.jsonrpc).toBe('2.0')
    expect('id' in notification).toBe(false)
  })

  test('success response format', () => {
    const response = {
      jsonrpc: '2.0' as const,
      id: 1,
      result: { success: true },
    }
    expect(response.jsonrpc).toBe('2.0')
    expect(response.result).toEqual({ success: true })
  })

  test('error response format', () => {
    const response = {
      jsonrpc: '2.0' as const,
      id: 1,
      error: {
        code: -32600,
        message: 'Invalid Request',
      },
    }
    expect(response.error.code).toBe(-32600)
    expect(response.error.message).toBe('Invalid Request')
  })
})
