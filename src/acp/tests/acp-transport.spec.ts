import { describe, expect, test } from 'bun:test'
import { createACPTransport } from '../acp-transport.ts'

// ============================================================================
// Transport Creation Tests (without spawning)
// ============================================================================

describe('createACPTransport', () => {
  test('throws on empty command', async () => {
    const transport = createACPTransport({
      command: [],
    })

    await expect(transport.start()).rejects.toThrow('Command array is empty')
  })

  test('isConnected returns false before start', async () => {
    const transport = createACPTransport({
      command: ['echo', 'test'],
    })

    expect(transport.isConnected()).toBe(false)
  })

  test('request throws when not connected', async () => {
    const transport = createACPTransport({
      command: ['echo', 'test'],
    })

    await expect(transport.request('test/method')).rejects.toThrow('Transport is not connected')
  })

  test('notify throws when not connected', async () => {
    const transport = createACPTransport({
      command: ['echo', 'test'],
    })

    await expect(transport.notify('test/notification')).rejects.toThrow('Transport is not connected')
  })

  test('close is safe when not started', async () => {
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
// Error Handling Tests
// ============================================================================

describe('Transport error handling', () => {
  test('request times out when no response received', async () => {
    // TODO(human): Implement timeout test
  })

  test('close rejects pending requests', async () => {
    const transport = createACPTransport({
      command: ['cat'],
      timeout: 5000,
    })

    await transport.start()

    // Start a request that will never complete (cat doesn't speak JSON-RPC)
    const requestPromise = transport.request('test/method')

    // Close transport while request is pending
    await transport.close(false)

    // Request should be rejected with "Transport closed"
    await expect(requestPromise).rejects.toThrow('Transport closed')
  })
})
