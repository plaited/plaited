/**
 * Agent-owned event-detail cache used for listener-scoped context shaping.
 */
import type { BPListener } from '../behavioral/behavioral.schemas.ts'

const DEFAULT_CONTEXT_MEMORY_SCOPE = 'default'

type MemoryEvent = {
  type: string
  detail?: unknown
  scope?: string
}

type ContextMemoryRecord = {
  detail: unknown
  expiresAt: number
  touchedAt: number
}

const getMemoryKey = ({ scope, type }: { scope?: string; type: string }) =>
  `${scope ?? DEFAULT_CONTEXT_MEMORY_SCOPE}:${type}`

export const createContextMemory = ({ ttlMs, maxKeys }: { ttlMs: number; maxKeys?: number }) => {
  const memory = new Map<string, ContextMemoryRecord>()
  let tick = 0

  const pruneExpired = () => {
    const now = Date.now()
    for (const [key, entry] of memory) {
      if (entry.expiresAt <= now) {
        memory.delete(key)
      }
    }
  }

  const touch = (entry: ContextMemoryRecord) => {
    tick += 1
    entry.touchedAt = tick
  }

  const enforceMaxKeys = () => {
    if (!maxKeys || maxKeys <= 0) {
      return
    }

    while (memory.size > maxKeys) {
      let oldestKey: string | undefined
      let oldestTouchedAt = Number.POSITIVE_INFINITY

      for (const [key, entry] of memory) {
        if (entry.touchedAt < oldestTouchedAt) {
          oldestTouchedAt = entry.touchedAt
          oldestKey = key
        }
      }

      if (!oldestKey) {
        break
      }
      memory.delete(oldestKey)
    }
  }

  return {
    record: ({ type, detail, scope }: MemoryEvent) => {
      pruneExpired()
      const entry: ContextMemoryRecord = {
        detail,
        expiresAt: Date.now() + ttlMs,
        touchedAt: 0,
      }
      touch(entry)
      memory.set(getMemoryKey({ scope, type }), entry)
      enforceMaxKeys()
    },
    get: ({ listener, scope }: { listener: BPListener; scope?: string }) => {
      pruneExpired()
      const entry = memory.get(getMemoryKey({ scope, type: listener.type }))
      if (!entry) {
        return undefined
      }

      const schemaMatches = listener.detailSchema ? listener.detailSchema.safeParse(entry.detail).success : true
      const detailMatches = listener.detailMatch === 'invalid' ? !schemaMatches : schemaMatches
      if (!detailMatches) {
        return undefined
      }

      touch(entry)
      return entry.detail
    },
    pruneExpired,
  }
}
