import { describe, expect, test } from 'bun:test'
import { startMcpServer } from '../../tools/tests/mcp-server-fixture.ts'
import { createKernel } from '../kernel.ts'

describe('kernel — connection pool ownership + teardown', () => {
  test('shutdown drains the pool (size → 0)', async () => {
    const kernel = createKernel()
    const { url, close } = await startMcpServer()
    try {
      expect(kernel.pool.size()).toBe(0)
      await kernel.mcpClient({ mode: 'list-tools', url })
      expect(kernel.pool.size()).toBe(1)
      await kernel.shutdown()
      expect(kernel.pool.size()).toBe(0)
    } finally {
      await close()
    }
  })

  test('shutdown is idempotent', async () => {
    const kernel = createKernel()
    await kernel.shutdown()
    // A second shutdown is a no-op (does not throw, pool stays empty).
    await kernel.shutdown()
    expect(kernel.pool.size()).toBe(0)
  })
})
