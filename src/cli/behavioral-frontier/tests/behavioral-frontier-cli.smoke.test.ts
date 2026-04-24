import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'

describe('behavioral-frontier CLI smoke tests', () => {
  const CLI_PACKAGE_ROOT = resolve(import.meta.dir, '../../../../')

  test('plaited --schema includes behavioral-frontier', async () => {
    const result = await Bun.$`bun ./bin/plaited.ts --schema`.quiet().cwd(CLI_PACKAGE_ROOT).nothrow()
    expect(result.exitCode).toBe(0)

    const manifest = JSON.parse(result.stdout.toString().trim())
    expect(manifest.commands).toContain('behavioral-frontier')
  })

  test('plaited behavioral-frontier --schema input emits schema', async () => {
    const result = await Bun.$`bun ./bin/plaited.ts behavioral-frontier --schema input`
      .quiet()
      .cwd(CLI_PACKAGE_ROOT)
      .nothrow()
    expect(result.exitCode).toBe(0)

    const schema = JSON.parse(result.stdout.toString().trim())
    expect(schema.oneOf).toBeDefined()
  })

  test('plaited behavioral-frontier --schema output emits schema', async () => {
    const result = await Bun.$`bun ./bin/plaited.ts behavioral-frontier --schema output`
      .quiet()
      .cwd(CLI_PACKAGE_ROOT)
      .nothrow()
    expect(result.exitCode).toBe(0)

    const schema = JSON.parse(result.stdout.toString().trim())
    expect(schema.oneOf).toBeDefined()
  })

  test('plaited behavioral-frontier replay emits structured output', async () => {
    const input = JSON.stringify({
      mode: 'replay',
      modulePath: resolve(import.meta.dir, 'fixtures/replay-safe-threads.ts'),
      history: [{ type: 'A', source: 'request' }],
    })

    const result = await Bun.$`bun ./bin/plaited.ts behavioral-frontier ${input}`
      .quiet()
      .cwd(CLI_PACKAGE_ROOT)
      .nothrow()
    expect(result.exitCode).toBe(0)

    const output = JSON.parse(result.stdout.toString().trim())
    expect(output.mode).toBe('replay')
    expect(output.frontier.status).toBe('deadlock')
    expect(Array.isArray(output.pendingSummary)).toBe(true)
  })
})
