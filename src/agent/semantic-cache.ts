/**
 * Semantic Cache for LLM responses.
 *
 * @remarks
 * Caches LLM responses based on semantic similarity to previous queries.
 * Uses Ollama for embeddings and pure JavaScript cosine similarity.
 *
 * **Benefits:**
 * - Reduces API costs by serving cached responses for similar queries
 * - Improves latency for common query patterns
 * - Works across sessions with persistent storage
 * - Cross-platform: works on macOS, Linux, and Windows
 *
 * **Requirements:**
 * - Ollama installed from https://ollama.com (auto-starts if not running)
 * - Embedding model auto-pulled on first use (default: all-minilm, 22MB)
 *
 * **Graceful Degradation:**
 * - If Ollama is not installed, `createSemanticCache` returns `undefined`
 * - Callers should check the return value and fall back gracefully (e.g., FTS5-only search)
 *
 * @module
 */

import { Database } from 'bun:sqlite'
import { $ } from 'bun'
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
  /** Embedder configuration (uses Ollama) */
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
 * @param a - First vector (Float32Array)
 * @param b - Second vector (Float32Array)
 * @returns Similarity score between -1 and 1 (1 = identical)
 *
 * @internal
 */
const cosineSimilarity = (a: Float32Array, b: Float32Array): number => {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// ============================================================================
// Ollama Embedder
// ============================================================================

const DEFAULT_MODEL = 'all-minilm'
const DEFAULT_BASE_URL = 'http://localhost:11434'

/**
 * Ollama embedding response.
 */
type OllamaEmbedResponse = {
  embeddings: number[][]
}

/**
 * Embedder instance with embed function and dimensions.
 */
type Embedder = {
  embed: (text: string) => Promise<Float32Array>
  dimensions: number
}

/**
 * Creates an embedder using Ollama's local embedding API.
 *
 * @remarks
 * Automatically starts Ollama server and pulls the model if needed.
 * Uses pure fetch() for HTTP calls - no additional dependencies.
 * Returns `undefined` if Ollama is not available.
 *
 * @internal
 */
const createOllamaEmbedder = async (config: EmbedderConfig = {}): Promise<Embedder | undefined> => {
  const { model = DEFAULT_MODEL, baseUrl = DEFAULT_BASE_URL, autoStart = true, autoPull = true } = config

  // Check if Ollama is installed
  const ollamaPath = Bun.which('ollama')
  if (!ollamaPath) {
    return undefined
  }

  try {
    // Check if server is running, start if needed
    if (autoStart) {
      const isRunning = await $`ollama list`
        .quiet()
        .then(() => true)
        .catch(() => false)
      if (!isRunning) {
        // Start Ollama server in background (fire and forget)
        Bun.spawn(['ollama', 'serve'], {
          stdout: 'ignore',
          stderr: 'ignore',
        })
        // Wait for server to start
        await Bun.sleep(2000)
      }
    }

    // Pull model if needed
    if (autoPull) {
      await $`ollama pull ${model}`.quiet()
    }

    const embedUrl = `${baseUrl}/api/embed`

    const embed = async (text: string): Promise<Float32Array> => {
      const response = await fetch(embedUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: text }),
      })

      if (!response.ok) {
        throw new Error(`Ollama embed failed: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as OllamaEmbedResponse
      return new Float32Array(data.embeddings[0]!)
    }

    // Get dimensions from a test embedding
    const testEmbedding = await embed('test')

    return { embed, dimensions: testEmbedding.length }
  } catch {
    return undefined
  }
}

// ============================================================================
// Semantic Cache Implementation
// ============================================================================

/**
 * Creates a semantic cache for LLM responses.
 *
 * @param config - Cache configuration options
 * @returns Promise resolving to a semantic cache instance, or `undefined` if Ollama unavailable
 *
 * @remarks
 * Uses SQLite for metadata persistence and in-memory Map for vector storage.
 * Vector similarity is computed using pure JavaScript cosine similarity.
 *
 * **Requirements:** Ollama must be installed for semantic caching to work.
 * If Ollama is not available, returns `undefined` instead of throwing.
 *
 * **Performance:** Linear search with ~3.5ms for 10K vectors (384 dimensions).
 * For caches with <10K entries, this is negligible compared to embedding
 * generation time (~50-150ms via Ollama).
 */
export const createSemanticCache = async (config: SemanticCacheConfig = {}): Promise<SemanticCache | undefined> => {
  const {
    dbPath = ':memory:',
    embedder: embedderConfig,
    similarityThreshold = 0.85,
    maxEntries = 1000,
    ttlMs = 24 * 60 * 60 * 1000,
  } = config

  // Initialize embedder - returns undefined if Ollama unavailable
  const embedder = await createOllamaEmbedder(embedderConfig)
  if (!embedder) {
    return undefined
  }

  const db = new Database(dbPath)

  // In-memory vector storage: id -> embedding
  const embeddings = new Map<number, Float32Array>()

  // Create main cache entries table
  db.run(`
    CREATE TABLE IF NOT EXISTS cache_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      response TEXT NOT NULL,
      cached_at INTEGER NOT NULL,
      hit_count INTEGER DEFAULT 0
    )
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_cached_at ON cache_entries(cached_at)`)

  // Statistics
  let totalHits = 0
  let totalMisses = 0
  let totalSimilarity = 0

  // Prepared statements
  const insertEntryStmt = db.prepare(`
    INSERT INTO cache_entries (query, response, cached_at, hit_count)
    VALUES ($query, $response, $cachedAt, 0)
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

  const getOldestIdsStmt = db.prepare<{ id: number }, { $count: number }>(`
    SELECT id FROM cache_entries ORDER BY cached_at ASC LIMIT $count
  `)

  const deleteExpiredStmt = db.prepare<{ id: number }, { $expiredBefore: number }>(`
    SELECT id FROM cache_entries WHERE cached_at < $expiredBefore
  `)

  const deleteByIdsStmt = db.prepare(`DELETE FROM cache_entries WHERE cached_at < $expiredBefore`)

  const countStmt = db.prepare<{ count: number }, []>(`SELECT COUNT(*) as count FROM cache_entries`)

  /**
   * Finds the most similar embedding using linear search.
   *
   * @internal
   */
  const findMostSimilar = (queryEmbedding: Float32Array): { id: number; similarity: number } | undefined => {
    let bestId: number | undefined
    let bestSimilarity = -Infinity

    for (const [id, embedding] of embeddings) {
      const similarity = cosineSimilarity(queryEmbedding, embedding)
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity
        bestId = id
      }
    }

    if (bestId !== undefined && bestSimilarity >= similarityThreshold) {
      return { id: bestId, similarity: bestSimilarity }
    }

    return undefined
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
        const entry = getByIdStmt.get({ $id: match.id })
        const now = Date.now()

        // Check TTL
        if (entry && now - entry.cachedAt < ttlMs) {
          incrementHitStmt.run({ $id: match.id })
          totalHits++
          totalSimilarity += match.similarity

          return {
            hit: true,
            entry: {
              query: entry.query,
              response: entry.response,
              cachedAt: entry.cachedAt,
              hitCount: entry.hitCount + 1,
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
      const { count } = countStmt.get()!
      if (count >= maxEntries) {
        const toDelete = count - maxEntries + 1
        // Get IDs to delete from memory
        const oldestIds = getOldestIdsStmt.all({ $count: toDelete })
        for (const { id } of oldestIds) {
          embeddings.delete(id)
        }
        deleteOldestStmt.run({ $count: toDelete })
      }

      // Insert new entry
      insertEntryStmt.run({
        $query: query,
        $response: response,
        $cachedAt: Date.now(),
      })

      // Get the inserted row ID
      const lastId = db.query<{ id: number }, []>(`SELECT last_insert_rowid() as id`).get()!.id

      // Store embedding in memory
      embeddings.set(lastId, embedding)
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
      embeddings.clear()
      db.run(`DELETE FROM cache_entries`)
      totalHits = 0
      totalMisses = 0
      totalSimilarity = 0
    },

    clearExpired(): number {
      const expiredBefore = Date.now() - ttlMs
      const expiredIds = deleteExpiredStmt.all({ $expiredBefore: expiredBefore })

      // Remove from memory
      for (const { id } of expiredIds) {
        embeddings.delete(id)
      }

      // Remove from database
      deleteByIdsStmt.run({ $expiredBefore: expiredBefore })

      return expiredIds.length
    },

    close(): void {
      embeddings.clear()
      db.close()
    },
  }

  return cache
}
