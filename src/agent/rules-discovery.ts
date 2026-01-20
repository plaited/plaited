/**
 * Three-tier progressive loading for AGENTS.md rules and references.
 *
 * @remarks
 * Infrastructure module for managing agent context from AGENTS.md files.
 * Unlike tool-discovery and skill-discovery, this is NOT called directly
 * by the model - the orchestrator uses it to manage context.
 *
 * **Three Tiers:**
 * - **Tier 1 (Always)**: Root AGENTS.md loaded at startup
 * - **Tier 2 (Semantic)**: Markdown references indexed and loaded on intent match
 * - **Tier 3 (Spatial)**: Nested AGENTS.md loaded when file ops target that subtree
 *
 * **Capabilities:**
 * - Persistent SQLite cache with file mtime invalidation
 * - FTS5 full-text search on reference display text
 * - Optional vector search via node-llama-cpp for semantic matching
 * - Spatial locality detection for directory-scoped rules
 *
 * @module
 */

import { Database } from 'bun:sqlite'
import { dirname, join } from 'node:path'
import type { EmbedderConfig } from './agent.types.ts'
import { createEmbedder, type Embedder, findTopSimilar } from './embedder.ts'
import { extractMarkdownLinks } from './markdown-links.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * A markdown link reference extracted from AGENTS.md.
 *
 * @remarks
 * References are indexed by displayText for semantic search.
 * The absolutePath is resolved relative to the source AGENTS.md location.
 */
export type RuleReference = {
  /** Display text from `[text]` - used as semantic key */
  displayText: string
  /** Relative path from `(path)` */
  relativePath: string
  /** Resolved absolute path */
  absolutePath: string
  /** Source AGENTS.md that contains this link */
  source: string
  /** 1-indexed line number in source file */
  lineNumber: number
}

/**
 * Reference match result for semantic search.
 */
export type ReferenceMatch = {
  /** The matched reference */
  reference: RuleReference
  /** Vector similarity score (0-1) */
  similarity: number
}

/**
 * Configuration for rules discovery.
 */
export type RulesDiscoveryConfig = {
  /** Root directory to scan for AGENTS.md files (default: cwd) */
  rootDir?: string
  /** Path to SQLite database (default: ':memory:') */
  dbPath?: string
  /**
   * Embedder configuration for semantic search.
   * - `undefined` or `false` - FTS5 only (default)
   * - `true` - Hybrid with default model
   * - `EmbedderConfig` - Hybrid with custom model
   */
  embedder?: boolean | EmbedderConfig
}

/**
 * Statistics about indexed rules.
 */
export type RulesDiscoveryStats = {
  /** Number of AGENTS.md files indexed */
  totalRules: number
  /** Number of markdown references indexed */
  totalReferences: number
  /** Whether vector search is enabled */
  vectorSearchEnabled: boolean
}

/**
 * Rules discovery registry interface.
 */
export type RulesDiscovery = {
  /** Get root rules (Tier 1 - always loaded at startup) */
  getRootRules: () => string | undefined

  /** Search references by intent (Tier 2 - semantic match) */
  searchReferences: (intent: string, options?: { limit?: number }) => Promise<ReferenceMatch[]>

  /** Get reference content (load from disk) */
  getReferenceContent: (ref: RuleReference) => Promise<string | undefined>

  /** Get rules for a file path (Tier 3 - spatial locality) */
  getRulesForPath: (filePath: string) => string[]

  /** Get all references for a specific AGENTS.md */
  getReferences: (sourcePath: string) => RuleReference[]

  /** Re-scan and index AGENTS.md files (checks mtime for cache validity) */
  refresh: () => Promise<void>

  /** Get discovery statistics */
  stats: () => RulesDiscoveryStats

  /** Close the discovery registry */
  close: () => Promise<void>
}

// ============================================================================
// Helpers
// ============================================================================

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

// ============================================================================
// Database Schema
// ============================================================================

/**
 * Creates the database schema for rules discovery.
 *
 * @internal
 */
const createSchema = (db: Database) => {
  // AGENTS.md files
  db.run(`
    CREATE TABLE IF NOT EXISTS rules (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      mtime INTEGER NOT NULL
    )
  `)

  // Markdown link references
  db.run(`
    CREATE TABLE IF NOT EXISTS rule_references (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      source_path TEXT NOT NULL,
      display_text TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      absolute_path TEXT NOT NULL,
      line_number INTEGER NOT NULL,
      FOREIGN KEY (source_path) REFERENCES rules(path) ON DELETE CASCADE
    )
  `)

  // FTS5 for text search on display text
  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS rules_fts USING fts5(
      display_text,
      content='rule_references',
      content_rowid='rowid'
    )
  `)

  // Triggers to keep FTS in sync
  db.run(`
    CREATE TRIGGER IF NOT EXISTS rules_fts_insert AFTER INSERT ON rule_references BEGIN
      INSERT INTO rules_fts(rowid, display_text) VALUES (new.rowid, new.display_text);
    END
  `)

  db.run(`
    CREATE TRIGGER IF NOT EXISTS rules_fts_delete AFTER DELETE ON rule_references BEGIN
      INSERT INTO rules_fts(rules_fts, rowid, display_text) VALUES ('delete', old.rowid, old.display_text);
    END
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_refs_source ON rule_references(source_path)`)
}

// ============================================================================
// Rules Discovery Implementation
// ============================================================================

/**
 * Creates a rules discovery registry for AGENTS.md files.
 *
 * @param config - Discovery configuration options
 * @returns Promise resolving to rules discovery registry
 *
 * @remarks
 * By default, uses FTS5 only (zero external dependencies).
 * Set `embedder: true` for hybrid semantic search with the default model.
 *
 * **Three-Tier Loading:**
 * - **Tier 1**: Root AGENTS.md is always available via `getRootRules()`
 * - **Tier 2**: References are indexed and searchable via `searchReferences(intent)`
 * - **Tier 3**: Nested AGENTS.md loaded for file ops via `getRulesForPath(path)`
 *
 * **Cache Invalidation:** Rules are re-indexed when their file's mtime changes.
 * Call `refresh()` to check for updates.
 */
export const createRulesDiscovery = async (config: RulesDiscoveryConfig = {}): Promise<RulesDiscovery> => {
  const { rootDir = process.cwd(), dbPath = ':memory:', embedder: embedderInput } = config

  const embedderConfig = embedderInput ? resolveEmbedderConfig(embedderInput) : undefined

  const db = new Database(dbPath)
  db.run('PRAGMA foreign_keys = ON')

  // Initialize embedder if configured
  const embedder: Embedder | undefined = embedderConfig ? await createEmbedder(embedderConfig) : undefined
  const enableVectorSearch = embedder !== undefined

  createSchema(db)

  // In-memory caches
  const rulesCache = new Map<string, string>() // path -> content
  const referenceCache = new Map<string, RuleReference[]>() // sourcePath -> references

  // In-memory embeddings (rowid -> vector)
  const referenceEmbeddings = new Map<number, readonly number[]>()

  // Root AGENTS.md path
  const rootAgentsPath = join(rootDir, 'AGENTS.md')

  // Prepared statements
  const insertRuleStmt = db.prepare(`
    INSERT OR REPLACE INTO rules (path, content, mtime)
    VALUES ($path, $content, $mtime)
  `)

  const insertReferenceStmt = db.prepare(`
    INSERT INTO rule_references (source_path, display_text, relative_path, absolute_path, line_number)
    VALUES ($sourcePath, $displayText, $relativePath, $absolutePath, $lineNumber)
  `)

  const deleteReferencesStmt = db.prepare(`DELETE FROM rule_references WHERE source_path = $sourcePath`)

  const getRuleMtimeStmt = db.prepare<{ mtime: number }, { $path: string }>(`
    SELECT mtime FROM rules WHERE path = $path
  `)

  const getRuleContentStmt = db.prepare<{ content: string }, { $path: string }>(`
    SELECT content FROM rules WHERE path = $path
  `)

  const getReferenceRowidsStmt = db.prepare<{ rowid: number }, { $sourcePath: string }>(`
    SELECT rowid FROM rule_references WHERE source_path = $sourcePath
  `)

  const getReferenceByRowidStmt = db.prepare<
    {
      source_path: string
      display_text: string
      relative_path: string
      absolute_path: string
      line_number: number
    },
    { $rowid: number }
  >(`
    SELECT source_path, display_text, relative_path, absolute_path, line_number
    FROM rule_references WHERE rowid = $rowid
  `)

  const getAllReferencesStmt = db.prepare<
    {
      source_path: string
      display_text: string
      relative_path: string
      absolute_path: string
      line_number: number
    },
    { $sourcePath: string }
  >(`
    SELECT source_path, display_text, relative_path, absolute_path, line_number
    FROM rule_references WHERE source_path = $sourcePath
  `)

  const ftsSearchStmt = db.prepare<{ rowid: number; rank: number }, { $query: string; $limit: number }>(`
    SELECT rowid, rank FROM rules_fts
    WHERE rules_fts MATCH $query
    ORDER BY rank
    LIMIT $limit
  `)

  /**
   * Indexes a single AGENTS.md file with its references.
   *
   * @internal
   */
  const indexAgentsMd = async (path: string, mtime: number): Promise<void> => {
    const content = await Bun.file(path).text()
    const sourceDir = dirname(path)

    // Delete existing references for this file
    if (rulesCache.has(path)) {
      const refRowids = getReferenceRowidsStmt.all({ $sourcePath: path })
      for (const { rowid } of refRowids) {
        referenceEmbeddings.delete(rowid)
      }
      deleteReferencesStmt.run({ $sourcePath: path })
    }

    // Insert rule
    insertRuleStmt.run({
      $path: path,
      $content: content,
      $mtime: mtime,
    })

    // Extract and index markdown links
    const markdownLinks = extractMarkdownLinks(content, { extensions: ['.md'] })
    const references: RuleReference[] = []

    for (const link of markdownLinks) {
      const absolutePath = join(sourceDir, link.relativePath)
      const ref: RuleReference = {
        displayText: link.displayText,
        relativePath: link.relativePath,
        absolutePath,
        source: path,
        lineNumber: link.lineNumber,
      }

      insertReferenceStmt.run({
        $sourcePath: path,
        $displayText: ref.displayText,
        $relativePath: ref.relativePath,
        $absolutePath: ref.absolutePath,
        $lineNumber: ref.lineNumber,
      })

      references.push(ref)
    }

    // Compute reference embeddings if enabled
    if (enableVectorSearch && embedder && references.length > 0) {
      const refRowids = getReferenceRowidsStmt.all({ $sourcePath: path })
      for (let i = 0; i < refRowids.length; i++) {
        const embedding = await embedder.embed(references[i]!.displayText)
        referenceEmbeddings.set(refRowids[i]!.rowid, embedding)
      }
    }

    rulesCache.set(path, content)
    referenceCache.set(path, references)
  }

  /**
   * Discovers and indexes all AGENTS.md files in the root directory.
   *
   * @internal
   */
  const discoverAndIndex = async (): Promise<void> => {
    try {
      const glob = new Bun.Glob('**/AGENTS.md')
      const entries = await Array.fromAsync(glob.scan({ cwd: rootDir, absolute: true }))

      for (const agentsPath of entries) {
        const file = Bun.file(agentsPath)
        const stat = await file.stat()
        const mtime = stat?.mtime?.getTime() ?? 0

        // Check if rule needs re-indexing
        const cached = getRuleMtimeStmt.get({ $path: agentsPath })

        if (!cached || cached.mtime !== mtime) {
          await indexAgentsMd(agentsPath, mtime)
        } else if (!rulesCache.has(agentsPath)) {
          // Load from DB into memory cache
          const row = getRuleContentStmt.get({ $path: agentsPath })
          if (row) {
            rulesCache.set(agentsPath, row.content)
          }
        }
      }
    } catch {
      // Root directory doesn't exist or can't be read
    }
  }

  const discovery: RulesDiscovery = {
    getRootRules(): string | undefined {
      return rulesCache.get(rootAgentsPath)
    },

    async searchReferences(intent: string, options: { limit?: number } = {}): Promise<ReferenceMatch[]> {
      const { limit = 5 } = options

      // If vector search is enabled, use it
      if (enableVectorSearch && embedder && referenceEmbeddings.size > 0) {
        const queryVec = await embedder.embed(intent)
        const topMatches = findTopSimilar({ query: queryVec, embeddings: referenceEmbeddings, limit })

        const results: ReferenceMatch[] = []
        for (const match of topMatches) {
          const row = getReferenceByRowidStmt.get({ $rowid: match.rowid })
          if (row) {
            results.push({
              reference: {
                displayText: row.display_text,
                relativePath: row.relative_path,
                absolutePath: row.absolute_path,
                source: row.source_path,
                lineNumber: row.line_number,
              },
              similarity: match.similarity,
            })
          }
        }
        return results
      }

      // Fall back to FTS5 search
      const ftsQuery = sanitizeFtsQuery(intent)
      if (!ftsQuery) return []

      const ftsMatches = ftsSearchStmt.all({ $query: ftsQuery, $limit: limit })

      const results: ReferenceMatch[] = []
      for (const match of ftsMatches) {
        const row = getReferenceByRowidStmt.get({ $rowid: match.rowid })
        if (row) {
          // Normalize FTS5 rank to 0-1 similarity
          const normalizedRank = 1 / (1 + Math.abs(match.rank))
          results.push({
            reference: {
              displayText: row.display_text,
              relativePath: row.relative_path,
              absolutePath: row.absolute_path,
              source: row.source_path,
              lineNumber: row.line_number,
            },
            similarity: normalizedRank,
          })
        }
      }

      return results
    },

    async getReferenceContent(ref: RuleReference): Promise<string | undefined> {
      try {
        const file = Bun.file(ref.absolutePath)
        if (!(await file.exists())) return undefined
        return await file.text()
      } catch {
        return undefined
      }
    },

    getRulesForPath(filePath: string): string[] {
      const rules: string[] = []
      let dir = dirname(filePath)

      // Walk up to root, collecting AGENTS.md content
      while (dir.startsWith(rootDir) && dir !== dirname(dir)) {
        const agentsPath = join(dir, 'AGENTS.md')
        const content = rulesCache.get(agentsPath)
        if (content) {
          rules.unshift(content) // Add in order from root to leaf
        }
        dir = dirname(dir)
      }

      return rules
    },

    getReferences(sourcePath: string): RuleReference[] {
      // Try memory cache first
      const cached = referenceCache.get(sourcePath)
      if (cached) return cached

      // Load from DB
      const rows = getAllReferencesStmt.all({ $sourcePath: sourcePath })
      const references: RuleReference[] = rows.map((row) => ({
        displayText: row.display_text,
        relativePath: row.relative_path,
        absolutePath: row.absolute_path,
        source: row.source_path,
        lineNumber: row.line_number,
      }))

      referenceCache.set(sourcePath, references)
      return references
    },

    async refresh(): Promise<void> {
      await discoverAndIndex()
    },

    stats(): RulesDiscoveryStats {
      const refCount =
        referenceEmbeddings.size || [...referenceCache.values()].reduce((sum, refs) => sum + refs.length, 0)
      return {
        totalRules: rulesCache.size,
        totalReferences: refCount,
        vectorSearchEnabled: enableVectorSearch,
      }
    },

    async close(): Promise<void> {
      rulesCache.clear()
      referenceCache.clear()
      referenceEmbeddings.clear()
      db.close()
      if (embedder) {
        await embedder.dispose()
      }
    },
  }

  // Initial scan
  await discovery.refresh()

  return discovery
}
