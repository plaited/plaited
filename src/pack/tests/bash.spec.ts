import { describe, expect, test } from 'bun:test'
import bashTool from '../bash.ts'

// ================================================================
// bash tool
// ================================================================

describe('bash tool', () => {
  test('executes a command and returns stdout', async () => {
    const result = await bashTool.run({ command: 'echo "hello"' })
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe('hello')
  })

  test('returns stderr on error', async () => {
    const result = await bashTool.run({ command: 'echo "err" >&2; exit 1' })
    expect(result.exitCode).toBe(1)
    expect(result.stderr.trim()).toBe('err')
  })

  test('timeout returns error stderr', async () => {
    const result = await bashTool.run({ command: 'sleep 10', timeout: 1 })
    expect(result.exitCode).toBe(-1)
    expect(result.stderr).toContain('timed out')
  })
})
