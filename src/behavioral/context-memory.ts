// import type { EVENT_SOURCES } from './behavioral.constants.ts'
// import type { BPListener } from './behavioral.types.ts'

// export type ContextMemoryPolicy = {
//   ttlMs: number
//   maxKeys?: number
// }

// type ContextMemoryEntry = {
//   source: keyof typeof EVENT_SOURCES
//   detail: unknown
//   expiresAt: number
// }

// export type ContextMemory = {
//   record: (args: { type: string; source: keyof typeof EVENT_SOURCES; detail: unknown }) => void
//   latest: (listener: BPListener) => unknown
//   pruneExpired: () => void
// }

//   export const createContextMemory = ({ ttlMs, maxKeys }: ContextMemoryPolicy): ContextMemory => {
//   const store = new Map<string, ContextMemoryEntry>()

//   const pruneExpired = () => {
//     const now = Date.now()
//     for (const [key, entry] of store) {
//       if (entry.expiresAt <= now) {
//         store.delete(key)
//       }
//     }
//   }

//   const enforceMaxKeys = () => {
//     if (maxKeys === undefined || maxKeys <= 0) {
//       return
//     }
//     while (store.size > maxKeys) {
//       const oldestKey = store.keys().next().value
//       if (!oldestKey) {
//         break
//       }
//       store.delete(oldestKey)
//     }
//   }

//   const useLatest = () => (listener: BPListener) => {
//     const entry = store.get(listener.type)
//     if (!entry) {
//       return undefined
//     }
//     if (entry.expiresAt <= Date.now()) {
//       store.delete(listener.type)
//       return undefined
//     }
//     store.delete(listener.type)
//     store.set(listener.type, entry)
//     const detail = listener.detailSchema.safeParse(entry.detail)
//     if (!detail.success) {
//       return undefined
//     }
//     return detail.data
//   }

//   const record = ({ type, source, detail }: { type: string; source: keyof typeof EVENT_SOURCES; detail: unknown }) => {
//     pruneExpired()
//     store.delete(type)
//     store.set(type, {
//       source,
//       detail,
//       expiresAt: Date.now() + ttlMs,
//     })
//     enforceMaxKeys()
//   }

//   return {
//     record,
//     latest,
//     pruneExpired,
//   }
// }
