import { describe, expect, test } from 'bun:test'
import * as z from 'zod'
import type { BPListener } from '../../behavioral.ts'
import { createContextMemory } from '../context-memory.ts'

const onEvent = ({
  type,
  detailSchema,
  detailMatch,
}: {
  type: string
  detailSchema?: BPListener['detailSchema']
  detailMatch?: BPListener['detailMatch']
}): BPListener => ({
  type,
  ...(detailSchema ? { detailSchema } : {}),
  ...(detailMatch ? { detailMatch } : {}),
})

describe('createContextMemory', () => {
  test('stores last selected event detail per event type', () => {
    const memory = createContextMemory({ ttlMs: 10_000 })

    memory.record({ type: 'evt', topic: 'default', detail: { n: 1 } })
    memory.record({ type: 'evt', topic: 'default', detail: { n: 2 } })

    expect(memory.get({ listener: onEvent({ type: 'evt' }), topic: 'default' })).toEqual({ n: 2 })
  })

  test('stores event details independently per topic', () => {
    const memory = createContextMemory({ ttlMs: 10_000 })
    const listener = onEvent({ type: 'evt' })

    memory.record({ type: 'evt', topic: 'topic-a', detail: { id: 'a' } })
    memory.record({ type: 'evt', topic: 'topic-b', detail: { id: 'b' } })
    memory.record({ type: 'evt', topic: 'default', detail: { id: 'default' } })

    expect(memory.get({ listener, topic: 'topic-a' })).toEqual({ id: 'a' })
    expect(memory.get({ listener, topic: 'topic-b' })).toEqual({ id: 'b' })
    expect(memory.get({ listener, topic: 'default' })).toEqual({ id: 'default' })
  })

  test('evicts expired records on read and explicit prune', async () => {
    const memory = createContextMemory({ ttlMs: 15 })
    const listener = onEvent({ type: 'evt' })

    memory.record({ type: 'evt', topic: 't', detail: { active: true } })
    expect(memory.get({ listener, topic: 't' })).toEqual({ active: true })

    await Bun.sleep(25)
    expect(memory.get({ listener, topic: 't' })).toBeUndefined()

    memory.record({ type: 'evt2', topic: 't', detail: { active: true } })
    await Bun.sleep(25)
    memory.pruneExpired()
    expect(memory.get({ listener: onEvent({ type: 'evt2' }), topic: 't' })).toBeUndefined()
  })

  test('enforces max key count as deterministic LRU', () => {
    const memory = createContextMemory({ ttlMs: 10_000, maxKeys: 2 })

    memory.record({ type: 'e1', topic: 't', detail: { value: 1 } })
    memory.record({ type: 'e2', topic: 't', detail: { value: 2 } })
    memory.get({ listener: onEvent({ type: 'e1' }), topic: 't' })
    memory.record({ type: 'e3', topic: 't', detail: { value: 3 } })

    expect(memory.get({ listener: onEvent({ type: 'e1' }), topic: 't' })).toEqual({ value: 1 })
    expect(memory.get({ listener: onEvent({ type: 'e2' }), topic: 't' })).toBeUndefined()
    expect(memory.get({ listener: onEvent({ type: 'e3' }), topic: 't' })).toEqual({ value: 3 })
  })

  test('returns undefined when detail schema validation fails', () => {
    const memory = createContextMemory({ ttlMs: 10_000 })
    const listener = onEvent({
      type: 'evt',
      detailSchema: z.object({ ok: z.literal(true) }),
    })

    memory.record({ type: 'evt', topic: 't', detail: { ok: true } })
    expect(memory.get({ listener, topic: 't' })).toEqual({ ok: true })

    memory.record({ type: 'evt', topic: 't', detail: { ok: false } })
    expect(memory.get({ listener, topic: 't' })).toBeUndefined()
  })

  test('supports detailMatch invalid listeners', () => {
    const memory = createContextMemory({ ttlMs: 10_000 })
    const listener = onEvent({
      type: 'evt',
      detailSchema: z.object({ ok: z.literal(true) }),
      detailMatch: 'invalid',
    })

    memory.record({ type: 'evt', topic: 't', detail: { ok: false } })
    expect(memory.get({ listener, topic: 't' })).toEqual({ ok: false })

    memory.record({ type: 'evt', topic: 't', detail: { ok: true } })
    expect(memory.get({ listener, topic: 't' })).toBeUndefined()
  })
})
