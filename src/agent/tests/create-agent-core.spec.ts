import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { AGENT_CORE, AGENT_CORE_EVENTS } from '../agent.constants.ts'
import { createAgent } from '../create-agent.ts'

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

  test('tool bash request is deferred until matching approval and maps to agent_core:bash', async () => {
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
