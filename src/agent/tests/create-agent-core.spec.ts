import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { AGENT_CORE, AGENT_CORE_EVENTS } from '../agent.constants.ts'
import { type BashDetail, ToolBashRequestDetailSchema, type ToolBashResultDetail } from '../agent.schemas.ts'
import { createAgent } from '../create-agent.ts'

const TOOL_BASH_RESULTS_KEY = '__plaitedAgentCoreToolBashResults'
const TOOL_BASH_CAPTURE_EVENT_TYPE = 'agent_core_tool_bash_result_fixture:tool_bash_result_seen'
const MAX_TOOL_BASH_OUTPUT_BYTES = 64 * 1024

type SpawnCall = { cmd: string[]; cwd?: string }
type SpawnResult = { exitCode: number | null; stdout: string; stderr: string }
type SpawnSpyOptions = {
  error?: Error
  result?: SpawnResult
}

const createTextStream = (text: string) =>
  new Response(text).body ??
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close()
    },
  })

const createSpawnProcess = ({ exitCode, stdout, stderr }: SpawnResult) => {
  return {
    exited: Promise.resolve(exitCode),
    stdout: createTextStream(stdout),
    stderr: createTextStream(stderr),
  } as ReturnType<typeof Bun.spawn>
}

const withSpawnSpy = async (
  run: (spawnCalls: SpawnCall[]) => Promise<void>,
  { error, result = { exitCode: 0, stdout: '', stderr: '' } }: SpawnSpyOptions = {},
) => {
  const spawnCalls: SpawnCall[] = []
  const originalSpawn = Bun.spawn
  Bun.spawn = ((cmd, options) => {
    spawnCalls.push({
      cmd: [...cmd],
      cwd: options?.cwd as string | undefined,
    })

    if (error) {
      throw error
    }

    return createSpawnProcess(result)
  }) as typeof Bun.spawn

  try {
    await run(spawnCalls)
  } finally {
    Bun.spawn = originalSpawn
  }
}

const readToolBashResults = () => {
  const state = globalThis as Record<string, unknown>
  const results = state[TOOL_BASH_RESULTS_KEY]
  return Array.isArray(results) ? (results as ToolBashResultDetail[]) : []
}

const createToolBashRequestFixtureEvent = ({ correlationId, bash }: { correlationId: string; bash: BashDetail }) => ({
  type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_request}`,
  detail: ToolBashRequestDetailSchema.parse({
    requestId: Bun.randomUUIDv7(),
    correlationId,
    bash,
  }),
})

const scanActorFixtureDirectory = async (trigger: Awaited<ReturnType<typeof createAgent>>) => {
  trigger({
    type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.actors_scan}`,
    detail: {
      directory: './src/agent/tests/fixtures/actors',
    },
  })
  await Bun.sleep(10)
}

describe('createAgent core extension', () => {
  test('direct execution_process_actor request is not installed as an approval bypass', async () => {
    await withSpawnSpy(async (spawnCalls) => {
      const workspace = process.cwd()
      const trigger = await createAgent({
        workspace,
        ttlMs: 1_000,
      })

      trigger({
        type: 'execution_process_actor:request',
        detail: {
          requestId: 'req-direct-bypass',
          correlationId: 'corr-direct-bypass',
          command: 'bun',
          args: ['-e', 'process.stdout.write("bypass")'],
          cwd: '.',
        },
      })
      await Bun.sleep(0)
      expect(spawnCalls).toHaveLength(0)

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_request}`,
        detail: {
          requestId: 'req-approval-path',
          correlationId: 'corr-approval-path',
          bash: {
            path: './scripts/worker.ts',
            args: ['--approved'],
          },
        },
      })
      await Bun.sleep(0)
      expect(spawnCalls).toHaveLength(0)

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_approved}`,
        detail: {
          requestId: 'req-approval-path',
          correlationId: 'corr-approval-path',
        },
      })
      await Bun.sleep(0)

      expect(spawnCalls).toHaveLength(1)
      expect(spawnCalls[0]).toEqual({
        cmd: ['bun', resolve(workspace, 'scripts/worker.ts'), '--approved'],
        cwd: workspace,
      })
    })
  })

  test('actors_scan installs default actor exports from a workspace directory', async () => {
    const state = globalThis as Record<string, unknown>
    state.__plaitedAgentCoreDefaultActorSeen = false

    const trigger = await createAgent({
      workspace: process.cwd(),
      ttlMs: 1_000,
    })

    await scanActorFixtureDirectory(trigger)

    trigger({
      type: 'agent_core_default_actor_fixture:ping',
    })

    await Bun.sleep(10)

    expect(state.__plaitedAgentCoreDefaultActorSeen).toBe(true)
  })

  test('tool bash request is deferred until matching approval and maps to executable bash', async () => {
    await withSpawnSpy(async (spawnCalls) => {
      const workspace = process.cwd()
      const trigger = await createAgent({
        workspace,
        ttlMs: 1_000,
      })

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_request}`,
        detail: {
          requestId: 'req-1',
          correlationId: 'corr-shared',
          bash: {
            path: './scripts/worker.ts',
            args: ['--value', '42'],
          },
        },
      })
      await Bun.sleep(0)
      expect(spawnCalls).toHaveLength(0)

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_approved}`,
        detail: {
          requestId: 'req-other',
          correlationId: 'corr-shared',
        },
      })
      await Bun.sleep(0)
      expect(spawnCalls).toHaveLength(0)

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_approved}`,
        detail: {
          requestId: 'req-1',
          correlationId: 'corr-shared',
        },
      })
      await Bun.sleep(0)

      expect(spawnCalls).toHaveLength(1)
      expect(spawnCalls[0]).toEqual({
        cmd: ['bun', resolve(workspace, 'scripts/worker.ts'), '--value', '42'],
        cwd: workspace,
      })
    })
  })

  test('tool bash request supports optional workspace-relative cwd mapping', async () => {
    await withSpawnSpy(async (spawnCalls) => {
      const workspace = process.cwd()
      const trigger = await createAgent({
        workspace,
        ttlMs: 1_000,
      })

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_request}`,
        detail: {
          requestId: 'req-cwd',
          correlationId: 'corr-cwd',
          bash: {
            path: './scripts/worker.ts',
            args: ['--cwd'],
            cwd: './src',
          },
        },
      })
      await Bun.sleep(0)
      expect(spawnCalls).toHaveLength(0)

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_approved}`,
        detail: {
          requestId: 'req-cwd',
          correlationId: 'corr-cwd',
        },
      })
      await Bun.sleep(0)

      expect(spawnCalls).toHaveLength(1)
      expect(spawnCalls[0]).toEqual({
        cmd: ['bun', resolve(workspace, 'scripts/worker.ts'), '--cwd'],
        cwd: resolve(workspace, 'src'),
      })
    })
  })

  test('malformed tool_bash_request is blocked and valid requests still execute after approval', async () => {
    await withSpawnSpy(async (spawnCalls) => {
      const workspace = process.cwd()
      const trigger = await createAgent({
        workspace,
        ttlMs: 1_000,
      })

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_request}`,
        detail: {
          requestId: 7,
          correlationId: 'corr-invalid',
          bash: {
            path: './scripts/worker.ts',
            args: ['--invalid'],
          },
        },
      } as unknown as { type: string; detail?: unknown })
      await Bun.sleep(0)
      expect(spawnCalls).toHaveLength(0)

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_request}`,
        detail: {
          requestId: 'req-valid',
          correlationId: 'corr-valid',
          bash: {
            path: './scripts/worker.ts',
            args: ['--valid'],
          },
        },
      })
      await Bun.sleep(0)
      expect(spawnCalls).toHaveLength(0)

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_approved}`,
        detail: {
          requestId: 'req-valid',
          correlationId: 'corr-valid',
        },
      })
      await Bun.sleep(0)

      expect(spawnCalls).toHaveLength(1)
      expect(spawnCalls[0]).toEqual({
        cmd: ['bun', resolve(workspace, 'scripts/worker.ts'), '--valid'],
        cwd: workspace,
      })
    })
  })

  test('approved normalized tool-bash request emits tool_bash_result with request identity', async () => {
    await withSpawnSpy(
      async (spawnCalls) => {
        const state = globalThis as Record<string, unknown>
        state[TOOL_BASH_RESULTS_KEY] = []

        const workspace = process.cwd()
        const trigger = await createAgent({
          workspace,
          ttlMs: 1_000,
        })

        await scanActorFixtureDirectory(trigger)

        const request = createToolBashRequestFixtureEvent({
          correlationId: 'corr-result-ok',
          bash: {
            path: './scripts/worker.ts',
            args: ['--result-ok'],
          },
        })

        trigger(request)
        await Bun.sleep(0)
        expect(readToolBashResults()).toHaveLength(0)

        trigger({
          type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_approved}`,
          detail: {
            requestId: request.detail.requestId,
            correlationId: request.detail.correlationId,
          },
        })
        await Bun.sleep(10)
        trigger({ type: TOOL_BASH_CAPTURE_EVENT_TYPE })
        await Bun.sleep(0)

        expect(spawnCalls).toHaveLength(1)
        expect(spawnCalls[0]).toEqual({
          cmd: ['bun', resolve(workspace, 'scripts/worker.ts'), '--result-ok'],
          cwd: workspace,
        })

        expect(readToolBashResults()).toEqual([
          {
            requestId: request.detail.requestId,
            correlationId: request.detail.correlationId,
            exitCode: 0,
            stdout: 'stdout-ok',
            stderr: 'stderr-ok',
          },
        ])
      },
      {
        result: {
          exitCode: 0,
          stdout: 'stdout-ok',
          stderr: 'stderr-ok',
        },
      },
    )
  })

  test('non-zero bash exits are reported via tool_bash_result without inference coupling', async () => {
    await withSpawnSpy(
      async () => {
        const state = globalThis as Record<string, unknown>
        state[TOOL_BASH_RESULTS_KEY] = []

        const trigger = await createAgent({
          workspace: process.cwd(),
          ttlMs: 1_000,
        })

        await scanActorFixtureDirectory(trigger)

        const request = createToolBashRequestFixtureEvent({
          correlationId: 'corr-result-nonzero',
          bash: {
            path: './scripts/worker.ts',
            args: ['--result-nonzero'],
          },
        })

        trigger(request)
        trigger({
          type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_approved}`,
          detail: {
            requestId: request.detail.requestId,
            correlationId: request.detail.correlationId,
          },
        })
        await Bun.sleep(10)
        trigger({ type: TOOL_BASH_CAPTURE_EVENT_TYPE })
        await Bun.sleep(0)

        expect(readToolBashResults()).toEqual([
          {
            requestId: request.detail.requestId,
            correlationId: request.detail.correlationId,
            exitCode: 17,
            stdout: 'partial-output',
            stderr: 'command failed',
          },
        ])
      },
      {
        result: {
          exitCode: 17,
          stdout: 'partial-output',
          stderr: 'command failed',
        },
      },
    )
  })

  test('stdout/stderr capture is bounded and marks truncation in tool_bash_result', async () => {
    const largeStdout = 'a'.repeat(90_000)
    const largeStderr = 'b'.repeat(95_000)

    await withSpawnSpy(
      async () => {
        const state = globalThis as Record<string, unknown>
        state[TOOL_BASH_RESULTS_KEY] = []

        const trigger = await createAgent({
          workspace: process.cwd(),
          ttlMs: 1_000,
        })

        await scanActorFixtureDirectory(trigger)

        const request = createToolBashRequestFixtureEvent({
          correlationId: 'corr-result-truncated',
          bash: {
            path: './scripts/worker.ts',
            args: ['--result-truncated'],
          },
        })

        trigger(request)
        trigger({
          type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_approved}`,
          detail: {
            requestId: request.detail.requestId,
            correlationId: request.detail.correlationId,
          },
        })
        await Bun.sleep(10)
        trigger({ type: TOOL_BASH_CAPTURE_EVENT_TYPE })
        await Bun.sleep(0)

        const results = readToolBashResults()
        expect(results).toHaveLength(1)
        const result = results[0]
        expect(result).toBeDefined()
        expect(result?.requestId).toBe(request.detail.requestId)
        expect(result?.correlationId).toBe(request.detail.correlationId)
        expect(result?.stdoutTruncated).toBe(true)
        expect(result?.stderrTruncated).toBe(true)
        expect(result?.stdout.length).toBe(MAX_TOOL_BASH_OUTPUT_BYTES)
        expect(result?.stderr.length).toBe(MAX_TOOL_BASH_OUTPUT_BYTES)
      },
      {
        result: {
          exitCode: 0,
          stdout: largeStdout,
          stderr: largeStderr,
        },
      },
    )
  })

  test('spawn failures are reported via tool_bash_result with nullable exitCode', async () => {
    await withSpawnSpy(
      async (spawnCalls) => {
        const state = globalThis as Record<string, unknown>
        state[TOOL_BASH_RESULTS_KEY] = []

        const workspace = process.cwd()
        const trigger = await createAgent({
          workspace,
          ttlMs: 1_000,
        })

        await scanActorFixtureDirectory(trigger)

        const request = createToolBashRequestFixtureEvent({
          correlationId: 'corr-result-error',
          bash: {
            path: './scripts/worker.ts',
            args: ['--result-error'],
          },
        })

        trigger(request)
        trigger({
          type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_approved}`,
          detail: {
            requestId: request.detail.requestId,
            correlationId: request.detail.correlationId,
          },
        })
        await Bun.sleep(10)
        trigger({ type: TOOL_BASH_CAPTURE_EVENT_TYPE })
        await Bun.sleep(0)

        expect(spawnCalls).toHaveLength(1)
        expect(spawnCalls[0]).toEqual({
          cmd: ['bun', resolve(workspace, 'scripts/worker.ts'), '--result-error'],
          cwd: workspace,
        })

        expect(readToolBashResults()).toEqual([
          {
            requestId: request.detail.requestId,
            correlationId: request.detail.correlationId,
            exitCode: null,
            stdout: '',
            stderr: '',
            error: 'spawn blew up',
          },
        ])
      },
      {
        error: new Error('spawn blew up'),
      },
    )
  })

  test('legacy mapping/path failures still emit tool_bash_result after approval', async () => {
    await withSpawnSpy(async (spawnCalls) => {
      const state = globalThis as Record<string, unknown>
      state[TOOL_BASH_RESULTS_KEY] = []

      const trigger = await createAgent({
        workspace: process.cwd(),
        ttlMs: 1_000,
      })

      await scanActorFixtureDirectory(trigger)

      const request = createToolBashRequestFixtureEvent({
        correlationId: 'corr-result-escape',
        bash: {
          path: '../escape.ts',
          args: [],
        },
      })

      trigger(request)
      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_approved}`,
        detail: {
          requestId: request.detail.requestId,
          correlationId: request.detail.correlationId,
        },
      })
      await Bun.sleep(10)
      trigger({ type: TOOL_BASH_CAPTURE_EVENT_TYPE })
      await Bun.sleep(0)

      expect(spawnCalls).toHaveLength(0)
      expect(readToolBashResults()).toHaveLength(1)
      const result = readToolBashResults()[0]
      expect(result).toBeDefined()
      expect(result?.requestId).toBe(request.detail.requestId)
      expect(result?.correlationId).toBe(request.detail.correlationId)
      expect(result?.exitCode).toBeNull()
      expect(result?.stdout).toBe('')
      expect(result?.stderr).toBe('')
      expect(result?.error).toContain('outside workspace')
    })
  })

  test('duplicate requestId does not create multiple executable gates', async () => {
    await withSpawnSpy(async (spawnCalls) => {
      const workspace = process.cwd()
      const trigger = await createAgent({
        workspace,
        ttlMs: 1_000,
      })

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_request}`,
        detail: {
          requestId: 'req-dup',
          correlationId: 'corr-dup',
          bash: {
            path: './scripts/worker.ts',
            args: ['a'],
          },
        },
      })
      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_request}`,
        detail: {
          requestId: 'req-dup',
          correlationId: 'corr-dup',
          bash: {
            path: './scripts/worker.ts',
            args: ['b'],
          },
        },
      })
      await Bun.sleep(0)
      expect(spawnCalls).toHaveLength(0)

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_approved}`,
        detail: {
          requestId: 'req-dup',
          correlationId: 'corr-dup',
        },
      })
      await Bun.sleep(0)

      expect(spawnCalls).toHaveLength(1)
      expect(spawnCalls[0]?.cmd).toEqual(['bun', resolve(workspace, 'scripts/worker.ts'), 'a'])
    })
  })

  test('denied requestId becomes terminal and cannot be reused', async () => {
    await withSpawnSpy(async (spawnCalls) => {
      const workspace = process.cwd()
      const trigger = await createAgent({
        workspace,
        ttlMs: 1_000,
      })

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_request}`,
        detail: {
          requestId: 'req-denied',
          correlationId: 'corr-denied',
          bash: {
            path: './scripts/worker.ts',
            args: ['denied'],
          },
        },
      })
      await Bun.sleep(0)
      expect(spawnCalls).toHaveLength(0)

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_denied}`,
        detail: {
          requestId: 'req-denied',
          correlationId: 'corr-denied',
          reason: 'policy_denied',
        },
      })
      await Bun.sleep(0)
      expect(spawnCalls).toHaveLength(0)

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_request}`,
        detail: {
          requestId: 'req-denied',
          correlationId: 'corr-denied',
          bash: {
            path: './scripts/worker.ts',
            args: ['retry'],
          },
        },
      })
      await Bun.sleep(0)
      expect(spawnCalls).toHaveLength(0)

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_approved}`,
        detail: {
          requestId: 'req-denied',
          correlationId: 'corr-denied',
        },
      })
      await Bun.sleep(0)
      expect(spawnCalls).toHaveLength(0)
    })
  })

  test('approved requestId becomes terminal and cannot be reused', async () => {
    await withSpawnSpy(async (spawnCalls) => {
      const workspace = process.cwd()
      const trigger = await createAgent({
        workspace,
        ttlMs: 1_000,
      })

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_request}`,
        detail: {
          requestId: 'req-complete',
          correlationId: 'corr-complete',
          bash: {
            path: './scripts/worker.ts',
            args: ['first'],
          },
        },
      })
      await Bun.sleep(0)
      expect(spawnCalls).toHaveLength(0)

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_approved}`,
        detail: {
          requestId: 'req-complete',
          correlationId: 'corr-complete',
        },
      })
      await Bun.sleep(0)

      expect(spawnCalls).toHaveLength(1)
      expect(spawnCalls[0]?.cmd).toEqual(['bun', resolve(workspace, 'scripts/worker.ts'), 'first'])

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_request}`,
        detail: {
          requestId: 'req-complete',
          correlationId: 'corr-complete',
          bash: {
            path: './scripts/worker.ts',
            args: ['second'],
          },
        },
      })
      await Bun.sleep(0)
      expect(spawnCalls).toHaveLength(1)

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_approved}`,
        detail: {
          requestId: 'req-complete',
          correlationId: 'corr-complete',
        },
      })
      await Bun.sleep(0)

      expect(spawnCalls).toHaveLength(1)
    })
  })
})
