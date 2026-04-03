import { describe, expect, test } from 'bun:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bootstrapAgent } from '../bootstrap.ts'

describe('bootstrapAgent', () => {
  test('writes the deployment scaffold', async () => {
    const targetDir = await mkdtemp(join(tmpdir(), 'plaited-bootstrap-'))

    const result = await bootstrapAgent({
      targetDir,
      name: 'demo-agent',
      profile: 'local-first',
      primaryBaseUrl: 'http://127.0.0.1:8000/v1',
      primaryModel: 'falcon-h1r-7b',
      memoryProvider: 'agentfs',
      sandboxProvider: 'boxer',
      syncProvider: 'none',
      overwrite: false,
    })

    expect(result.name).toBe('demo-agent')
    expect(result.createdPaths.length).toBeGreaterThan(0)

    const bootstrapFile = Bun.file(join(targetDir, '.plaited/config/bootstrap.json'))
    expect(await bootstrapFile.exists()).toBe(true)

    const modelsFile = Bun.file(join(targetDir, '.plaited/config/models.json'))
    expect(await modelsFile.exists()).toBe(true)

    const observationsFile = Bun.file(join(targetDir, '.plaited/memory/observations.jsonl'))
    expect(await observationsFile.exists()).toBe(true)
  })

  test('refuses to overwrite existing files by default', async () => {
    const targetDir = await mkdtemp(join(tmpdir(), 'plaited-bootstrap-overwrite-'))

    await bootstrapAgent({
      targetDir,
      name: 'demo-agent',
      profile: 'local-first',
      memoryProvider: 'agentfs',
      sandboxProvider: 'boxer',
      syncProvider: 'none',
      overwrite: false,
    })

    await expect(
      bootstrapAgent({
        targetDir,
        name: 'demo-agent',
        profile: 'local-first',
        memoryProvider: 'agentfs',
        sandboxProvider: 'boxer',
        syncProvider: 'none',
        overwrite: false,
      }),
    ).rejects.toThrow('Refusing to overwrite existing file')
  })
})
