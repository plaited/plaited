import { describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import type { Trace } from '../../main/behavioral.schemas.ts'
import { behavioral } from '../../main/behavioral.ts'
import type { AddHandler, AddThread, Trigger } from '../../main/behavioral.types.ts'
import { tempDir } from '../../pack/tests/helpers.ts'
import type { KnownStreamEvent, OpenResponsesRequest } from '../open-responses.schemas.ts'
import { provisionDefaults } from '../provision-defaults.ts'
import { registerAgentThreads } from '../threads.ts'
import { useResponse } from '../use-response.ts'

// ================================================================
// Helpers
// ================================================================

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

/** Create a b-program and return hooks + trace collector. */
const createBP = () => {
  const bp = behavioral<never>()
  const { useAddThread, useAddHandler, useTrigger, useTrace } = bp

  const addThread = useAddThread() as AddThread
  const addHandler = useAddHandler() as AddHandler
  const trigger = useTrigger() as Trigger
  const selected: string[] = []

  useTrace((msg: Trace) => {
    if (msg.kind === 'selection') {
      selected.push(msg.selected.type)
    }
  })

  return { addHandler, addThread, trigger, selected }
}

// ================================================================
// Integration: provisionDefaults through b-program
// ================================================================

describe('provisionDefaults integration', () => {
  const textOnlyEvents: KnownStreamEvent[] = [
    {
      type: 'response.output_item.added',
      item: { id: 'msg_1', type: 'message', status: 'in_progress', role: 'assistant', content: [] },
    },
    {
      type: 'response.output_text.delta',
      item_id: 'msg_1',
      output_index: 0,
      content_index: 0,
      delta: 'Hello',
    },
    {
      type: 'response.output_item.done',
      output_index: 0,
      item: {
        id: 'msg_1',
        type: 'message',
        status: 'completed',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Hello' }],
      },
    },
    {
      type: 'response.completed',
      status: 'completed',
    },
  ]

  test('provisionDefaults wires all tools without error', () => {
    const hooks = createBP()
    expect(() => provisionDefaults(hooks)).not.toThrow()
  })

  test('read tool dispatched through b-program produces _result', async () => {
    const hooks = createBP()
    const descriptors = provisionDefaults(hooks)

    const readToolDesc = descriptors.find((d) => d.name === 'read')
    expect(readToolDesc).toBeDefined()

    const results: string[] = []
    hooks.addHandler('read_result', ({ detail }) => {
      const { output } = (detail ?? {}) as { output: string }
      results.push(output)
    })
    hooks.addHandler('tool.result', ({ detail }) => {
      const { output } = (detail ?? {}) as { output: string }
      results.push(output)
    })

    const { dir, cleanup } = await tempDir({ 'test.txt': 'read me' })
    try {
      hooks.trigger({
        type: 'read',
        detail: {
          call_id: 'call_1',
          arguments: { path: path.join(dir, 'test.txt') },
        },
      })

      for (let i = 0; i < 6; i++) {
        await tick()
      }

      expect(hooks.selected).toContain('read')
      // Wait for async tool handler to finish
      for (let i = 0; i < 6; i++) {
        await tick()
      }
      expect(results.length).toBeGreaterThanOrEqual(1)
    } finally {
      await cleanup()
    }
  })

  test('edit tool dispatched through b-program applies changes', async () => {
    const hooks = createBP()
    provisionDefaults(hooks)

    const { dir, cleanup } = await tempDir({ 'edit.txt': 'old content' })
    const filePath = path.join(dir, 'edit.txt')

    try {
      hooks.trigger({
        type: 'edit',
        detail: {
          call_id: 'call_2',
          arguments: { path: filePath, old_text: 'old content', new_text: 'new content' },
        },
      })

      for (let i = 0; i < 10; i++) {
        await tick()
      }

      expect(hooks.selected).toContain('edit')

      // The file should be updated
      const content = await Bun.file(filePath).text()
      expect(content).toBe('new content')
    } finally {
      await cleanup()
    }
  })

  test('full dispatch flow: provision + registerAgentThreads with tools', async () => {
    const callCount = { count: 0 }
    const adapter = useResponse({
      provider: 'test-provision',
      respond: async function* (_req: OpenResponsesRequest) {
        if (callCount.count === 0) {
          callCount.count++
          yield* textOnlyEvents
        }
      },
    })

    const hooks = createBP()
    const toolDescriptors = provisionDefaults(hooks)
    registerAgentThreads(
      { addThread: hooks.addThread, addHandler: hooks.addHandler, trigger: hooks.trigger },
      adapter,
      toolDescriptors,
    )

    hooks.trigger({ type: 'user.prompt', detail: { prompt: 'Say hello' } })

    for (let i = 0; i < 12; i++) {
      await tick()
    }

    expect(hooks.selected).toContain('turn.end')
  })
})

describe('provisionDefaults — provisioned cwd scoping', () => {
  test('cwd option scopes every tool: relative paths resolve there', async () => {
    const { dir, cleanup } = await tempDir({ 'test.txt': 'scoped read' })
    try {
      const hooks = createBP()
      provisionDefaults(hooks, { cwd: dir })

      const results: string[] = []
      hooks.addHandler('tool.result', ({ detail }) => {
        const { output } = (detail ?? {}) as { output: string }
        results.push(output)
      })

      // Relative path — no dir prefix. The provisioner must resolve it.
      hooks.trigger({
        type: 'read',
        detail: { call_id: 'call_cwd', arguments: { path: 'test.txt' } },
      })

      for (let i = 0; i < 8; i++) {
        await tick()
      }

      expect(hooks.selected).toContain('read')
      expect(hooks.selected).toContain('read_result')
      // The relative path must have resolved into the scoped dir — the result
      // carries the scoped file's content, not a file-not-found error.
      expect(results.some((r) => r.includes('scoped read') && !r.includes('Error'))).toBe(true)
    } finally {
      await cleanup()
    }
  })
})
