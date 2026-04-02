import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AGENT_CORE_EVENTS } from '../agent.constants.ts'
import {
  BashResultSchema,
  DeleteFileResultSchema,
  GlobFilesResultSchema,
  GrepResultSchema,
  PrimaryInferenceResultSchema,
  ReadFileResultSchema,
  WriteFileResultSchema,
} from '../agent.schemas.ts'
import { createAgent } from '../create-agent.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  vision: async () => ({ description: '' }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createAgent', () => {
  test('returns the minimal public handle and installs factory handlers', async () => {
    const seen: string[] = []
    const agent = await createAgent({
      id: 'agent:test',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      restrictedTriggers: [AGENT_CORE_EVENTS.agent_disconnect],
      factories: [
        () => ({
          handlers: {
            custom_event() {
              seen.push('custom_event')
            },
          },
        }),
      ],
    })

    agent.trigger({ type: 'custom_event' })

    expect(seen).toEqual(['custom_event'])
    expect(typeof agent.useSnapshot).toBe('function')
  })

  test('blocks restricted events through the restricted trigger surface', async () => {
    const snapshots: string[] = []
    const agent = await createAgent({
      id: 'agent:test',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      restrictedTriggers: [AGENT_CORE_EVENTS.agent_disconnect],
    })

    agent.useSnapshot((snapshot) => {
      snapshots.push(snapshot.kind)
    })

    agent.trigger({ type: AGENT_CORE_EVENTS.agent_disconnect })

    expect(snapshots).toContain('restricted_trigger_error')
  })

  test('installs factory modules at runtime through update_factories', async () => {
    const seen: string[] = []
    const modulePath = './src/agent/tests/fixtures/update-factories.fixture.ts'
    let resolvePong!: () => void
    const pongSeen = new Promise<void>((resolve) => {
      resolvePong = resolve
    })

    const agent = await createAgent({
      id: 'agent:test',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      factories: [
        () => ({
          handlers: {
            fixture_pong() {
              seen.push('fixture_pong')
              resolvePong()
            },
          },
        }),
      ],
    })

    agent.trigger({
      type: AGENT_CORE_EVENTS.update_factories,
      detail: modulePath,
    })

    for (let attempt = 0; attempt < 10 && seen.length === 0; attempt++) {
      await Bun.sleep(10)
      agent.trigger({ type: 'fixture_ping' })
    }

    await pongSeen

    expect(seen).toEqual(['fixture_pong'])
  })

  test('reads file through a passed signal using cwd context', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'plaited-agent-tool-'))
    await Bun.write(`${workspace}/hello.txt`, 'hello from agent')

    let readSignal: ReturnType<typeof import('../use-signal.ts').useSignal<typeof ReadFileResultSchema>> | undefined
    let resolveRead!: () => void
    const readSeen = new Promise<void>((resolve) => {
      resolveRead = resolve
    })

    const agent = await createAgent({
      id: 'agent:tools',
      cwd: workspace,
      workspace,
      models: TEST_MODELS,
      factories: [
        ({ signals }) => {
          readSignal = signals.set({
            key: 'read-result',
            schema: ReadFileResultSchema,
            readOnly: false,
          })
          readSignal.listen(() => resolveRead())

          return {}
        },
      ],
    })

    agent.trigger({
      type: AGENT_CORE_EVENTS.read_file,
      detail: { input: 'hello.txt', signal: readSignal },
    })

    await readSeen
    expect(readSignal?.get()?.input).toBe('hello.txt')
    expect(await readSignal?.get()?.output.text()).toBe('hello from agent')

    await rm(workspace, { recursive: true, force: true })
  })

  test('executes bash through the spawned shell worker using cwd context', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'plaited-agent-bash-'))
    await Bun.write(
      `${workspace}/bash-worker.ts`,
      [
        "import { $ } from 'bun'",
        '',
        "const [value = ''] = Bun.argv.slice(2)",
        'const result = await $`printf ${value}`.quiet().nothrow()',
        'if (result.stdout.length > 0) process.stdout.write(result.stdout)',
        'if (result.stderr.length > 0) process.stderr.write(result.stderr)',
        'process.exit(result.exitCode)',
      ].join('\n'),
    )

    let bashSignal: ReturnType<typeof import('../use-signal.ts').useSignal<typeof BashResultSchema>> | undefined
    let resolveBash!: () => void
    const bashSeen = new Promise<void>((resolve) => {
      resolveBash = resolve
    })

    const agent = await createAgent({
      id: 'agent:bash',
      cwd: workspace,
      workspace,
      models: TEST_MODELS,
      factories: [
        ({ signals }) => {
          bashSignal = signals.set({
            key: 'bash-result',
            schema: BashResultSchema,
            readOnly: false,
          })
          bashSignal.listen(() => resolveBash())

          return {}
        },
      ],
    })

    agent.trigger({
      type: AGENT_CORE_EVENTS.bash,
      detail: { input: { path: 'bash-worker.ts', args: ['hello-from-bash'] }, signal: bashSignal },
    })

    await bashSeen

    expect(bashSignal?.get()).toEqual({
      input: { path: 'bash-worker.ts', args: ['hello-from-bash'] },
      output: {
        status: 'completed',
        output: 'hello-from-bash',
        exitCode: 0,
      },
    })

    await rm(workspace, { recursive: true, force: true })
  })

  test('writes file through a passed signal using cwd context', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'plaited-agent-write-'))

    let writeSignal: ReturnType<typeof import('../use-signal.ts').useSignal<typeof WriteFileResultSchema>> | undefined
    let resolveWrite!: () => void
    const writeSeen = new Promise<void>((resolveWriteSeen) => {
      resolveWrite = resolveWriteSeen
    })

    const agent = await createAgent({
      id: 'agent:write',
      cwd: workspace,
      workspace,
      models: TEST_MODELS,
      factories: [
        ({ signals }) => {
          writeSignal = signals.set({
            key: 'write-result',
            schema: WriteFileResultSchema,
            readOnly: false,
          })
          writeSignal.listen(() => resolveWrite())

          return {}
        },
      ],
    })

    agent.trigger({
      type: AGENT_CORE_EVENTS.write_file,
      detail: {
        input: { path: 'nested/output.txt', content: 'written from signal' },
        signal: writeSignal,
      },
    })

    await writeSeen

    expect(writeSignal?.get()).toEqual({
      input: { path: 'nested/output.txt', content: 'written from signal' },
      output: 19,
    })
    expect(await Bun.file(join(workspace, 'nested/output.txt')).text()).toBe('written from signal')

    await rm(workspace, { recursive: true, force: true })
  })

  test('deletes file through a passed signal using cwd context', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'plaited-agent-delete-'))
    await Bun.write(join(workspace, 'delete-me.txt'), 'gone soon')

    let deleteSignal: ReturnType<typeof import('../use-signal.ts').useSignal<typeof DeleteFileResultSchema>> | undefined
    let resolveDelete!: () => void
    const deleteSeen = new Promise<void>((resolveDeleteSeen) => {
      resolveDelete = resolveDeleteSeen
    })

    const agent = await createAgent({
      id: 'agent:delete',
      cwd: workspace,
      workspace,
      models: TEST_MODELS,
      factories: [
        ({ signals }) => {
          deleteSignal = signals.set({
            key: 'delete-result',
            schema: DeleteFileResultSchema,
            readOnly: false,
          })
          deleteSignal.listen(() => resolveDelete())

          return {}
        },
      ],
    })

    agent.trigger({
      type: AGENT_CORE_EVENTS.delete_file,
      detail: {
        input: 'delete-me.txt',
        signal: deleteSignal,
      },
    })

    await deleteSeen

    expect(deleteSignal?.get()).toEqual({
      input: 'delete-me.txt',
      output: true,
    })
    expect(await Bun.file(join(workspace, 'delete-me.txt')).exists()).toBe(false)

    await rm(workspace, { recursive: true, force: true })
  })

  test('handles request_inference_primary and writes the result to the provided signal', async () => {
    let resultSignal:
      | ReturnType<typeof import('../use-signal.ts').useSignal<typeof PrimaryInferenceResultSchema>>
      | undefined

    const agent = await createAgent({
      id: 'agent:inference',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: {
        async primary() {
          return {
            parsed: {
              thinking: 'considering',
              toolCalls: [],
              message: 'hello from model',
            },
            usage: {
              inputTokens: 2,
              outputTokens: 3,
            },
          }
        },
        vision: TEST_MODELS.vision,
        tts: TEST_MODELS.tts,
      },
      factories: [
        ({ signals, trigger }) => {
          resultSignal = signals.set({
            key: 'inference-result',
            schema: PrimaryInferenceResultSchema,
            readOnly: false,
          })

          return {
            handlers: {
              run_inference() {
                trigger({
                  type: AGENT_CORE_EVENTS.request_inference_primary,
                  detail: {
                    input: {
                      messages: [{ role: 'user', content: 'hi' }],
                    },
                    signal: resultSignal,
                  },
                })
              },
            },
          }
        },
      ],
    })

    agent.trigger({ type: 'run_inference' })
    await Bun.sleep(10)

    expect(resultSignal?.get()).toEqual({
      input: {
        messages: [{ role: 'user', content: 'hi' }],
      },
      output: {
        parsed: {
          thinking: 'considering',
          toolCalls: [],
          message: 'hello from model',
        },
        usage: {
          inputTokens: 2,
          outputTokens: 3,
        },
      },
    })
  })

  test('executes grep through the spawned grep worker using cwd context', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'plaited-agent-grep-'))
    await Bun.write(join(workspace, 'search-target.ts'), 'const alpha = 1\nconst beta = 2\nconst ALPHA = 3\n')

    let grepSignal: ReturnType<typeof import('../use-signal.ts').useSignal<typeof GrepResultSchema>> | undefined
    let resolveGrep!: () => void
    const grepSeen = new Promise<void>((resolve) => {
      resolveGrep = resolve
    })

    const agent = await createAgent({
      id: 'agent:grep',
      cwd: workspace,
      workspace,
      models: TEST_MODELS,
      factories: [
        ({ signals }) => {
          grepSignal = signals.set({
            key: 'grep-result',
            schema: GrepResultSchema,
            readOnly: false,
          })
          grepSignal.listen(() => resolveGrep())

          return {}
        },
      ],
    })

    agent.trigger({
      type: AGENT_CORE_EVENTS.grep,
      detail: {
        input: { pattern: 'alpha', path: 'search-target.ts', ignoreCase: true },
        signal: grepSignal,
      },
    })

    await grepSeen
    expect(grepSignal?.get()).toEqual({
      input: { pattern: 'alpha', path: 'search-target.ts', ignoreCase: true },
      output: {
        status: 'completed',
        matches: [
          {
            path: 'search-target.ts',
            line: 1,
            text: 'const alpha = 1',
          },
          {
            path: 'search-target.ts',
            line: 3,
            text: 'const ALPHA = 3',
          },
        ],
        totalMatches: 2,
        truncated: false,
        exitCode: 0,
      },
    })

    await rm(workspace, { recursive: true, force: true })
  })

  test('globs files through a passed signal using cwd context', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'plaited-agent-glob-'))
    await Bun.write(join(workspace, 'a.ts'), 'export const a = 1')
    await Bun.write(join(workspace, 'b.ts'), 'export const b = 2')
    await Bun.write(join(workspace, 'skip.js'), 'export const skip = true')

    let globSignal: ReturnType<typeof import('../use-signal.ts').useSignal<typeof GlobFilesResultSchema>> | undefined
    let resolveGlob!: () => void
    const globSeen = new Promise<void>((resolve) => {
      resolveGlob = resolve
    })

    const agent = await createAgent({
      id: 'agent:glob',
      cwd: workspace,
      workspace,
      models: TEST_MODELS,
      factories: [
        ({ signals }) => {
          globSignal = signals.set({
            key: 'glob-result',
            schema: GlobFilesResultSchema,
            readOnly: false,
          })
          globSignal.listen(() => resolveGlob())

          return {}
        },
      ],
    })

    agent.trigger({
      type: AGENT_CORE_EVENTS.glob_files,
      detail: {
        input: { pattern: '*.ts' },
        signal: globSignal,
      },
    })

    await globSeen
    expect(globSignal?.get()?.input).toEqual({ pattern: '*.ts' })
    expect(globSignal?.get()?.output.sort()).toEqual(['a.ts', 'b.ts'])

    await rm(workspace, { recursive: true, force: true })
  })
})
