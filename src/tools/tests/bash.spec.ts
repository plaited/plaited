import { describe, expect, test } from 'bun:test'
import { realpathSync } from 'node:fs'
import { bash } from '../bash.ts'
import { tempDir } from './helpers.ts'

describe('bash tool', () => {
  test('executes a command and returns stdout', async () => {
    const result = await bash({ cwd: process.cwd(), command: 'echo "hello"' })
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe('hello')
  })

  test('returns stderr on error', async () => {
    const result = await bash({ cwd: process.cwd(), command: 'echo "err" >&2; exit 1' })
    expect(result.exitCode).toBe(1)
    expect(result.stderr.trim()).toBe('err')
  })

  test('timeout returns error stderr', async () => {
    const result = await bash({ cwd: process.cwd(), command: 'sleep 10', timeout: 1 })
    expect(result.exitCode).toBe(-1)
    expect(result.stderr).toContain('timed out')
  })

  test('output exceeding line limit is tail-truncated with truncated flag', async () => {
    const result = await bash({ cwd: process.cwd(), command: 'seq 1 3000' })
    expect(result.truncated).toBe(true)
    const lines = result.stdout.split('\n')
    expect(lines.length).toBeLessThanOrEqual(2001)
    expect(lines[0]).toBe('1001')
    expect(lines.at(-2)).toBe('3000')
  })

  test('control characters are sanitized from output', async () => {
    const result = await bash({ cwd: process.cwd(), command: `printf 'a\\x01b\\x02c'` })
    expect(result.stdout).toBe('abc')
  })

  test('cwd scopes the working directory', async () => {
    const { dir, cleanup } = await tempDir({})
    try {
      const result = await bash({ cwd: dir, command: 'pwd' })
      expect(result.exitCode).toBe(0)
      expect(realpathSync(result.stdout.trim())).toBe(realpathSync(dir))
    } finally {
      await cleanup()
    }
  })
})
