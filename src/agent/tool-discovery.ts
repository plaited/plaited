/**
 * Progressive Tool Discovery.
 * Uses FTS5 + sqlite-vec for hybrid keyword/semantic search.
 *
 * @remarks
 * This module provides context-aware tool filtering to reduce token costs
 * by only exposing relevant tools for a given intent. It supports:
 * - FTS5 full-text search for keyword matching
 * - sqlite-vec for semantic similarity (optional)
 * - Dynamic registration of MCP servers and A2A agents
 * - Reciprocal Rank Fusion for hybrid scoring
 */

import { Database } from 'bun:sqlite'
import type { ToolSchema } from './agent.types.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for tool discovery.
 */
export type ToolDiscoveryConfig = {
  /** Path to SQLite database (default: ':memory:') */
  dbPath?: string
  /** Enable vector search with sqlite-vec (default: false) */
  enableVectorSearch?: boolean
  /** Embedding function for vector search */
  embedder?: (text: string) => Promise<Float32Array>
  /** Vector dimensions (default: 384 for MiniLM) */
  vectorDimensions?: number
}

/**
 * Tool source types for tracking provenance.
 */
export type ToolSource = 'local' | 'mcp' | 'a2a'

/**
 * Indexed tool with source metadata.
 */
export type IndexedTool = {
  /** Tool name */
  name: string
  /** Tool description */
  description: string
  /** Keywords for search (auto-extracted or provided) */
  keywords: string[]
  /** Source of the tool */
  source: ToolSource
  /** Source URL for remote tools */
  sourceUrl?: string
  /** Original schema */
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
 * Tool discovery registry.
 */
export type ToolDiscovery = {
  /** Index a tool for discovery */
  index: (tool: IndexedTool) => Promise<void>
  /** Index multiple tools */
  indexBatch: (tools: IndexedTool[]) => Promise<void>
  /** Search for relevant tools */
  search: (intent: string, options?: SearchOptions) => Promise<ToolMatch[]>
  /** Get all indexed tools */
  all: () => IndexedTool[]
  /** Get tools by source */
  bySource: (source: ToolSource) => IndexedTool[]
  /** Remove a tool */
  remove: (name: string) => void
  /** Clear all tools from a source */
  clearSource: (source: ToolSource) => void
  /** Get statistics */
  stats: () => ToolDiscoveryStats
  /** Close database connection */
  close: () => void
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

// ============================================================================
// Database Setup
// ============================================================================

/**
 * Configures SQLite for extension loading on macOS.
 * macOS system SQLite doesn't allow loading extensions.
 *
 * @internal
 * @remarks
 * Requires: `brew install sqlite3` on macOS
 */
const configureSqliteForPlatform = () => {
  if (process.platform === 'darwin') {
    Database.setCustomSQLite('/usr/local/opt/sqlite3/lib/libsqlite3.dylib')
  }
}

/**
 * Creates the database schema for tool discovery.
 *
 * @internal
 */
const createSchema = (db: Database, enableVector: boolean, dimensions: number) => {
  // Main tools table (must be created first for FTS5 content sync)
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

  // FTS5 table for keyword search (standalone, no content sync for simplicity)
  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS tools_fts USING fts5(
      name,
      description,
      keywords
    )
  `)

  // Vector table (optional)
  if (enableVector) {
    db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS tools_vec USING vec0(
        embedding float[${dimensions}]
      )
    `)
  }
}

// ============================================================================
// Tool Discovery Implementation
// ============================================================================

/**
 * Creates a tool discovery registry with FTS5 + sqlite-vec hybrid search.
 *
 * @param config - Discovery configuration
 * @returns Tool discovery registry
 *
 * @remarks
 * The registry provides:
 * - `index` - Add a tool to the search index
 * - `search` - Find tools matching an intent
 * - `bySource` - Filter tools by source (local, mcp, a2a)
 *
 * For vector search, provide an `embedder` function that converts
 * text to embeddings (e.g., using HuggingFace inference).
 *
 * See `src/agent/tests/tool-discovery.spec.ts` for usage patterns.
 */
export const createToolDiscovery = (config: ToolDiscoveryConfig = {}): ToolDiscovery => {
  const { dbPath = ':memory:', enableVectorSearch = false, embedder, vectorDimensions = 384 } = config

  // Configure platform-specific SQLite
  if (enableVectorSearch) {
    configureSqliteForPlatform()
  }

  const db = new Database(dbPath)

  // Load sqlite-vec if vector search enabled
  if (enableVectorSearch) {
    // Dynamic import to avoid requiring sqlite-vec when not used
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqliteVec = require('sqlite-vec')
    sqliteVec.load(db)
  }

  // Create schema
  createSchema(db, enableVectorSearch, vectorDimensions)

  // In-memory cache for fast access
  const toolCache = new Map<string, IndexedTool>()

  // Prepared statements for performance
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

  return {
    async index(tool: IndexedTool): Promise<void> {
      const keywordsStr = tool.keywords.join(' ')

      // Delete existing FTS entry if replacing
      if (toolCache.has(tool.name)) {
        deleteFtsStmt.run({ $name: tool.name })
      }

      // Note: SQLite requires null (not undefined) for SQL NULL values
      insertStmt.run({
        $name: tool.name,
        $description: tool.description,
        $keywords: keywordsStr,
        $source: tool.source,
        $sourceUrl: tool.sourceUrl ?? null,
        $schemaJson: JSON.stringify(tool.schema),
      })

      // Insert into FTS index
      insertFtsStmt.run({
        $name: tool.name,
        $description: tool.description,
        $keywords: keywordsStr,
      })

      // Cache for fast lookup
      toolCache.set(tool.name, tool)

      // Index vector if enabled
      if (enableVectorSearch && embedder) {
        const embedding = await embedder(`${tool.name} ${tool.description}`)
        const rowid = db.query<{ rowid: number }, []>(`SELECT rowid FROM tools WHERE name = '${tool.name}'`).get()

        if (rowid) {
          db.run(`INSERT INTO tools_vec (rowid, embedding) VALUES (?, ?)`, [rowid.rowid, embedding])
        }
      }
    },

    async indexBatch(tools: IndexedTool[]): Promise<void> {
      const transaction = db.transaction(() => {
        for (const tool of tools) {
          const keywordsStr = tool.keywords.join(' ')

          // Delete existing FTS entry if replacing
          if (toolCache.has(tool.name)) {
            deleteFtsStmt.run({ $name: tool.name })
          }

          // Note: SQLite requires null (not undefined) for SQL NULL values
          insertStmt.run({
            $name: tool.name,
            $description: tool.description,
            $keywords: keywordsStr,
            $source: tool.source,
            $sourceUrl: tool.sourceUrl ?? null,
            $schemaJson: JSON.stringify(tool.schema),
          })

          // Insert into FTS index
          insertFtsStmt.run({
            $name: tool.name,
            $description: tool.description,
            $keywords: keywordsStr,
          })

          toolCache.set(tool.name, tool)
        }
      })

      transaction()

      // Index vectors separately (async)
      if (enableVectorSearch && embedder) {
        for (const tool of tools) {
          const embedding = await embedder(`${tool.name} ${tool.description}`)
          const rowid = db.query<{ rowid: number }, []>(`SELECT rowid FROM tools WHERE name = '${tool.name}'`).get()

          if (rowid) {
            db.run(`INSERT INTO tools_vec (rowid, embedding) VALUES (?, ?)`, [rowid.rowid, embedding])
          }
        }
      }
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
          $limit: limit * 2, // Get more for reranking
        }) as Array<{ name: string; rank: number }>

        for (const match of ftsMatches) {
          // FTS5 rank is negative (more negative = better match)
          // Normalize to 0-1 where 1 is best
          const normalizedRank = 1 / (1 + Math.abs(match.rank))
          ftsResults.set(match.name, normalizedRank)
        }
      }

      // Vector search (if enabled)
      if (enableVectorSearch && embedder) {
        const queryVec = await embedder(intent)
        const vecMatches = db
          .query<{ rowid: number; distance: number }, [Float32Array, number]>(`
          SELECT rowid, distance FROM tools_vec
          WHERE embedding MATCH ?
          ORDER BY distance
          LIMIT ?
        `)
          .all(queryVec, limit * 2)

        for (const match of vecMatches) {
          const tool = db.query<{ name: string }, [number]>(`SELECT name FROM tools WHERE rowid = ?`).get(match.rowid)

          if (tool) {
            // Distance is 0-2 for cosine (0 = identical)
            // Normalize to 0-1 where 1 is best
            const normalizedDistance = 1 - match.distance / 2
            vecResults.set(tool.name, normalizedDistance)
          }
        }
      }

      // Reciprocal Rank Fusion
      const combinedScores = new Map<string, ToolMatch>()
      const k = 60 // RRF constant

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

      // Sort by combined score and filter
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
    },

    clearSource(source: ToolSource): void {
      const tools = this.bySource(source)
      for (const tool of tools) {
        deleteFtsStmt.run({ $name: tool.name })
        toolCache.delete(tool.name)
      }
      deleteBySourceStmt.run({ $source: source })
    },

    stats(): ToolDiscoveryStats {
      return {
        totalTools: toolCache.size,
        localTools: this.bySource('local').length,
        mcpTools: this.bySource('mcp').length,
        a2aTools: this.bySource('a2a').length,
        vectorSearchEnabled: enableVectorSearch,
      }
    },

    close(): void {
      db.close()
    },
  }
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
 * Removes special characters that could break the query.
 *
 * @internal
 */
const sanitizeFtsQuery = (query: string): string => {
  // Remove FTS5 special characters and wrap words with *
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .map((w) => `${w}*`) // Prefix matching
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
 * This is the main entry point for progressive tool discovery.
 * It returns only the tools relevant to the current intent,
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
