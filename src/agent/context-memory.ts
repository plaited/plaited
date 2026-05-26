import * as z from 'zod'
/**
 * Agent-owned event-detail cache used for listener-topicd context shaping.
 */
import type { BPEvent, BPListener, SpecListener } from '../behavioral.ts'

type MemoryEvent = BPEvent & {
  topic: string
}

type ContextMemoryRecord = {
  detail: BPEvent['detail']
  expiresAt: number
  touchedAt: number
}

const specListenerToBPListener = ({ detailSchema, ...listener }: SpecListener): BPListener => ({
  ...listener,
  ...(detailSchema && {
    detailSchema: z.fromJSONSchema(detailSchema) as BPListener['detailSchema'],
  }),
})

const getMemoryKey = ({ topic, type }: { topic: string; type: string }) => `${topic}:${type}`

/**
 * Creates a topicd in-memory cache for recent event details.
 *
 * @param ttlMs - Number of milliseconds to retain each recorded event detail.
 * @param maxKeys - Optional maximum number of topicd event keys to keep.
 * @returns Context memory operations for recording, retrieving, and pruning details.
 *
 * @remarks
 * Context memory is owned by the agent layer. Listener lookups respect the
 * listener detail schema and optional invalid-match semantics before returning
 * cached detail.
 *
 * @public
 */
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
    record: ({ type, detail, topic }: MemoryEvent) => {
      pruneExpired()
      const entry: ContextMemoryRecord = {
        detail,
        expiresAt: Date.now() + ttlMs,
        touchedAt: 0,
      }
      touch(entry)
      memory.set(getMemoryKey({ topic, type }), entry)
      enforceMaxKeys()
    },
    get: ({ specListener, topic }: { specListener: SpecListener; topic: string }) => {
      pruneExpired()
      const listener = specListenerToBPListener(specListener)
      const entry = memory.get(getMemoryKey({ topic, type: listener.type }))
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
