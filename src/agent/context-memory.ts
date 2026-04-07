export type ContextMemoryPolicy = {
  ttlMs: number
  maxKeys?: number
}

type ContextMemoryEntry = {
  detail: unknown
  expiresAt: number
}

export type ContextMemory = {
  record: (args: { moduleId: string; eventType: string; detail: unknown }) => void
  getLast: (key: string) => unknown
  getLastBy: (moduleId: string, eventType: string) => unknown
  pruneExpired: () => void
}

const createKey = (moduleId: string, eventType: string) => `${moduleId}:${eventType}`

export const createContextMemory = ({ ttlMs, maxKeys }: ContextMemoryPolicy): ContextMemory => {
  const store = new Map<string, ContextMemoryEntry>()

  const pruneExpired = () => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) {
        store.delete(key)
      }
    }
  }

  const enforceMaxKeys = () => {
    if (maxKeys === undefined || maxKeys <= 0) {
      return
    }
    while (store.size > maxKeys) {
      const oldestKey = store.keys().next().value
      if (!oldestKey) {
        break
      }
      store.delete(oldestKey)
    }
  }

  const getLast = (key: string) => {
    const entry = store.get(key)
    if (!entry) {
      return undefined
    }
    if (entry.expiresAt <= Date.now()) {
      store.delete(key)
      return undefined
    }
    store.delete(key)
    store.set(key, entry)
    return entry.detail
  }

  const getLastBy = (moduleId: string, eventType: string) => getLast(createKey(moduleId, eventType))

  const record = ({ moduleId, eventType, detail }: { moduleId: string; eventType: string; detail: unknown }) => {
    pruneExpired()
    const key = createKey(moduleId, eventType)
    store.delete(key)
    store.set(key, {
      detail,
      expiresAt: Date.now() + ttlMs,
    })
    enforceMaxKeys()
  }

  return {
    record,
    getLast,
    getLastBy,
    pruneExpired,
  }
}
