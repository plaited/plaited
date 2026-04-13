import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { AGENT_CORE, AGENT_CORE_EVENTS } from '../agent.constants.ts'
import type { ToolBashResultDetail } from '../agent.schemas.ts'
import { createAgent } from '../create-agent.ts'
import { createToolBashRequestEvent } from '../tool-bash-request.ts'

const TOOL_BASH_RESULTS_KEY = '__plaitedAgentCoreToolBashResults'
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

describe('createAgent core extension', () => {
  test('update_modules installs named extension exports from a module namespace', async () => {
    const state = globalThis as Record<string, unknown>
    state.__plaitedAgentCoreFixtureSeen = false

    const trigger = await createAgent({
      workspace: process.cwd(),
      ttlMs: 1_000,
    })

    trigger({
      type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.update_modules}`,
      detail: './src/agent/tests/fixtures/update-modules-extension.fixture.ts',
    })

    await Bun.sleep(10)

    trigger({
      type: 'agent_core_fixture:ping',
    })

    await Bun.sleep(10)

    expect(state.__plaitedAgentCoreFixtureSeen).toBe(true)
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

        trigger({
          type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.update_modules}`,
          detail: './src/agent/tests/fixtures/tool-bash-result-extension.fixture.ts',
        })
        await Bun.sleep(10)

        const request = createToolBashRequestEvent({
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

        trigger({
          type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.update_modules}`,
          detail: './src/agent/tests/fixtures/tool-bash-result-extension.fixture.ts',
        })
        await Bun.sleep(10)

        const request = createToolBashRequestEvent({
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

        trigger({
          type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.update_modules}`,
          detail: './src/agent/tests/fixtures/tool-bash-result-extension.fixture.ts',
        })
        await Bun.sleep(10)

        const request = createToolBashRequestEvent({
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

        trigger({
          type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.update_modules}`,
          detail: './src/agent/tests/fixtures/tool-bash-result-extension.fixture.ts',
        })
        await Bun.sleep(10)

        const request = createToolBashRequestEvent({
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
