import { describe, expect, test } from 'bun:test'
import * as z from 'zod'
import type { BPListener } from '../../behavioral.ts'
import { createContextMemory } from '../context-memory.ts'

const onEvent = ({
  type,
  source,
  detailSchema,
  detailMatch,
}: {
  type: string
  source?: BPListener['source']
  detailSchema?: BPListener['detailSchema']
  detailMatch?: BPListener['detailMatch']
}): BPListener => ({
  type,
  ...(source ? { source } : {}),
  ...(detailSchema ? { detailSchema } : {}),
  ...(detailMatch ? { detailMatch } : {}),
})

describe('createContextMemory', () => {
  test('stores last selected event detail per event type', () => {
    const memory = createContextMemory({ ttlMs: 10_000 })

    memory.record({ type: 'evt', source: 'request', detail: { n: 1 } })
    memory.record({ type: 'evt', source: 'request', detail: { n: 2 } })

    expect(memory.get(onEvent({ type: 'evt' }))).toEqual({ n: 2 })
  })

  test('evicts expired records on read and explicit prune', async () => {
    const memory = createContextMemory({ ttlMs: 15 })
    const listener = onEvent({ type: 'evt', source: 'trigger' })

    memory.record({ type: 'evt', source: 'trigger', detail: { active: true } })
    expect(memory.get(listener)).toEqual({ active: true })

    await Bun.sleep(25)
    expect(memory.get(listener)).toBeUndefined()

    memory.record({ type: 'evt2', source: 'request', detail: { active: true } })
    await Bun.sleep(25)
    memory.pruneExpired()
    expect(memory.get(onEvent({ type: 'evt2' }))).toBeUndefined()
  })

  test('enforces max key count as deterministic LRU', () => {
    const memory = createContextMemory({ ttlMs: 10_000, maxKeys: 2 })

    memory.record({ type: 'e1', source: 'request', detail: 1 })
    memory.record({ type: 'e2', source: 'request', detail: 2 })
    memory.get(onEvent({ type: 'e1' }))
    memory.record({ type: 'e3', source: 'request', detail: 3 })

    expect(memory.get(onEvent({ type: 'e1' }))).toBe(1)
    expect(memory.get(onEvent({ type: 'e2' }))).toBeUndefined()
    expect(memory.get(onEvent({ type: 'e3' }))).toBe(3)
  })

  test('returns undefined when source or detail schema validation fails', () => {
    const memory = createContextMemory({ ttlMs: 10_000 })
    const listener = onEvent({
      type: 'evt',
      source: 'request',
      detailSchema: z.object({ ok: z.literal(true) }),
    })

    memory.record({ type: 'evt', source: 'request', detail: { ok: true } })
    expect(memory.get(listener)).toEqual({ ok: true })

    memory.record({ type: 'evt', source: 'trigger', detail: { ok: true } })
    expect(memory.get(listener)).toBeUndefined()

    memory.record({ type: 'evt', source: 'request', detail: { ok: false } })
    expect(memory.get(listener)).toBeUndefined()
  })

  test('supports detailMatch invalid listeners', () => {
    const memory = createContextMemory({ ttlMs: 10_000 })
    const listener = onEvent({
      type: 'evt',
      detailSchema: z.object({ ok: z.literal(true) }),
      detailMatch: 'invalid',
    })

    memory.record({ type: 'evt', source: 'request', detail: { ok: false } })
    expect(memory.get(listener)).toEqual({ ok: false })

    memory.record({ type: 'evt', source: 'request', detail: { ok: true } })
    expect(memory.get(listener)).toBeUndefined()
  })
})
