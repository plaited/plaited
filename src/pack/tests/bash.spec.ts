import { describe, expect, test } from 'bun:test'
import bashTool, { inputSchema } from '../bash.ts'
import { tempDir } from './helpers.ts'

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

  test('output exceeding line limit is tail-truncated with truncated flag', async () => {
    // 3000 numbered lines — head must be dropped, tail preserved
    const result = await bashTool.run({ command: 'seq 1 3000' })
    expect(result.truncated).toBe(true)
    const lines = result.stdout.split('\n')
    expect(lines.length).toBeLessThanOrEqual(2001) // 2000 lines + trailing ''
    expect(lines[0]).toBe('1001') // head dropped
    expect(lines.at(-2)).toBe('3000') // tail preserved
  })

  test('control characters are sanitized from output', async () => {
    // bash printf interprets \x01 / \x02 as raw control bytes
    const result = await bashTool.run({ command: `printf 'a\\x01b\\x02c'` })
    expect(result.stdout).toBe('abc')
  })

  test('timeout above the int32-ms ceiling is rejected by the schema', () => {
    expect(inputSchema.safeParse({ command: 'x', timeout: 2_147_484 }).success).toBe(false)
    expect(inputSchema.safeParse({ command: 'x', timeout: 2_147_483 }).success).toBe(true)
  })

  test('truncated output is spilled to a temp file containing the full output', async () => {
    const result = await bashTool.run({ command: 'seq 1 3000' })
    expect(result.truncated).toBe(true)
    expect(result.fullOutputPath).toBeDefined()
    // The spill must contain what the tail dropped — the head
    const spilled = await Bun.file(result.fullOutputPath!).text()
    expect(spilled.startsWith('1\n2\n3\n')).toBe(true)
    expect(spilled).toContain('3000')
  })

  test('no spill when output is under the limits', async () => {
    const result = await bashTool.run({ command: 'echo small' })
    expect(result.truncated).toBeUndefined()
    expect(result.fullOutputPath).toBeUndefined()
  })

  test('cwd is provision-time: model schema strips cwd; composed run pins it', async () => {
    // Model-facing schema stays command/timeout — an extra cwd key from the
    // model is stripped (unknown-key behavior), never forwarded to run.
    const parsed = inputSchema.parse({ command: 'pwd', cwd: '/tmp' })
    expect(parsed).toEqual({ command: 'pwd' })

    const { dir, cleanup } = await tempDir({})
    try {
      // The provisioner pattern: wrap run to inject cwd (tool data stays pure)
      const pinned: typeof bashTool = {
        ...bashTool,
        run: (input) => bashTool.run({ ...input, cwd: dir }),
      }
      const result = await pinned.run({ command: 'pwd' })
      expect(result.exitCode).toBe(0)
      // macOS /var ↔ /private/var symlink — compare real paths
      const { realpath } = await import('node:fs/promises')
      expect(await realpath(result.stdout.trim())).toBe(await realpath(dir))
    } finally {
      await cleanup()
    }
  })
})
