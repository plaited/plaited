/**
 * Semantic Cache for LLM responses.
 *
 * @remarks
 * Caches LLM responses based on semantic similarity to previous queries.
 * Uses the same embedding infrastructure as tool-discovery for consistency.
 *
 * Benefits:
 * - Reduces API costs by serving cached responses for similar queries
 * - Improves latency for common query patterns
 * - Works across sessions with persistent storage
 *
 * Trade-offs:
 * - Requires embedding model (adds ~200ms latency on cache miss)
 * - Memory usage scales with cache size
 * - Similarity threshold tuning needed per use case
 */

import { Database } from 'bun:sqlite'
import type { EmbedderConfig } from './agent.types.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Semantic cache configuration.
 */
export type SemanticCacheConfig = {
  /** Path to SQLite database (default: ':memory:') */
  dbPath?: string
  /** Embedder configuration (required for semantic cache) */
  embedder?: EmbedderConfig
  /** Similarity threshold for cache hits (default: 0.85) */
  similarityThreshold?: number
  /** Maximum cache entries (default: 1000) */
  maxEntries?: number
  /** TTL in milliseconds (default: 24 hours) */
  ttlMs?: number
}

/**
 * Cached entry metadata.
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
  /** Close the cache */
  close: () => void
}

// ============================================================================
// Vector Math
// ============================================================================

/**
 * Computes cosine similarity between two vectors.
 *
 * @internal
 */
const cosineSimilarity = (a: Float32Array, b: Float32Array): number => {
  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// ============================================================================
// Embedder Factory
// ============================================================================

type EmbedderFn = (text: string) => Promise<Float32Array>

const DEFAULT_MODEL = 'Xenova/multilingual-e5-small'

/**
 * Creates an embedder function using Transformers.js.
 *
 * @internal
 */
const createEmbedder = async (config: EmbedderConfig = {}): Promise<EmbedderFn> => {
  const { model = DEFAULT_MODEL, dtype = 'q8', device = 'auto' } = config

  const { pipeline } = await import('@huggingface/transformers')

  const extractor = await pipeline('feature-extraction', model, {
    dtype,
    device,
  })

  const isE5Model = model.toLowerCase().includes('e5')

  return async (text: string): Promise<Float32Array> => {
    const input = isE5Model ? `query: ${text}` : text
    const output = await extractor(input, { pooling: 'mean', normalize: true })
    return new Float32Array(output.data as ArrayLike<number>)
  }
}

// ============================================================================
// Semantic Cache Implementation
// ============================================================================

/**
 * Creates a semantic cache for LLM responses.
 *
 * @param config - Cache configuration
 * @returns Semantic cache instance
 *
 * @remarks
 * Uses embeddings to find semantically similar cached queries.
 * Requires an embedding model (loaded lazily on first use).
 *
 * See `src/agent-next/tests/semantic-cache.spec.ts` for usage patterns.
 */
export const createSemanticCache = async (config: SemanticCacheConfig = {}): Promise<SemanticCache> => {
  const {
    dbPath = ':memory:',
    embedder: embedderConfig,
    similarityThreshold = 0.85,
    maxEntries = 1000,
    ttlMs = 24 * 60 * 60 * 1000,
  } = config

  const db = new Database(dbPath)

  // Create schema
  db.run(`
    CREATE TABLE IF NOT EXISTS cache_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      response TEXT NOT NULL,
      embedding_json TEXT NOT NULL,
      cached_at INTEGER NOT NULL,
      hit_count INTEGER DEFAULT 0
    )
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_cached_at ON cache_entries(cached_at)`)

  // Initialize embedder
  const embedder = await createEmbedder(embedderConfig)

  // In-memory vector index for fast similarity search
  const vectorIndex = new Map<number, Float32Array>()

  // Load existing embeddings into memory
  const existingEntries = db
    .query<{ id: number; embedding_json: string }, []>(`SELECT id, embedding_json FROM cache_entries`)
    .all()

  for (const entry of existingEntries) {
    const embedding = new Float32Array(JSON.parse(entry.embedding_json))
    vectorIndex.set(entry.id, embedding)
  }

  // Statistics
  let totalHits = 0
  let totalMisses = 0
  let totalSimilarity = 0

  // Prepared statements
  const insertStmt = db.prepare(`
    INSERT INTO cache_entries (query, response, embedding_json, cached_at, hit_count)
    VALUES ($query, $response, $embeddingJson, $cachedAt, 0)
  `)

  const getByIdStmt = db.prepare<CacheEntry & { id: number }, { $id: number }>(`
    SELECT id, query, response, cached_at as cachedAt, hit_count as hitCount
    FROM cache_entries WHERE id = $id
  `)

  const incrementHitStmt = db.prepare(`UPDATE cache_entries SET hit_count = hit_count + 1 WHERE id = $id`)

  const deleteOldestStmt = db.prepare(`
    DELETE FROM cache_entries WHERE id IN (
      SELECT id FROM cache_entries ORDER BY cached_at ASC LIMIT $count
    )
  `)

  const deleteExpiredStmt = db.prepare(`DELETE FROM cache_entries WHERE cached_at < $expiredBefore`)

  const countStmt = db.prepare<{ count: number }, []>(`SELECT COUNT(*) as count FROM cache_entries`)

  const cache: SemanticCache = {
    async lookup(query: string): Promise<CacheLookupResult> {
      const startTime = performance.now()

      // Compute query embedding
      const queryEmbedding = await embedder(query)

      // Find most similar cached entry
      let bestMatch: { id: number; similarity: number } | undefined
      const now = Date.now()

      for (const [id, embedding] of vectorIndex) {
        const similarity = cosineSimilarity(queryEmbedding, embedding)

        if (similarity >= similarityThreshold) {
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { id, similarity }
          }
        }
      }

      const lookupMs = performance.now() - startTime

      if (bestMatch) {
        const entry = getByIdStmt.get({ $id: bestMatch.id })

        // Check TTL
        if (entry && now - entry.cachedAt < ttlMs) {
          incrementHitStmt.run({ $id: bestMatch.id })
          totalHits++
          totalSimilarity += bestMatch.similarity

          return {
            hit: true,
            entry: {
              query: entry.query,
              response: entry.response,
              cachedAt: entry.cachedAt,
              hitCount: entry.hitCount + 1,
              similarity: bestMatch.similarity,
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
      const embedding = await embedder(query)
      const embeddingJson = JSON.stringify(Array.from(embedding))

      // Enforce max entries
      const { count } = countStmt.get()!
      if (count >= maxEntries) {
        const toDelete = count - maxEntries + 1
        deleteOldestStmt.run({ $count: toDelete })

        // Remove from vector index
        const deletedIds = db
          .query<{ id: number }, []>(`SELECT id FROM cache_entries ORDER BY cached_at ASC LIMIT ${toDelete}`)
          .all()

        for (const { id } of deletedIds) {
          vectorIndex.delete(id)
        }
      }

      // Insert new entry
      insertStmt.run({
        $query: query,
        $response: response,
        $embeddingJson: embeddingJson,
        $cachedAt: Date.now(),
      })

      // Add to vector index
      const lastId = db.query<{ id: number }, []>(`SELECT last_insert_rowid() as id`).get()!.id
      vectorIndex.set(lastId, embedding)
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
      const { count: totalEntries } = countStmt.get()!
      const total = totalHits + totalMisses

      return {
        totalEntries,
        totalHits,
        totalMisses,
        hitRate: total > 0 ? totalHits / total : 0,
        avgSimilarity: totalHits > 0 ? totalSimilarity / totalHits : 0,
      }
    },

    clear(): void {
      db.run(`DELETE FROM cache_entries`)
      vectorIndex.clear()
      totalHits = 0
      totalMisses = 0
      totalSimilarity = 0
    },

    clearExpired(): number {
      const expiredBefore = Date.now() - ttlMs
      const result = deleteExpiredStmt.run({ $expiredBefore: expiredBefore })

      // Rebuild vector index
      vectorIndex.clear()
      const entries = db
        .query<{ id: number; embedding_json: string }, []>(`SELECT id, embedding_json FROM cache_entries`)
        .all()

      for (const entry of entries) {
        const embedding = new Float32Array(JSON.parse(entry.embedding_json))
        vectorIndex.set(entry.id, embedding)
      }

      return result.changes
    },

    close(): void {
      db.close()
    },
  }

  return cache
}
