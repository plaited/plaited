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
    expect(lines.at(-1)).toBe('3000')
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

  test('truncated output includes a continuation notice with the spill path', async () => {
    const result = await bash({ cwd: process.cwd(), command: 'seq 1 3000' })
    expect(result.truncated).toBe(true)
    expect(result.notice).toBeDefined()
    expect(result.notice).toContain('Showing lines')
    expect(result.notice).toContain('of 3000')
    expect(result.notice).toContain('Full output:')
    expect(result.fullOutputPath).toBeDefined()
    // The spill file must exist and contain the full untruncated output
    const spilled = await Bun.file(result.fullOutputPath!).text()
    expect(spilled.trim().split('\n')).toHaveLength(3000)
  })

  test('non-truncated output has no notice or spill path', async () => {
    const result = await bash({ cwd: process.cwd(), command: 'echo hello' })
    expect(result.truncated).toBeUndefined()
    expect(result.notice).toBeUndefined()
    expect(result.fullOutputPath).toBeUndefined()
  })

  test('byte-limit truncation on a single huge line produces a partial-line notice', async () => {
    // Emit one line well over 50KB so the byte cap fires on the last line.
    const result = await bash({
      cwd: process.cwd(),
      command: 'printf "%s" "$(head -c 60000 < /dev/zero | tr "\\0" "x")"',
    })
    expect(result.truncated).toBe(true)
    expect(result.notice).toBeDefined()
    expect(result.notice).toContain('line')
    expect(result.fullOutputPath).toBeDefined()
  })
})
