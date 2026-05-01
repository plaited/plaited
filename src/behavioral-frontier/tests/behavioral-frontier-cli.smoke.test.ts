import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'

describe('behavioral-frontier CLI smoke tests', () => {
  const packageRoot = resolve(import.meta.dir, '../../../')

  test('plaited --schema includes behavioral-frontier', async () => {
    const result = await Bun.$`bun ./bin/plaited.ts --schema`.quiet().cwd(packageRoot).nothrow()
    expect(result.exitCode).toBe(0)

    const manifest = JSON.parse(result.stdout.toString().trim())
    expect(manifest.commands).toContain('behavioral-frontier')
  })

  test('plaited behavioral-frontier --schema input emits schema', async () => {
    const result = await Bun.$`bun ./bin/plaited.ts behavioral-frontier --schema input`
      .quiet()
      .cwd(packageRoot)
      .nothrow()
    expect(result.exitCode).toBe(0)

    const schema = JSON.parse(result.stdout.toString().trim())
    expect(schema.anyOf ?? schema.oneOf).toBeDefined()
  })

  test('plaited behavioral-frontier --schema output emits schema', async () => {
    const result = await Bun.$`bun ./bin/plaited.ts behavioral-frontier --schema output`
      .quiet()
      .cwd(packageRoot)
      .nothrow()
    expect(result.exitCode).toBe(0)

    const schema = JSON.parse(result.stdout.toString().trim())
    expect(schema.oneOf).toBeDefined()
  })

  test('plaited behavioral-frontier replay returns the direct shape', async () => {
    const result = await Bun.$`bun ./bin/plaited.ts behavioral-frontier ${JSON.stringify({
      mode: 'replay',
      specs: [
        {
          label: 'producer',
          thread: {
            once: true,
            syncPoints: [{ request: { type: 'task' } }],
          },
        },
      ],
    })}`
      .quiet()
      .cwd(packageRoot)
      .nothrow()
    expect(result.exitCode).toBe(0)

    const output = JSON.parse(result.stdout.toString().trim())
    expect(output).toEqual({
      mode: 'replay',
      snapshotMessages: [],
      frontier: {
        kind: 'frontier',
        step: 0,
        status: 'ready',
        candidates: [{ priority: 1, type: 'task' }],
        enabled: [{ priority: 1, type: 'task' }],
      },
    })
  })

  test('plaited behavioral-frontier explore returns the direct shape', async () => {
    const result = await Bun.$`bun ./bin/plaited.ts behavioral-frontier ${JSON.stringify({
      mode: 'explore',
      specs: [
        {
          label: 'watcher',
          thread: {
            once: true,
            syncPoints: [{ waitFor: [{ type: 'ping' }] }],
          },
        },
      ],
    })}`
      .quiet()
      .cwd(packageRoot)
      .nothrow()
    expect(result.exitCode).toBe(0)

    const output = JSON.parse(result.stdout.toString().trim())
    expect(output).toEqual({
      mode: 'explore',
      traces: [
        {
          snapshotMessages: [
            {
              kind: 'frontier',
              step: 0,
              status: 'idle',
              candidates: [],
              enabled: [],
            },
          ],
        },
      ],
      findings: [],
      report: {
        strategy: 'bfs',
        selectionPolicy: 'all-enabled',
        visitedCount: 1,
        findingCount: 0,
        truncated: false,
      },
    })
  })

  test('plaited behavioral-frontier verify returns the direct shape', async () => {
    const result = await Bun.$`bun ./bin/plaited.ts behavioral-frontier ${JSON.stringify({
      mode: 'verify',
      specs: [
        {
          label: 'watcher',
          thread: {
            once: true,
            syncPoints: [{ waitFor: [{ type: 'ping' }] }],
          },
        },
      ],
    })}`
      .quiet()
      .cwd(packageRoot)
      .nothrow()
    expect(result.exitCode).toBe(0)

    const output = JSON.parse(result.stdout.toString().trim())
    expect(output).toEqual({
      mode: 'verify',
      status: 'verified',
      findings: [],
      report: {
        strategy: 'bfs',
        selectionPolicy: 'all-enabled',
        visitedCount: 1,
        findingCount: 0,
        truncated: false,
      },
    })
  })
})
