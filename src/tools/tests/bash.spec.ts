import { describe, expect, test } from 'bun:test'
import bashTool, { type BashOutput, inputSchema } from '../bash.ts'
import { tempDir } from './helpers.ts'

// ================================================================
// bash tool
// ================================================================

const runBash = async (input: { command: string; timeout?: number }): Promise<BashOutput> => {
  const { output } = await bashTool.run(input)
  return output as BashOutput
}

describe('bash tool', () => {
  test('executes a command and returns stdout', async () => {
    const result = await runBash({ command: 'echo "hello"' })
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe('hello')
  })

  test('returns stderr on error', async () => {
    const result = await runBash({ command: 'echo "err" >&2; exit 1' })
    expect(result.exitCode).toBe(1)
    expect(result.stderr.trim()).toBe('err')
  })

  test('timeout returns error stderr', async () => {
    const result = await runBash({ command: 'sleep 10', timeout: 1 })
    expect(result.exitCode).toBe(-1)
    expect(result.stderr).toContain('timed out')
  })

  test('output exceeding line limit is tail-truncated with truncated flag', async () => {
    // 3000 numbered lines — head must be dropped, tail preserved
    const result = await runBash({ command: 'seq 1 3000' })
    expect(result.truncated).toBe(true)
    const lines = result.stdout.split('\n')
    expect(lines.length).toBeLessThanOrEqual(2001) // 2000 lines + trailing ''
    expect(lines[0]).toBe('1001') // head dropped
    expect(lines.at(-2)).toBe('3000') // tail preserved
  })

  test('control characters are sanitized from output', async () => {
    // bash printf interprets \x01 / \x02 as raw control bytes
    const result = await runBash({ command: `printf 'a\\x01b\\x02c'` })
    expect(result.stdout).toBe('abc')
  })

  test('timeout above the int32-ms ceiling is declared in the schema', () => {
    // Ceiling is declared, not parsed — the model sees it via the schema's
    // maximum, and over-limit errors name it at dispatch.
    const timeout = (inputSchema as Record<string, unknown>).properties.timeout as { maximum: number }
    expect(timeout.maximum).toBe(2_147_483)
  })

  test('cwd is provision-time: composed run pins it', async () => {
    const { dir, cleanup } = await tempDir({})
    try {
      const pinned = {
        ...bashTool,
        run: async (input: Record<string, unknown>) => bashTool.run({ ...input, cwd: dir }),
      }
      const { output: result } = await pinned.run({ command: 'pwd' })
      expect(result.exitCode).toBe(0)
      // macOS /var ↔ /private/var symlink — compare real paths
      const { realpathSync } = await import('node:fs')
      expect(realpathSync(result.stdout.trim())).toBe(realpathSync(dir))
    } finally {
      await cleanup()
    }
  })
})
