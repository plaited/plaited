import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { AGENT_CORE, AGENT_CORE_EVENTS } from '../agent.constants.ts'
import { ToolBashRequestDetailSchema } from '../agent.schemas.ts'
import { createAgent } from '../create-agent.ts'
import { type CreateToolBashRequestEventInput, createToolBashRequestEvent } from '../tool-bash-request.ts'

const withSpawnSpy = async (run: (spawnCalls: Array<{ cmd: string[]; cwd?: string }>) => Promise<void>) => {
  const spawnCalls: Array<{ cmd: string[]; cwd?: string }> = []
  const originalSpawn = Bun.spawn
  Bun.spawn = ((cmd, options) => {
    spawnCalls.push({
      cmd: [...cmd],
      cwd: options?.cwd as string | undefined,
    })
    return {
      exited: Promise.resolve(0),
    } as ReturnType<typeof Bun.spawn>
  }) as typeof Bun.spawn

  try {
    await run(spawnCalls)
  } finally {
    Bun.spawn = originalSpawn
  }
}

describe('createToolBashRequestEvent', () => {
  test('returns canonical tool_bash_request event type', () => {
    const event = createToolBashRequestEvent({
      correlationId: 'corr-1',
      bash: {
        path: './scripts/worker.ts',
        args: ['--flag'],
      },
    })

    expect(event.type).toBe(`${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_request}`)
  })

  test('generates non-empty one-shot requestId', () => {
    const event = createToolBashRequestEvent({
      correlationId: 'corr-2',
      bash: {
        path: './scripts/worker.ts',
        args: [],
      },
    })

    expect(event.detail.requestId.length).toBeGreaterThan(0)
  })

  test('generates different requestId values across calls', () => {
    const first = createToolBashRequestEvent({
      correlationId: 'corr-3',
      bash: {
        path: './scripts/worker.ts',
        args: [],
      },
    })
    const second = createToolBashRequestEvent({
      correlationId: 'corr-3',
      bash: {
        path: './scripts/worker.ts',
        args: [],
      },
    })

    expect(first.detail.requestId).not.toBe(second.detail.requestId)
  })

  test('returns detail that parses via ToolBashRequestDetailSchema', () => {
    const event = createToolBashRequestEvent({
      correlationId: 'corr-4',
      bash: {
        path: './scripts/worker.ts',
        args: ['--check'],
        timeout: 1_500,
      },
    })

    const parsed = ToolBashRequestDetailSchema.parse(event.detail)
    expect(parsed).toEqual(event.detail)
  })

  test('rejects invalid bash payload', () => {
    expect(() =>
      createToolBashRequestEvent({
        correlationId: 'corr-5',
        bash: {
          path: './scripts/worker.ts',
          args: '--bad',
        },
      } as unknown as CreateToolBashRequestEventInput),
    ).toThrow()
  })

  test('caller-supplied requestId cannot override generated value', () => {
    const callerRequestId = 'req-caller-supplied'
    const event = createToolBashRequestEvent({
      requestId: callerRequestId,
      correlationId: 'corr-6',
      bash: {
        path: './scripts/worker.ts',
        args: [],
      },
    } as unknown as CreateToolBashRequestEventInput)

    expect(event.detail.requestId).not.toBe(callerRequestId)
  })

  test('rejects empty correlationId', () => {
    expect(() =>
      createToolBashRequestEvent({
        correlationId: '',
        bash: {
          path: './scripts/worker.ts',
          args: [],
        },
      }),
    ).toThrow()
  })

  test('normalized event flows through createAgent approval gate using generated requestId', async () => {
    await withSpawnSpy(async (spawnCalls) => {
      const workspace = process.cwd()
      const trigger = await createAgent({
        workspace,
        ttlMs: 1_000,
      })

      const normalizedEvent = createToolBashRequestEvent({
        correlationId: 'corr-integration',
        bash: {
          path: './scripts/worker.ts',
          args: ['--from-normalizer'],
        },
      })

      trigger(normalizedEvent)
      await Bun.sleep(0)
      expect(spawnCalls).toHaveLength(0)

      trigger({
        type: `${AGENT_CORE}:${AGENT_CORE_EVENTS.tool_bash_approved}`,
        detail: {
          requestId: normalizedEvent.detail.requestId,
          correlationId: normalizedEvent.detail.correlationId,
        },
      })
      await Bun.sleep(0)

      expect(spawnCalls).toHaveLength(1)
      expect(spawnCalls[0]).toEqual({
        cmd: ['bun', resolve(workspace, 'scripts/worker.ts'), '--from-normalizer'],
        cwd: workspace,
      })
    })
  })
})
