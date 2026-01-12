/**
 * Progressive Tool Discovery with FTS5 + optional vector search.
 *
 * @remarks
 * Provides context-aware tool filtering to reduce token costs by exposing
 * only relevant tools for a given intent. Supports:
 * - FTS5 full-text search for keyword matching (default, zero dependencies)
 * - Optional vector search via Transformers.js embeddings with pure JS cosine similarity
 * - Reciprocal Rank Fusion for hybrid scoring
 *
 * Default: FTS5 only (zero config, works everywhere)
 * Opt-in: Set `embedder: true` for hybrid search with `Xenova/multilingual-e5-small`
 *
 * Note: Uses pure JavaScript cosine similarity instead of sqlite-vec since Bun's
 * built-in SQLite doesn't support dynamic extension loading.
 */

import { Database } from 'bun:sqlite'
import type { EmbedderConfig, ToolSchema, ToolSource } from './agent.types.ts'

// ============================================================================
// Vector Math Utilities
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
   * - `true` - Hybrid with default model (Xenova/multilingual-e5-small)
   * - `EmbedderConfig` - Hybrid with custom model
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
  /** Vector distance if matched via embedding */
  vectorDistance?: number
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
  close: () => void
}

// ============================================================================
// Embedder Factory
// ============================================================================

type EmbedderFn = (text: string) => Promise<Float32Array>

const DEFAULT_MODEL = 'Xenova/multilingual-e5-small'

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
 * Creates an embedder function using Transformers.js.
 *
 * @remarks
 * Dynamically imports @huggingface/transformers to avoid requiring
 * it when vector search is disabled. Models are cached locally
 * after first download.
 *
 * @internal
 */
const createEmbedder = async (config: EmbedderConfig): Promise<EmbedderFn> => {
  const { model = DEFAULT_MODEL, dtype = 'q8', device = 'auto' } = config

  // Dynamic import to avoid dependency when not using vector search
  const { pipeline } = await import('@huggingface/transformers')

  const extractor = await pipeline('feature-extraction', model, {
    dtype,
    device,
  })

  // E5 models require query/passage prefix for best results
  const isE5Model = model.toLowerCase().includes('e5')

  return async (text: string): Promise<Float32Array> => {
    const input = isE5Model ? `query: ${text}` : text
    const output = await extractor(input, { pooling: 'mean', normalize: true })
    return new Float32Array(output.data as ArrayLike<number>)
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
const createSchema = (db: Database, _enableVector: boolean) => {
  // Main tools table (with optional embedding stored as JSON)
  db.run(`
    CREATE TABLE IF NOT EXISTS tools (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      keywords TEXT NOT NULL,
      source TEXT NOT NULL,
      source_url TEXT,
      schema_json TEXT NOT NULL,
      embedding_json TEXT
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
 * Creates a tool discovery registry with FTS5 + optional vector search.
 *
 * @param config - Discovery configuration
 * @returns Tool discovery registry
 *
 * @remarks
 * By default, uses FTS5 only (zero external dependencies).
 * Set `embedder: true` for hybrid search with the default model
 * (`Xenova/multilingual-e5-small` - 118MB, 100 languages, 384 dims).
 *
 * See `src/agent-next/tests/tool-discovery.spec.ts` for usage patterns.
 */
export const createToolDiscovery = async (config: ToolDiscoveryConfig = {}): Promise<ToolDiscovery> => {
  const { dbPath = ':memory:', embedder: embedderInput } = config

  // Resolve embedder config
  const embedderConfig = embedderInput ? resolveEmbedderConfig(embedderInput) : undefined
  const enableVectorSearch = embedderConfig !== undefined

  const db = new Database(dbPath)

  // Create schema
  createSchema(db, enableVectorSearch)

  // Initialize embedder if configured
  const embedder = embedderConfig ? await createEmbedder(embedderConfig) : undefined

  // In-memory cache for fast access
  const toolCache = new Map<string, IndexedTool>()

  // Prepared statements
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO tools (name, description, keywords, source, source_url, schema_json, embedding_json)
    VALUES ($name, $description, $keywords, $source, $sourceUrl, $schemaJson, $embeddingJson)
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

  // In-memory vector index (pure JS approach since Bun's SQLite doesn't support loadExtension)
  const vectorIndex = new Map<string, Float32Array>()

  const discovery: ToolDiscovery = {
    async index(tool: IndexedTool): Promise<void> {
      const keywordsStr = tool.keywords.join(' ')

      // Delete existing FTS entry if replacing
      if (toolCache.has(tool.name)) {
        deleteFtsStmt.run({ $name: tool.name })
      }

      // Compute embedding if enabled
      let embeddingJson: string | null = null
      if (enableVectorSearch && embedder) {
        const embedding = await embedder(`${tool.name} ${tool.description}`)
        embeddingJson = JSON.stringify(Array.from(embedding))
        vectorIndex.set(tool.name, embedding)
      }

      insertStmt.run({
        $name: tool.name,
        $description: tool.description,
        $keywords: keywordsStr,
        $source: tool.source,
        $sourceUrl: tool.sourceUrl ?? null,
        $schemaJson: JSON.stringify(tool.schema),
        $embeddingJson: embeddingJson,
      })

      insertFtsStmt.run({
        $name: tool.name,
        $description: tool.description,
        $keywords: keywordsStr,
      })

      toolCache.set(tool.name, tool)
    },

    async indexBatch(tools: IndexedTool[]): Promise<void> {
      // Compute embeddings first if enabled (async operations outside transaction)
      const embeddings = new Map<string, Float32Array>()
      if (enableVectorSearch && embedder) {
        for (const tool of tools) {
          const embedding = await embedder(`${tool.name} ${tool.description}`)
          embeddings.set(tool.name, embedding)
          vectorIndex.set(tool.name, embedding)
        }
      }

      const transaction = db.transaction(() => {
        for (const tool of tools) {
          const keywordsStr = tool.keywords.join(' ')

          if (toolCache.has(tool.name)) {
            deleteFtsStmt.run({ $name: tool.name })
          }

          const embedding = embeddings.get(tool.name)
          const embeddingJson = embedding ? JSON.stringify(Array.from(embedding)) : null

          insertStmt.run({
            $name: tool.name,
            $description: tool.description,
            $keywords: keywordsStr,
            $source: tool.source,
            $sourceUrl: tool.sourceUrl ?? null,
            $schemaJson: JSON.stringify(tool.schema),
            $embeddingJson: embeddingJson,
          })

          insertFtsStmt.run({
            $name: tool.name,
            $description: tool.description,
            $keywords: keywordsStr,
          })

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
      if (enableVectorSearch && embedder && vectorIndex.size > 0) {
        const queryVec = await embedder(intent)

        // Compute similarity scores for all indexed vectors
        const similarities: Array<{ name: string; similarity: number }> = []
        for (const [name, embedding] of vectorIndex) {
          const similarity = cosineSimilarity(queryVec, embedding)
          similarities.push({ name, similarity })
        }

        // Sort by similarity (descending) and take top results
        similarities.sort((a, b) => b.similarity - a.similarity)
        const topMatches = similarities.slice(0, limit * 2)

        for (const match of topMatches) {
          // Normalize similarity to 0-1 range (cosine similarity is already -1 to 1)
          const normalizedSimilarity = (match.similarity + 1) / 2
          vecResults.set(match.name, normalizedSimilarity)
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
      for (const [name, distance] of [...vecResults.entries()].sort((a, b) => b[1] - a[1])) {
        const tool = toolCache.get(name)
        if (!tool) continue
        if (source && tool.source !== source) continue

        const rrfScore = vectorWeight / (k + vecRank)
        vecRank++

        const existing = combinedScores.get(name)
        if (existing) {
          existing.score += rrfScore
          existing.vectorDistance = distance
        } else {
          combinedScores.set(name, {
            tool,
            score: rrfScore,
            vectorDistance: distance,
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
      deleteFtsStmt.run({ $name: name })
      deleteStmt.run({ $name: name })
      toolCache.delete(name)
      vectorIndex.delete(name)
    },

    clearSource(source: ToolSource): void {
      const tools = discovery.bySource(source)
      for (const tool of tools) {
        deleteFtsStmt.run({ $name: tool.name })
        toolCache.delete(tool.name)
        vectorIndex.delete(tool.name)
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
const sanitizeFtsQuery = (query: string): string => {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .map((w) => `${w}*`)
    .join(' OR ')
}

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
