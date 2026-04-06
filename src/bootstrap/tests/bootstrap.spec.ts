import { describe, expect, test } from 'bun:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Module, Signal } from '../../agent.ts'
import { SERVER_MODULE_SIGNAL_KEYS } from '../../modules/server-module/server-module.constants.ts'
import type { ServerModuleStatusSchema } from '../../modules/server-module/server-module.schemas.ts'
import { createDefaultBootstrapModules, DEFAULT_BOOTSTRAP_MODULE_BUNDLE_ID } from '../../modules.ts'
import { bootstrapAgent, createBootstrappedAgent } from '../bootstrap.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  vision: async () => ({ description: '' }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

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
      serverPort: 0,
      overwrite: false,
    })

    expect(result.name).toBe('demo-agent')
    expect(result.createdPaths.length).toBeGreaterThan(0)

    const bootstrapFile = Bun.file(join(targetDir, '.plaited/config/bootstrap.json'))
    expect(await bootstrapFile.exists()).toBe(true)
    await expect(bootstrapFile.json()).resolves.toMatchObject({
      defaultModuleBundle: DEFAULT_BOOTSTRAP_MODULE_BUNDLE_ID,
    })

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
      serverPort: 0,
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
        serverPort: 0,
        overwrite: false,
      }),
    ).rejects.toThrow('Refusing to overwrite existing file')
  })

  test('creates a bootstrapped agent and starts the server through bootstrap orchestration', async () => {
    const targetDir = await mkdtemp(join(tmpdir(), 'plaited-bootstrap-runtime-'))
    let statusSignal!: Signal<typeof ServerModuleStatusSchema>

    const observeModule: Module = ({ signals }) => {
      statusSignal = signals.get(SERVER_MODULE_SIGNAL_KEYS.status) as Signal<typeof ServerModuleStatusSchema>
      return {}
    }

    const runtime = await createBootstrappedAgent({
      targetDir,
      name: 'demo-agent',
      profile: 'local-first',
      primaryBaseUrl: 'http://127.0.0.1:8000/v1',
      primaryModel: 'falcon-h1r-7b',
      memoryProvider: 'agentfs',
      sandboxProvider: 'boxer',
      syncProvider: 'none',
      serverPort: 0,
      overwrite: false,
      models: TEST_MODELS,
      authenticateConnection: () => ({ connectionId: 'bootstrap-test' }),
      routes: {
        '/health': new Response('OK'),
      },
      modules: [observeModule],
    })

    await Bun.sleep(50)

    const port = statusSignal.get()?.port ?? 0
    expect(port).toBeGreaterThan(0)

    const response = await fetch(`http://localhost:${port}/health`)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('OK')

    runtime.stopServer()
  })

  test('uses the current minimal default bootstrap bundle', () => {
    const modules = createDefaultBootstrapModules()
    expect(modules).toHaveLength(1)
  })
})
