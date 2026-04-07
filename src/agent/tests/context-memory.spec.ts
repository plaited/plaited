import { describe, expect, test } from 'bun:test'
import { createContextMemory } from '../context-memory.ts'

describe('createContextMemory', () => {
  test('stores last detail per moduleId:eventType', () => {
    const memory = createContextMemory({ ttlMs: 10_000 })

    memory.record({ moduleId: 'mod-1', eventType: 'evt', detail: { n: 1 } })
    memory.record({ moduleId: 'mod-1', eventType: 'evt', detail: { n: 2 } })

    expect(memory.getLastBy('mod-1', 'evt')).toEqual({ n: 2 })
    expect(memory.getLast('mod-1:evt')).toEqual({ n: 2 })
  })

  test('evicts expired records on read and explicit prune', async () => {
    const memory = createContextMemory({ ttlMs: 15 })

    memory.record({ moduleId: 'mod-1', eventType: 'evt', detail: { active: true } })
    expect(memory.getLastBy('mod-1', 'evt')).toEqual({ active: true })

    await Bun.sleep(25)
    expect(memory.getLastBy('mod-1', 'evt')).toBeUndefined()

    memory.record({ moduleId: 'mod-2', eventType: 'evt', detail: { active: true } })
    await Bun.sleep(25)
    memory.pruneExpired()
    expect(memory.getLastBy('mod-2', 'evt')).toBeUndefined()
  })

  test('enforces max key count as deterministic LRU', () => {
    const memory = createContextMemory({ ttlMs: 10_000, maxKeys: 2 })

    memory.record({ moduleId: 'a', eventType: 'e1', detail: 1 })
    memory.record({ moduleId: 'b', eventType: 'e2', detail: 2 })
    memory.getLastBy('a', 'e1')
    memory.record({ moduleId: 'c', eventType: 'e3', detail: 3 })

    expect(memory.getLastBy('a', 'e1')).toBe(1)
    expect(memory.getLastBy('b', 'e2')).toBeUndefined()
    expect(memory.getLastBy('c', 'e3')).toBe(3)
  })
})
