import { describe, expect, test } from 'bun:test'

const SCRIPT_PATH = new URL('../search.ts', import.meta.url).pathname

describe('search-agent-skills', () => {
  test('exits 0 on --help', async () => {
    const proc = Bun.spawn(['bun', 'run', SCRIPT_PATH, '--help'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const exitCode = await proc.exited
    expect(exitCode).toBe(0)
  })

  test('exits 2 when no argument provided', async () => {
    const proc = Bun.spawn(['bun', 'run', SCRIPT_PATH], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const exitCode = await proc.exited
    const stderr = await new Response(proc.stderr).text()
    expect(exitCode).toBe(2)
    expect(stderr).toContain('Usage:')
  })

  test('exits 2 on invalid JSON', async () => {
    const proc = Bun.spawn(['bun', 'run', SCRIPT_PATH, 'not-json'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const exitCode = await proc.exited
    const stderr = await new Response(proc.stderr).text()
    expect(exitCode).toBe(2)
    expect(stderr).toContain('Invalid JSON input')
  })

  test('exits 2 when query field is missing', async () => {
    const proc = Bun.spawn(['bun', 'run', SCRIPT_PATH, '{"other": "value"}'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const exitCode = await proc.exited
    const stderr = await new Response(proc.stderr).text()
    expect(exitCode).toBe(2)
    expect(stderr).toContain('Missing required field: query')
  })
})
