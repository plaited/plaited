import type { EVENT_SOURCES } from './behavioral.constants.ts'
import type { BPListener } from './behavioral.types.ts'

type MemorySource = keyof typeof EVENT_SOURCES

type MemoryEvent = {
  type: string
  source: MemorySource
  detail?: unknown
}

type ContextMemoryRecord = {
  source: MemorySource
  detail: unknown
  expiresAt: number
  touchedAt: number
}

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
    record: ({ type, source, detail }: MemoryEvent) => {
      pruneExpired()
      const entry: ContextMemoryRecord = {
        source,
        detail,
        expiresAt: Date.now() + ttlMs,
        touchedAt: 0,
      }
      touch(entry)
      memory.set(type, entry)
      enforceMaxKeys()
    },
    get: (listener: BPListener) => {
      pruneExpired()
      const entry = memory.get(listener.type)
      if (!entry) {
        return undefined
      }
      if (listener.sourceSchema && !listener.sourceSchema.safeParse(entry.source).success) {
        return undefined
      }
      if (!listener.detailSchema.safeParse(entry.detail).success) {
        return undefined
      }
      touch(entry)
      return entry.detail
    },
    pruneExpired,
  }
}
