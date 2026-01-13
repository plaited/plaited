/**
 * Progressive Tool Discovery with FTS5 + optional Ollama vector search.
 *
 * @remarks
 * Provides context-aware tool filtering to reduce token costs by exposing
 * only relevant tools for a given intent.
 *
 * **Capabilities:**
 * - FTS5 full-text search for keyword matching (default, zero dependencies)
 * - Optional vector search via Ollama embeddings with pure JS cosine similarity
 * - Reciprocal Rank Fusion (RRF) for hybrid scoring
 *
 * **Configuration:**
 * - Default: FTS5 only (zero config, works everywhere)
 * - Opt-in: Set `embedder: true` for hybrid search with Ollama
 *
 * **Requirements for vector search:**
 * - Ollama installed from https://ollama.com
 * - Default model: all-minilm (22MB, 384 dimensions)
 *
 * **Graceful Degradation:**
 * - If Ollama not available, falls back to FTS5-only search
 *
 * @module
 */

import { Database } from 'bun:sqlite'
import { $ } from 'bun'
import type { EmbedderConfig, ToolSchema, ToolSource } from './agent.types.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for tool discovery.
 */
export type ToolDiscoveryConfig = {
  /** Path to SQLite database (default: ':memory:') */
  dbPath?: string
  /**
   * Embedder configuration for vector search.
   * - `undefined` or `false` - FTS5 only (default)
   * - `true` - Hybrid with default Ollama model (all-minilm)
   * - `EmbedderConfig` - Hybrid with custom Ollama model
   */
  embedder?: boolean | EmbedderConfig
}

/**
 * Indexed tool with source metadata.
 */
export type IndexedTool = {
  name: string
  description: string
  keywords: string[]
  source: ToolSource
  sourceUrl?: string
  schema: ToolSchema
}

/**
 * Tool match result with relevance score.
 */
export type ToolMatch = {
  tool: IndexedTool
  /** Combined relevance score (0-1) */
  score: number
  /** FTS5 rank if matched via keywords */
  ftsRank?: number
  /** Vector similarity if matched via embedding (0-1, higher is more similar) */
  vectorSimilarity?: number
}

/**
 * Search options for tool discovery.
 */
export type SearchOptions = {
  /** Maximum results to return (default: 5) */
  limit?: number
  /** Minimum score threshold (default: 0.001) */
  minScore?: number
  /** Filter by source */
  source?: ToolSource
  /** Weight for FTS5 score in hybrid search (default: 0.5) */
  ftsWeight?: number
  /** Weight for vector score in hybrid search (default: 0.5) */
  vectorWeight?: number
}

/**
 * Statistics about indexed tools.
 */
export type ToolDiscoveryStats = {
  totalTools: number
  localTools: number
  mcpTools: number
  a2aTools: number
  vectorSearchEnabled: boolean
}

/**
 * Tool discovery registry interface.
 */
export type ToolDiscovery = {
  index: (tool: IndexedTool) => Promise<void>
  indexBatch: (tools: IndexedTool[]) => Promise<void>
  search: (intent: string, options?: SearchOptions) => Promise<ToolMatch[]>
  all: () => IndexedTool[]
  bySource: (source: ToolSource) => IndexedTool[]
  remove: (name: string) => void
  clearSource: (source: ToolSource) => void
  stats: () => ToolDiscoveryStats
  /** Closes the discovery registry */
  close: () => void
}

// ============================================================================
// Pure JS Vector Search
// ============================================================================

/**
 * Computes cosine similarity between two vectors.
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

/**
 * Finds top-k most similar vectors using linear search.
 *
 * @internal
 */
const findTopSimilar = (
  query: Float32Array,
  embeddings: Map<number, Float32Array>,
  limit: number,
): Array<{ rowid: number; similarity: number }> => {
  const results: Array<{ rowid: number; similarity: number }> = []

  for (const [rowid, embedding] of embeddings) {
    const similarity = cosineSimilarity(query, embedding)
    results.push({ rowid, similarity })
  }

  // Sort by similarity descending and take top k
  return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit)
}

// ============================================================================
// Ollama Embedder
// ============================================================================

const DEFAULT_MODEL = 'all-minilm'
const DEFAULT_BASE_URL = 'http://localhost:11434'

type EmbedderFn = (text: string) => Promise<Float32Array>

/**
 * Ollama embedding response.
 */
type OllamaEmbedResponse = {
  embeddings: number[][]
}

/**
 * Embedder with cleanup support.
 */
type Embedder = {
  embed: EmbedderFn
  dimensions: number
}

/**
 * Resolves embedder config from boolean or object.
 *
 * @internal
 */
const resolveEmbedderConfig = (config: boolean | EmbedderConfig): EmbedderConfig | undefined => {
  if (config === false) return undefined
  if (config === true) return {}
  return config
}

/**
 * Creates an embedder using Ollama's local embedding API.
 *
 * @remarks
 * Automatically starts Ollama server and pulls the model if needed.
 * Uses pure fetch() for HTTP calls - no additional dependencies.
 *
 * @internal
 */
const createOllamaEmbedder = async (config: EmbedderConfig): Promise<Embedder | undefined> => {
  const { model = DEFAULT_MODEL, baseUrl = DEFAULT_BASE_URL, autoStart = true, autoPull = true } = config

  // Check if Ollama is installed
  const ollamaPath = Bun.which('ollama')
  if (!ollamaPath) {
    // Gracefully disable vector search if Ollama not installed
    console.warn('Ollama not installed. Vector search disabled, using FTS5 only.')
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
  } catch (error) {
    // Gracefully disable vector search on any error
    console.warn('Failed to initialize Ollama embedder. Vector search disabled, using FTS5 only.', error)
    return undefined
  }
}

// ============================================================================
// Database Setup
// ============================================================================

/**
 * Creates the database schema for tool discovery.
 *
 * @internal
 */
const createSchema = (db: Database) => {
  // Main tools table
  db.run(`
    CREATE TABLE IF NOT EXISTS tools (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      keywords TEXT NOT NULL,
      source TEXT NOT NULL,
      source_url TEXT,
      schema_json TEXT NOT NULL
    )
  `)

  // FTS5 table for keyword search
  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS tools_fts USING fts5(
      name,
      description,
      keywords
    )
  `)
}

// ============================================================================
// Tool Discovery Implementation
// ============================================================================

/**
 * Creates a tool discovery registry with FTS5 + optional Ollama vector search.
 *
 * @param config - Discovery configuration options
 * @returns Promise resolving to tool discovery registry
 *
 * @remarks
 * By default, uses FTS5 only (zero external dependencies).
 * Set `embedder: true` for hybrid search with Ollama's default model
 * (`all-minilm` - 22MB, 384 dims).
 *
 * Vector search uses in-memory storage with pure JavaScript cosine similarity,
 * making it cross-platform compatible (macOS, Linux, Windows).
 *
 * If Ollama is not installed or fails to start, gracefully falls back
 * to FTS5-only search.
 */
export const createToolDiscovery = async (config: ToolDiscoveryConfig = {}): Promise<ToolDiscovery> => {
  const { dbPath = ':memory:', embedder: embedderInput } = config

  // Resolve embedder config
  const embedderConfig = embedderInput ? resolveEmbedderConfig(embedderInput) : undefined

  const db = new Database(dbPath)

  // Initialize embedder if configured (may return undefined if Ollama unavailable)
  const embedder = embedderConfig ? await createOllamaEmbedder(embedderConfig) : undefined
  const enableVectorSearch = embedder !== undefined

  // Create schema
  createSchema(db)

  // In-memory cache for fast access
  const toolCache = new Map<string, IndexedTool>()

  // In-memory embeddings storage (rowid → embedding)
  const embeddings = new Map<number, Float32Array>()

  // Prepared statements
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO tools (name, description, keywords, source, source_url, schema_json)
    VALUES ($name, $description, $keywords, $source, $sourceUrl, $schemaJson)
  `)

  const insertFtsStmt = db.prepare(`
    INSERT INTO tools_fts (name, description, keywords)
    VALUES ($name, $description, $keywords)
  `)

  const deleteFtsStmt = db.prepare(`
    DELETE FROM tools_fts WHERE name = $name
  `)

  const ftsSearchStmt = db.prepare(`
    SELECT name, rank FROM tools_fts
    WHERE tools_fts MATCH $query
    ORDER BY rank
    LIMIT $limit
  `)

  const deleteStmt = db.prepare(`DELETE FROM tools WHERE name = $name`)
  const deleteBySourceStmt = db.prepare(`DELETE FROM tools WHERE source = $source`)

  const getRowidByNameStmt = db.prepare<{ rowid: number }, { $name: string }>(`
    SELECT rowid FROM tools WHERE name = $name
  `)

  // Get tool name by rowid
  const getNameByRowidStmt = db.prepare<{ name: string }, { $rowid: number }>(`
    SELECT name FROM tools WHERE rowid = $rowid
  `)

  const discovery: ToolDiscovery = {
    async index(tool: IndexedTool): Promise<void> {
      const keywordsStr = tool.keywords.join(' ')

      // Delete existing entries if replacing
      if (toolCache.has(tool.name)) {
        const existing = getRowidByNameStmt.get({ $name: tool.name })
        if (existing) {
          embeddings.delete(existing.rowid)
        }
        deleteFtsStmt.run({ $name: tool.name })
      }

      insertStmt.run({
        $name: tool.name,
        $description: tool.description,
        $keywords: keywordsStr,
        $source: tool.source,
        $sourceUrl: tool.sourceUrl ?? null,
        $schemaJson: JSON.stringify(tool.schema),
      })

      // Get the rowid of the inserted/replaced row
      const row = getRowidByNameStmt.get({ $name: tool.name })
      const rowid = row!.rowid

      insertFtsStmt.run({
        $name: tool.name,
        $description: tool.description,
        $keywords: keywordsStr,
      })

      // Compute and store embedding if enabled
      if (enableVectorSearch && embedder) {
        const embedding = await embedder.embed(`${tool.name} ${tool.description}`)
        embeddings.set(rowid, embedding)
      }

      toolCache.set(tool.name, tool)
    },

    async indexBatch(tools: IndexedTool[]): Promise<void> {
      // Compute embeddings first if enabled (async operations outside transaction)
      const toolEmbeddings = new Map<string, Float32Array>()
      if (enableVectorSearch && embedder) {
        for (const tool of tools) {
          const embedding = await embedder.embed(`${tool.name} ${tool.description}`)
          toolEmbeddings.set(tool.name, embedding)
        }
      }

      const transaction = db.transaction(() => {
        for (const tool of tools) {
          const keywordsStr = tool.keywords.join(' ')

          if (toolCache.has(tool.name)) {
            const existing = getRowidByNameStmt.get({ $name: tool.name })
            if (existing) {
              embeddings.delete(existing.rowid)
            }
            deleteFtsStmt.run({ $name: tool.name })
          }

          insertStmt.run({
            $name: tool.name,
            $description: tool.description,
            $keywords: keywordsStr,
            $source: tool.source,
            $sourceUrl: tool.sourceUrl ?? null,
            $schemaJson: JSON.stringify(tool.schema),
          })

          // Get the rowid
          const row = getRowidByNameStmt.get({ $name: tool.name })
          const rowid = row!.rowid

          insertFtsStmt.run({
            $name: tool.name,
            $description: tool.description,
            $keywords: keywordsStr,
          })

          // Store embedding if available
          const embedding = toolEmbeddings.get(tool.name)
          if (embedding) {
            embeddings.set(rowid, embedding)
          }

          toolCache.set(tool.name, tool)
        }
      })

      transaction()
    },

    async search(intent: string, options: SearchOptions = {}): Promise<ToolMatch[]> {
      const { limit = 5, minScore = 0.001, source, ftsWeight = 0.5, vectorWeight = 0.5 } = options

      const ftsResults = new Map<string, number>()
      const vecResults = new Map<string, number>()

      // FTS5 search
      const ftsQuery = sanitizeFtsQuery(intent)
      if (ftsQuery) {
        const ftsMatches = ftsSearchStmt.all({
          $query: ftsQuery,
          $limit: limit * 2,
        }) as Array<{ name: string; rank: number }>

        for (const match of ftsMatches) {
          const normalizedRank = 1 / (1 + Math.abs(match.rank))
          ftsResults.set(match.name, normalizedRank)
        }
      }

      // Vector search using pure JS cosine similarity (if enabled)
      if (enableVectorSearch && embedder && embeddings.size > 0) {
        const queryVec = await embedder.embed(intent)

        const topMatches = findTopSimilar(queryVec, embeddings, limit * 2)

        for (const match of topMatches) {
          const nameResult = getNameByRowidStmt.get({ $rowid: match.rowid })
          if (nameResult) {
            vecResults.set(nameResult.name, match.similarity)
          }
        }
      }

      // Reciprocal Rank Fusion
      const combinedScores = new Map<string, ToolMatch>()
      const k = 60

      // Process FTS results
      let ftsRank = 1
      for (const [name, score] of [...ftsResults.entries()].sort((a, b) => b[1] - a[1])) {
        const tool = toolCache.get(name)
        if (!tool) continue
        if (source && tool.source !== source) continue

        const rrfScore = ftsWeight / (k + ftsRank)
        ftsRank++

        combinedScores.set(name, {
          tool,
          score: rrfScore,
          ftsRank: score,
        })
      }

      // Process vector results
      let vecRank = 1
      for (const [name, similarity] of [...vecResults.entries()].sort((a, b) => b[1] - a[1])) {
        const tool = toolCache.get(name)
        if (!tool) continue
        if (source && tool.source !== source) continue

        const rrfScore = vectorWeight / (k + vecRank)
        vecRank++

        const existing = combinedScores.get(name)
        if (existing) {
          existing.score += rrfScore
          existing.vectorSimilarity = similarity
        } else {
          combinedScores.set(name, {
            tool,
            score: rrfScore,
            vectorSimilarity: similarity,
          })
        }
      }

      return [...combinedScores.values()]
        .filter((m) => m.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
    },

    all(): IndexedTool[] {
      return [...toolCache.values()]
    },

    bySource(source: ToolSource): IndexedTool[] {
      return [...toolCache.values()].filter((t) => t.source === source)
    },

    remove(name: string): void {
      // Delete from in-memory embeddings
      const existing = getRowidByNameStmt.get({ $name: name })
      if (existing) {
        embeddings.delete(existing.rowid)
      }
      deleteFtsStmt.run({ $name: name })
      deleteStmt.run({ $name: name })
      toolCache.delete(name)
    },

    clearSource(source: ToolSource): void {
      const tools = discovery.bySource(source)
      for (const tool of tools) {
        // Delete from in-memory embeddings
        const existing = getRowidByNameStmt.get({ $name: tool.name })
        if (existing) {
          embeddings.delete(existing.rowid)
        }
        deleteFtsStmt.run({ $name: tool.name })
        toolCache.delete(tool.name)
      }
      deleteBySourceStmt.run({ $source: source })
    },

    stats(): ToolDiscoveryStats {
      return {
        totalTools: toolCache.size,
        localTools: discovery.bySource('local').length,
        mcpTools: discovery.bySource('mcp').length,
        a2aTools: discovery.bySource('a2a').length,
        vectorSearchEnabled: enableVectorSearch,
      }
    },

    close(): void {
      // Clear in-memory embeddings
      embeddings.clear()
      db.close()
    },
  }

  return discovery
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extracts keywords from a tool schema.
 */
export const extractKeywords = (schema: ToolSchema): string[] => {
  const keywords: string[] = []

  // Add tool name parts (camelCase → words)
  keywords.push(...schema.name.split(/(?=[A-Z])/).map((w) => w.toLowerCase()))

  // Add words from description
  const descWords = schema.description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2)

  keywords.push(...descWords)

  // Add parameter names
  for (const paramName of Object.keys(schema.parameters.properties)) {
    keywords.push(paramName.toLowerCase())
  }

  return [...new Set(keywords)]
}

/**
 * Converts a ToolSchema to an IndexedTool.
 */
export const schemaToIndexedTool = (
  schema: ToolSchema,
  source: ToolSource = 'local',
  sourceUrl?: string,
): IndexedTool => ({
  name: schema.name,
  description: schema.description,
  keywords: extractKeywords(schema),
  source,
  sourceUrl,
  schema,
})

/**
 * Sanitizes a query for FTS5.
 *
 * @internal
 */
const sanitizeFtsQuery = (query: string): string =>
  query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .map((w) => `${w}*`)
    .join(' OR ')

/**
 * Filters tool schemas based on intent using discovery.
 *
 * @param discovery - Tool discovery registry
 * @param intent - User intent
 * @param allSchemas - All available tool schemas
 * @param options - Search options
 * @returns Filtered tool schemas relevant to the intent
 *
 * @remarks
 * Main entry point for progressive tool discovery.
 * Returns only tools relevant to the current intent,
 * reducing token costs for model context.
 */
export const filterToolsByIntent = async (
  discovery: ToolDiscovery,
  intent: string,
  allSchemas: ToolSchema[],
  options?: SearchOptions,
): Promise<ToolSchema[]> => {
  const matches = await discovery.search(intent, options)

  if (matches.length === 0) {
    // Fallback: return discovery/general tools
    return allSchemas.filter((s) => s.name.includes('list') || s.name.includes('search') || s.name.includes('discover'))
  }

  return matches.map((m) => m.tool.schema)
}
