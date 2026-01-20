/**
 * Semantic Cache for LLM responses.
 *
 * @remarks
 * Caches LLM responses based on semantic similarity to previous queries.
 * Uses node-llama-cpp for in-process embeddings with GGUF models.
 *
 * **Benefits:**
 * - Reduces API costs by serving cached responses for similar queries
 * - Improves latency for common query patterns
 * - Cross-platform: works on macOS, Linux, and Windows
 * - No external daemon required (runs in-process)
 * - Pluggable persistence via `onPersist` callback
 *
 * **Model Management:**
 * - Models auto-download from Hugging Face on first use
 * - Default: all-MiniLM-L6-v2 (Q8_0, ~25MB, 384 dimensions)
 * - Cached in `~/.cache/plaited/models` by default
 *
 * **Graceful Degradation:**
 * - If model loading fails, `createSemanticCache` returns `undefined`
 * - Callers should check the return value and fall back gracefully
 *
 * @module
 */

import type { EmbedderConfig } from './agent.types.ts'
import { cosineSimilarity, createEmbedder } from './embedder.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Internal cache entry with embedding.
 *
 * @internal
 */
type InternalCacheEntry = {
  /** Unique identifier */
  id: number
  /** Original query text */
  query: string
  /** Cached response */
  response: string
  /** Timestamp when cached */
  cachedAt: number
  /** Number of times this cache entry was hit */
  hitCount: number
  /** Query embedding vector */
  embedding: readonly number[]
}

/**
 * Serializable cache entry for persistence.
 */
export type SerializableCacheEntry = {
  /** Unique identifier */
  id: number
  /** Original query text */
  query: string
  /** Cached response */
  response: string
  /** Timestamp when cached */
  cachedAt: number
  /** Number of times this cache entry was hit */
  hitCount: number
  /** Query embedding vector */
  embedding: number[]
}

/**
 * Semantic cache configuration.
 */
export type SemanticCacheConfig = {
  /** Embedder configuration */
  embedder?: EmbedderConfig
  /** Similarity threshold for cache hits (default: 0.85) */
  similarityThreshold?: number
  /** Maximum cache entries (default: 1000) */
  maxEntries?: number
  /** TTL in milliseconds (default: 24 hours) */
  ttlMs?: number
  /**
   * Called when persist() is invoked.
   * Receives the full cache snapshot - user decides where/how to store.
   */
  onPersist?: (entries: SerializableCacheEntry[]) => void | Promise<void>
  /**
   * Initial entries to hydrate the cache.
   * User loads from wherever (file, API, DB) before creating cache.
   */
  initialEntries?: SerializableCacheEntry[]
  /**
   * If true, calls onPersist after every mutation.
   * @defaultValue false
   */
  autoPersist?: boolean
}

/**
 * Cached entry metadata (returned in lookup results).
 */
export type CacheEntry = {
  /** Original query text */
  query: string
  /** Cached response */
  response: string
  /** Timestamp when cached */
  cachedAt: number
  /** Number of times this cache entry was hit */
  hitCount: number
  /** Similarity score (for lookup results) */
  similarity?: number
}

/**
 * Cache lookup result.
 */
export type CacheLookupResult = {
  /** Whether a cache hit occurred */
  hit: boolean
  /** Cached entry if hit */
  entry?: CacheEntry
  /** Time taken for lookup in ms */
  lookupMs: number
}

/**
 * Cache statistics.
 */
export type CacheStats = {
  /** Total entries in cache */
  totalEntries: number
  /** Total cache hits */
  totalHits: number
  /** Total cache misses */
  totalMisses: number
  /** Hit rate (0-1) */
  hitRate: number
  /** Average similarity score for hits */
  avgSimilarity: number
}

/**
 * Semantic cache interface.
 */
export type SemanticCache = {
  /** Look up a query in the cache */
  lookup: (query: string) => Promise<CacheLookupResult>
  /** Store a query-response pair */
  store: (query: string, response: string) => Promise<void>
  /** Get or compute: lookup first, compute on miss, then store */
  getOrCompute: (query: string, compute: () => Promise<string>) => Promise<{ response: string; cached: boolean }>
  /** Get cache statistics */
  stats: () => CacheStats
  /** Clear all entries */
  clear: () => void
  /** Clear expired entries */
  clearExpired: () => number
  /** Persist current state via onPersist callback */
  persist: () => void | Promise<void>
  /** Close the cache */
  close: () => void
}

// ============================================================================
// Semantic Cache Implementation
// ============================================================================

/**
 * Creates a semantic cache for LLM responses.
 *
 * @param config - Cache configuration options
 * @returns Promise resolving to a semantic cache instance, or `undefined` if embedder unavailable
 *
 * @remarks
 * Uses in-memory Map for all storage. Vector similarity is computed using cosine similarity.
 * Persistence is pluggable via `onPersist` callback.
 *
 * **Requirements:** Model must be downloadable/loadable for semantic caching.
 * If model loading fails, returns `undefined` instead of throwing.
 *
 * **Performance:** Linear search with ~3.5ms for 10K vectors (384 dimensions).
 * For caches with <10K entries, this is negligible compared to embedding
 * generation time (~10-50ms via llama.cpp).
 */
export const createSemanticCache = async (config: SemanticCacheConfig = {}): Promise<SemanticCache | undefined> => {
  const {
    embedder: embedderConfig,
    similarityThreshold = 0.85,
    maxEntries = 1000,
    ttlMs = 24 * 60 * 60 * 1000,
    onPersist,
    initialEntries = [],
    autoPersist = false,
  } = config

  // Initialize embedder - returns undefined if unavailable
  const embedder = await createEmbedder(embedderConfig)
  if (!embedder) {
    return undefined
  }

  // In-memory storage: id -> entry with embedding
  const entries = new Map<number, InternalCacheEntry>()

  // Auto-incrementing ID counter
  let nextId = 1

  // Hydrate from initial entries
  for (const entry of initialEntries) {
    entries.set(entry.id, {
      ...entry,
      embedding: entry.embedding,
    })
    if (entry.id >= nextId) {
      nextId = entry.id + 1
    }
  }

  // Statistics
  let totalHits = 0
  let totalMisses = 0
  let totalSimilarity = 0

  /**
   * Triggers persistence if configured.
   * @internal
   */
  const maybePersist = async (): Promise<void> => {
    if (autoPersist && onPersist) {
      const snapshot = [...entries.values()].map((e) => ({
        id: e.id,
        query: e.query,
        response: e.response,
        cachedAt: e.cachedAt,
        hitCount: e.hitCount,
        embedding: [...e.embedding],
      }))
      await onPersist(snapshot)
    }
  }

  /**
   * Finds the most similar embedding using linear search.
   *
   * @internal
   */
  const findMostSimilar = (
    queryEmbedding: readonly number[],
  ): { entry: InternalCacheEntry; similarity: number } | undefined => {
    let bestEntry: InternalCacheEntry | undefined
    let bestSimilarity = -Infinity

    for (const entry of entries.values()) {
      const similarity = cosineSimilarity(queryEmbedding, entry.embedding)
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity
        bestEntry = entry
      }
    }

    if (bestEntry !== undefined && bestSimilarity >= similarityThreshold) {
      return { entry: bestEntry, similarity: bestSimilarity }
    }

    return undefined
  }

  /**
   * Removes oldest entries to enforce max entries limit.
   *
   * @internal
   */
  const enforceMaxEntries = (): void => {
    if (entries.size >= maxEntries) {
      // Find oldest entries
      const sorted = [...entries.values()].sort((a, b) => a.cachedAt - b.cachedAt)
      const toRemove = sorted.slice(0, entries.size - maxEntries + 1)

      for (const entry of toRemove) {
        entries.delete(entry.id)
      }
    }
  }

  const cache: SemanticCache = {
    async lookup(query: string): Promise<CacheLookupResult> {
      const startTime = performance.now()

      // Compute query embedding
      const queryEmbedding = await embedder.embed(query)

      // Find most similar cached entry
      const match = findMostSimilar(queryEmbedding)

      const lookupMs = performance.now() - startTime

      if (match) {
        const now = Date.now()

        // Check TTL
        if (now - match.entry.cachedAt < ttlMs) {
          match.entry.hitCount++
          totalHits++
          totalSimilarity += match.similarity

          void maybePersist()

          return {
            hit: true,
            entry: {
              query: match.entry.query,
              response: match.entry.response,
              cachedAt: match.entry.cachedAt,
              hitCount: match.entry.hitCount,
              similarity: match.similarity,
            },
            lookupMs,
          }
        }
      }

      totalMisses++
      return { hit: false, lookupMs }
    },

    async store(query: string, response: string): Promise<void> {
      // Compute embedding
      const embedding = await embedder.embed(query)

      // Enforce max entries
      enforceMaxEntries()

      // Create new entry
      const id = nextId++
      const entry: InternalCacheEntry = {
        id,
        query,
        response,
        cachedAt: Date.now(),
        hitCount: 0,
        embedding,
      }

      entries.set(id, entry)
      void maybePersist()
    },

    async getOrCompute(query: string, compute: () => Promise<string>): Promise<{ response: string; cached: boolean }> {
      const lookupResult = await cache.lookup(query)

      if (lookupResult.hit && lookupResult.entry) {
        return { response: lookupResult.entry.response, cached: true }
      }

      const response = await compute()
      await cache.store(query, response)
      return { response, cached: false }
    },

    stats(): CacheStats {
      const total = totalHits + totalMisses

      return {
        totalEntries: entries.size,
        totalHits,
        totalMisses,
        hitRate: total > 0 ? totalHits / total : 0,
        avgSimilarity: totalHits > 0 ? totalSimilarity / totalHits : 0,
      }
    },

    clear(): void {
      entries.clear()
      totalHits = 0
      totalMisses = 0
      totalSimilarity = 0
      void maybePersist()
    },

    clearExpired(): number {
      const expiredBefore = Date.now() - ttlMs
      let removed = 0

      for (const [id, entry] of entries) {
        if (entry.cachedAt < expiredBefore) {
          entries.delete(id)
          removed++
        }
      }

      if (removed > 0) {
        void maybePersist()
      }

      return removed
    },

    async persist(): Promise<void> {
      if (onPersist) {
        const snapshot = [...entries.values()].map((e) => ({
          id: e.id,
          query: e.query,
          response: e.response,
          cachedAt: e.cachedAt,
          hitCount: e.hitCount,
          embedding: [...e.embedding],
        }))
        await onPersist(snapshot)
      }
    },

    close(): void {
      entries.clear()
      // Note: embedder.dispose() is async but close() is sync for API compat
      // The model will be garbage collected
    },
  }

  return cache
}
