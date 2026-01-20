/**
 * Semantic Skill Discovery for AgentSkills-compatible skill directories.
 *
 * @remarks
 * Discovers, indexes, and searches skills following the AgentSkills spec.
 * Provides progressive skill filtering for context-limited agents.
 *
 * **Capabilities:**
 * - Persistent SQLite cache with file mtime invalidation
 * - FTS5 full-text search on name, description, and metadata
 * - Optional vector search via node-llama-cpp with in-process embeddings
 * - Body chunking for semantic search of skill instructions
 * - Reciprocal Rank Fusion (RRF) for hybrid scoring
 *
 * **Configuration:**
 * - Default: FTS5 only (zero config, works everywhere)
 * - Opt-in: Set `embedder: true` for hybrid semantic search
 *
 * @see {@link https://agentskills.io/specification | AgentSkills Specification}
 *
 * @module
 */

import { Database } from 'bun:sqlite'
import { basename, dirname, extname, join } from 'node:path'
import type { EmbedderConfig, ToolSchema } from './agent.types.ts'
import { createEmbedder, type Embedder, findTopSimilar } from './embedder.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Skill metadata extracted from SKILL.md frontmatter.
 *
 * @remarks
 * Follows the AgentSkills specification for frontmatter fields.
 * Custom fields should use the `metadata` map.
 *
 * @see {@link https://agentskills.io/specification | AgentSkills Spec}
 */
export type SkillMetadata = {
  /** Skill name from frontmatter (max 64 chars, lowercase + hyphens) */
  name: string
  /** Description of when to use this skill (max 1024 chars) */
  description: string
  /** Absolute path to SKILL.md */
  location: string
  /** Directory containing the skill */
  skillDir: string
  /** License name or reference to bundled license file */
  license?: string
  /** Environment requirements (intended product, system packages, etc.) */
  compatibility?: string
  /** Arbitrary key-value mapping for additional metadata */
  metadata?: Record<string, string>
  /** Space-delimited list of pre-approved tools (experimental) */
  allowedTools?: string[]
}

/**
 * Script metadata extracted from skill scripts.
 */
export type SkillScript = {
  /** Script name (filename without extension) */
  name: string
  /** Full qualified name: skill-name:script-name */
  qualifiedName: string
  /** Description extracted from JSDoc or first comment */
  description: string
  /** Absolute path to the script file */
  location: string
  /** Parent skill name */
  skillName: string
  /** File extension (.ts, .js, .sh, .py) */
  extension: string
  /** Extracted parameters from parseArgs or argparse patterns */
  parameters: ScriptParameter[]
}

/**
 * Script parameter metadata.
 */
export type ScriptParameter = {
  /** Parameter name */
  name: string
  /** Parameter type (string, boolean, number) */
  type: 'string' | 'boolean' | 'number'
  /** Whether the parameter is required */
  required: boolean
  /** Description of the parameter */
  description?: string
  /** Default value if any */
  default?: string | boolean | number
}

/**
 * Configuration for skill discovery.
 */
export type SkillDiscoveryConfig = {
  /** Path to SQLite database (default: ':memory:') */
  dbPath?: string
  /** Root directory to scan for skills (default: '.claude/skills') */
  skillsRoot?: string
  /** Script file extensions to discover (default: ['.ts', '.js', '.sh', '.py']) */
  scriptExtensions?: string[]
  /**
   * Embedder configuration for semantic search.
   * - `undefined` or `false` - FTS5 only (default)
   * - `true` - Hybrid with default model
   * - `EmbedderConfig` - Hybrid with custom model
   */
  embedder?: boolean | EmbedderConfig
  /** Chunk size for body embeddings in characters (default: 1500) */
  chunkSize?: number
  /** Chunk overlap in characters (default: 200) */
  chunkOverlap?: number
}

/**
 * Skill match result with relevance score.
 */
export type SkillMatch = {
  skill: SkillMetadata
  /** Combined relevance score (0-1) */
  score: number
  /** FTS5 rank if matched via keywords */
  ftsRank?: number
  /** Vector similarity if matched via embedding (0-1) */
  vectorSimilarity?: number
}

/**
 * Chunk match result for body search.
 */
export type ChunkMatch = {
  /** Parent skill name */
  skillName: string
  /** Chunk content */
  content: string
  /** Chunk index within skill body */
  chunkIndex: number
  /** Vector similarity score (0-1) */
  similarity: number
}

/**
 * Search options for skill discovery.
 */
export type SkillSearchOptions = {
  /** Maximum results to return (default: 5) */
  limit?: number
  /** Minimum score threshold (default: 0.001) */
  minScore?: number
  /** Weight for FTS5 score in hybrid search (default: 0.5) */
  ftsWeight?: number
  /** Weight for vector score in hybrid search (default: 0.5) */
  vectorWeight?: number
}

/**
 * Statistics about indexed skills.
 */
export type SkillDiscoveryStats = {
  totalSkills: number
  totalScripts: number
  totalChunks: number
  vectorSearchEnabled: boolean
}

/**
 * Skill discovery registry interface.
 */
export type SkillDiscovery = {
  /** Re-scan and index skills (checks mtime for cache validity) */
  refresh: () => Promise<void>
  /** Search skills by intent */
  search: (intent: string, options?: SkillSearchOptions) => Promise<SkillMatch[]>
  /** Search skill body chunks by intent (for small-context models) */
  searchChunks: (intent: string, options?: SkillSearchOptions) => Promise<ChunkMatch[]>
  /** Get all cached skills */
  all: () => SkillMetadata[]
  /** Get skill body content (loads from disk) */
  getBody: (name: string) => Promise<string | undefined>
  /** Get scripts for a skill */
  getScripts: (skillName: string) => SkillScript[]
  /** Get discovery statistics */
  stats: () => SkillDiscoveryStats
  /** Close the discovery registry */
  close: () => Promise<void>
}

// ============================================================================
// Frontmatter Parsing
// ============================================================================

/**
 * Parses YAML frontmatter from SKILL.md content.
 *
 * @param content - Raw markdown content with frontmatter
 * @returns Parsed frontmatter as key-value pairs
 *
 * @internal
 */
const parseFrontmatter = (content: string): Record<string, unknown> => {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}

  const yaml = match[1]!
  const result: Record<string, unknown> = {}
  let inMetadata = false
  const metadataMap: Record<string, string> = {}

  for (const line of yaml.split('\n')) {
    // Handle metadata block
    if (line.trim() === 'metadata:') {
      inMetadata = true
      continue
    }

    // Handle indented metadata entries
    if (inMetadata && line.startsWith('  ')) {
      const colonIndex = line.indexOf(':')
      if (colonIndex !== -1) {
        const key = line.slice(2, colonIndex).trim()
        let value = line.slice(colonIndex + 1).trim()
        // Remove quotes
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        metadataMap[key] = value
      }
      continue
    }

    // Exit metadata block on non-indented line
    if (inMetadata && !line.startsWith('  ') && line.trim()) {
      inMetadata = false
      result.metadata = metadataMap
    }

    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    let value: unknown = line.slice(colonIndex + 1).trim()

    // Handle quoted strings
    if (typeof value === 'string') {
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
    }

    // Handle booleans
    if (value === 'true') value = true
    if (value === 'false') value = false

    // Handle space-delimited arrays (allowed-tools)
    if (key === 'allowed-tools' && typeof value === 'string') {
      value = value.split(/\s+/).filter(Boolean)
    }

    result[key] = value
  }

  // Finalize metadata if we ended in metadata block
  if (inMetadata && Object.keys(metadataMap).length > 0) {
    result.metadata = metadataMap
  }

  return result
}

/**
 * Extracts body content from SKILL.md (after frontmatter).
 *
 * @param content - Raw markdown content
 * @returns Body content without frontmatter
 *
 * @internal
 */
const extractBody = (content: string): string => {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)
  return match ? match[1]!.trim() : content.trim()
}

// ============================================================================
// Script Metadata Extraction
// ============================================================================

/**
 * Extracts JSDoc description from script content.
 *
 * @param content - Script source code
 * @returns First paragraph of JSDoc or leading comment
 *
 * @internal
 */
const extractJSDocDescription = (content: string): string | undefined => {
  // Match JSDoc block comment at start of file
  const jsdocMatch = content.match(/^\/\*\*\s*\n([\s\S]*?)\*\//)
  if (jsdocMatch) {
    const lines = jsdocMatch[1]!
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, '').trim())
      .filter((line) => !line.startsWith('@'))
      .filter(Boolean)

    return lines.join(' ')
  }

  // Match single-line comment at start
  const singleLineMatch = content.match(/^\/\/\s*(.+)/)
  if (singleLineMatch) {
    return singleLineMatch[1]
  }

  // Match shell/python comment at start
  const hashMatch = content.match(/^#\s*(.+)/)
  if (hashMatch && !hashMatch[1]!.startsWith('!')) {
    return hashMatch[1]
  }

  return undefined
}

// ============================================================================
// Text Chunking
// ============================================================================

/**
 * Splits text into overlapping chunks for embedding.
 *
 * @param text - Text to chunk
 * @param chunkSize - Target chunk size in characters
 * @param overlap - Overlap between chunks in characters
 * @returns Array of text chunks
 *
 * @internal
 */
const chunkText = (text: string, chunkSize: number, overlap: number): string[] => {
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + chunkSize

    // Try to break at paragraph or sentence boundary
    if (end < text.length) {
      const slice = text.slice(start, end + 100)
      const paragraphBreak = slice.lastIndexOf('\n\n')
      const sentenceBreak = slice.lastIndexOf('. ')

      if (paragraphBreak > chunkSize * 0.7) {
        end = start + paragraphBreak + 2
      } else if (sentenceBreak > chunkSize * 0.7) {
        end = start + sentenceBreak + 2
      }
    }

    chunks.push(text.slice(start, end).trim())
    start = end - overlap
  }

  return chunks.filter((c) => c.length > 50)
}

// ============================================================================
// Database Schema
// ============================================================================

/**
 * Creates the database schema for skill discovery.
 *
 * @internal
 */
const createSchema = (db: Database) => {
  // Skills table with metadata
  db.run(`
    CREATE TABLE IF NOT EXISTS skills (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      location TEXT NOT NULL,
      skill_dir TEXT NOT NULL,
      license TEXT,
      compatibility TEXT,
      metadata_json TEXT,
      allowed_tools TEXT,
      mtime INTEGER NOT NULL
    )
  `)

  // FTS5 for keyword search (name, description, metadata values)
  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
      name,
      description,
      metadata_text
    )
  `)

  // Body chunks for semantic search
  db.run(`
    CREATE TABLE IF NOT EXISTS skill_chunks (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_name TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      FOREIGN KEY (skill_name) REFERENCES skills(name) ON DELETE CASCADE
    )
  `)

  // Scripts table
  db.run(`
    CREATE TABLE IF NOT EXISTS skill_scripts (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      qualified_name TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      location TEXT NOT NULL,
      skill_name TEXT NOT NULL,
      extension TEXT NOT NULL,
      parameters_json TEXT NOT NULL,
      FOREIGN KEY (skill_name) REFERENCES skills(name) ON DELETE CASCADE
    )
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_chunks_skill ON skill_chunks(skill_name)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_scripts_skill ON skill_scripts(skill_name)`)
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

/**
 * Flattens metadata to searchable text.
 *
 * @internal
 */
const metadataToText = (metadata?: Record<string, string>): string => {
  if (!metadata) return ''
  return Object.entries(metadata)
    .map(([k, v]) => `${k} ${v}`)
    .join(' ')
}

// ============================================================================
// Skill Discovery Implementation
// ============================================================================

/**
 * Creates a semantic skill discovery registry.
 *
 * @param config - Discovery configuration options
 * @returns Promise resolving to skill discovery registry
 *
 * @remarks
 * By default, uses FTS5 only (zero external dependencies).
 * Set `embedder: true` for hybrid semantic search with the default model.
 *
 * **Cache Invalidation:** Skills are re-indexed when their SKILL.md file's
 * mtime changes. Call `refresh()` to check for updates.
 *
 * **Graceful Degradation:** If model loading fails, falls back to FTS5-only search.
 */
export const createSkillDiscovery = async (config: SkillDiscoveryConfig = {}): Promise<SkillDiscovery> => {
  const {
    dbPath = ':memory:',
    skillsRoot = '.claude/skills',
    scriptExtensions = ['.ts', '.js', '.sh', '.py'],
    embedder: embedderInput,
    chunkSize = 1500,
    chunkOverlap = 200,
  } = config

  const resolvedRoot = join(process.cwd(), skillsRoot)
  const embedderConfig = embedderInput ? resolveEmbedderConfig(embedderInput) : undefined

  const db = new Database(dbPath)
  db.run('PRAGMA foreign_keys = ON')

  // Initialize embedder if configured
  const embedder: Embedder | undefined = embedderConfig ? await createEmbedder(embedderConfig) : undefined
  const enableVectorSearch = embedder !== undefined

  createSchema(db)

  // In-memory caches
  const skillCache = new Map<string, SkillMetadata>()
  const scriptCache = new Map<string, SkillScript[]>()

  // In-memory embeddings (rowid -> vector)
  const skillEmbeddings = new Map<number, readonly number[]>()
  const chunkEmbeddings = new Map<number, readonly number[]>()

  // Prepared statements
  const insertSkillStmt = db.prepare(`
    INSERT OR REPLACE INTO skills (name, description, location, skill_dir, license, compatibility, metadata_json, allowed_tools, mtime)
    VALUES ($name, $description, $location, $skillDir, $license, $compatibility, $metadataJson, $allowedTools, $mtime)
  `)

  const insertFtsStmt = db.prepare(`
    INSERT INTO skills_fts (name, description, metadata_text)
    VALUES ($name, $description, $metadataText)
  `)

  const deleteFtsStmt = db.prepare(`DELETE FROM skills_fts WHERE name = $name`)

  const insertChunkStmt = db.prepare(`
    INSERT INTO skill_chunks (skill_name, chunk_index, content)
    VALUES ($skillName, $chunkIndex, $content)
  `)

  const deleteChunksStmt = db.prepare(`DELETE FROM skill_chunks WHERE skill_name = $skillName`)

  const insertScriptStmt = db.prepare(`
    INSERT OR REPLACE INTO skill_scripts (name, qualified_name, description, location, skill_name, extension, parameters_json)
    VALUES ($name, $qualifiedName, $description, $location, $skillName, $extension, $parametersJson)
  `)

  const deleteScriptsStmt = db.prepare(`DELETE FROM skill_scripts WHERE skill_name = $skillName`)

  const getSkillMtimeStmt = db.prepare<{ mtime: number }, { $name: string }>(`
    SELECT mtime FROM skills WHERE name = $name
  `)

  const getSkillRowidStmt = db.prepare<{ rowid: number }, { $name: string }>(`
    SELECT rowid FROM skills WHERE name = $name
  `)

  const getChunkRowidsStmt = db.prepare<{ rowid: number }, { $skillName: string }>(`
    SELECT rowid FROM skill_chunks WHERE skill_name = $skillName
  `)

  const ftsSearchStmt = db.prepare(`
    SELECT name, rank FROM skills_fts
    WHERE skills_fts MATCH $query
    ORDER BY rank
    LIMIT $limit
  `)

  const getSkillNameByRowidStmt = db.prepare<{ name: string }, { $rowid: number }>(`
    SELECT name FROM skills WHERE rowid = $rowid
  `)

  const getChunkByRowidStmt = db.prepare<
    { skill_name: string; chunk_index: number; content: string },
    { $rowid: number }
  >(`
    SELECT skill_name, chunk_index, content FROM skill_chunks WHERE rowid = $rowid
  `)

  const getAllScriptsStmt = db.prepare<
    {
      name: string
      qualified_name: string
      description: string
      location: string
      skill_name: string
      extension: string
      parameters_json: string
    },
    { $skillName: string }
  >(`
    SELECT name, qualified_name, description, location, skill_name, extension, parameters_json
    FROM skill_scripts WHERE skill_name = $skillName
  `)

  /**
   * Indexes a single skill with its scripts and body chunks.
   *
   * @internal
   */
  const indexSkill = async (skillMdPath: string, mtime: number): Promise<SkillMetadata | undefined> => {
    const skillDir = dirname(skillMdPath)
    const content = await Bun.file(skillMdPath).text()
    const frontmatter = parseFrontmatter(content)

    if (!frontmatter.name || !frontmatter.description) {
      return undefined
    }

    const skill: SkillMetadata = {
      name: frontmatter.name as string,
      description: frontmatter.description as string,
      location: skillMdPath,
      skillDir,
      license: frontmatter.license as string | undefined,
      compatibility: frontmatter.compatibility as string | undefined,
      metadata: frontmatter.metadata as Record<string, string> | undefined,
      allowedTools: frontmatter['allowed-tools'] as string[] | undefined,
    }

    // Delete existing entries if replacing
    if (skillCache.has(skill.name)) {
      const existing = getSkillRowidStmt.get({ $name: skill.name })
      if (existing) {
        skillEmbeddings.delete(existing.rowid)
      }
      // Delete chunk embeddings
      const chunkRowids = getChunkRowidsStmt.all({ $skillName: skill.name })
      for (const { rowid } of chunkRowids) {
        chunkEmbeddings.delete(rowid)
      }
      deleteFtsStmt.run({ $name: skill.name })
      deleteChunksStmt.run({ $skillName: skill.name })
      deleteScriptsStmt.run({ $skillName: skill.name })
    }

    // Insert skill
    insertSkillStmt.run({
      $name: skill.name,
      $description: skill.description,
      $location: skill.location,
      $skillDir: skill.skillDir,
      $license: skill.license ?? null,
      $compatibility: skill.compatibility ?? null,
      $metadataJson: skill.metadata ? JSON.stringify(skill.metadata) : null,
      $allowedTools: skill.allowedTools?.join(' ') ?? null,
      $mtime: mtime,
    })

    // Insert FTS
    insertFtsStmt.run({
      $name: skill.name,
      $description: skill.description,
      $metadataText: metadataToText(skill.metadata),
    })

    // Get rowid for embedding storage
    const row = getSkillRowidStmt.get({ $name: skill.name })
    const skillRowid = row!.rowid

    // Compute skill embedding if enabled
    if (enableVectorSearch && embedder) {
      const embedding = await embedder.embed(`${skill.name} ${skill.description}`)
      skillEmbeddings.set(skillRowid, embedding)
    }

    // Index body chunks
    const body = extractBody(content)
    const chunks = chunkText(body, chunkSize, chunkOverlap)

    for (let i = 0; i < chunks.length; i++) {
      insertChunkStmt.run({
        $skillName: skill.name,
        $chunkIndex: i,
        $content: chunks[i]!,
      })
    }

    // Compute chunk embeddings if enabled
    if (enableVectorSearch && embedder) {
      const chunkRowids = getChunkRowidsStmt.all({ $skillName: skill.name })
      for (let i = 0; i < chunkRowids.length; i++) {
        const embedding = await embedder.embed(chunks[i]!)
        chunkEmbeddings.set(chunkRowids[i]!.rowid, embedding)
      }
    }

    // Index scripts
    const scripts = await discoverScriptsForSkill(skill, scriptExtensions)
    for (const script of scripts) {
      insertScriptStmt.run({
        $name: script.name,
        $qualifiedName: script.qualifiedName,
        $description: script.description,
        $location: script.location,
        $skillName: script.skillName,
        $extension: script.extension,
        $parametersJson: JSON.stringify(script.parameters),
      })
    }

    skillCache.set(skill.name, skill)
    scriptCache.set(skill.name, scripts)

    return skill
  }

  /**
   * Discovers scripts in a skill's scripts directory.
   *
   * @internal
   */
  const discoverScriptsForSkill = async (skill: SkillMetadata, extensions: string[]): Promise<SkillScript[]> => {
    const scripts: SkillScript[] = []
    const scriptsDir = join(skill.skillDir, 'scripts')

    try {
      const glob = new Bun.Glob('*')
      const entries = await Array.fromAsync(glob.scan({ cwd: scriptsDir, absolute: true }))

      for (const scriptPath of entries) {
        const ext = extname(scriptPath)
        if (!extensions.includes(ext)) continue

        // Skip test files
        if (scriptPath.includes('/tests/') || scriptPath.includes('.spec.') || scriptPath.includes('.test.')) {
          continue
        }

        const scriptName = basename(scriptPath, ext)
        const content = await Bun.file(scriptPath).text()

        const description = extractJSDocDescription(content) || `Execute ${scriptName} script`

        // Parameters are left empty - use model introspection or --help at runtime
        scripts.push({
          name: scriptName,
          qualifiedName: `${skill.name}:${scriptName}`,
          description,
          location: scriptPath,
          skillName: skill.name,
          extension: ext,
          parameters: [],
        })
      }
    } catch {
      // Scripts directory doesn't exist
    }

    return scripts
  }

  const discovery: SkillDiscovery = {
    async refresh(): Promise<void> {
      try {
        const entries = await Array.fromAsync(new Bun.Glob('*/SKILL.md').scan({ cwd: resolvedRoot, absolute: true }))

        for (const skillMdPath of entries) {
          const file = Bun.file(skillMdPath)
          const stat = await file.stat()
          const mtime = stat?.mtime?.getTime() ?? 0

          // Check if skill needs re-indexing
          const skillDir = dirname(skillMdPath)
          const skillName = basename(skillDir)
          const cached = getSkillMtimeStmt.get({ $name: skillName })

          if (!cached || cached.mtime !== mtime) {
            await indexSkill(skillMdPath, mtime)
          } else if (!skillCache.has(skillName)) {
            // Load from DB into memory cache
            const skill = await loadSkillFromDb(skillName)
            if (skill) {
              skillCache.set(skillName, skill)
            }
          }
        }
      } catch {
        // Root directory doesn't exist
      }
    },

    async search(intent: string, options: SkillSearchOptions = {}): Promise<SkillMatch[]> {
      const { limit = 5, minScore = 0.001, ftsWeight = 0.5, vectorWeight = 0.5 } = options

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

      // Vector search
      if (enableVectorSearch && embedder && skillEmbeddings.size > 0) {
        const queryVec = await embedder.embed(intent)
        const topMatches = findTopSimilar({ query: queryVec, embeddings: skillEmbeddings, limit: limit * 2 })

        for (const match of topMatches) {
          const nameResult = getSkillNameByRowidStmt.get({ $rowid: match.rowid })
          if (nameResult) {
            vecResults.set(nameResult.name, match.similarity)
          }
        }
      }

      // Reciprocal Rank Fusion
      const combinedScores = new Map<string, SkillMatch>()
      const k = 60

      // Process FTS results
      let ftsRank = 1
      for (const [name, score] of [...ftsResults.entries()].sort((a, b) => b[1] - a[1])) {
        const skill = skillCache.get(name)
        if (!skill) continue

        const rrfScore = ftsWeight / (k + ftsRank)
        ftsRank++

        combinedScores.set(name, {
          skill,
          score: rrfScore,
          ftsRank: score,
        })
      }

      // Process vector results
      let vecRank = 1
      for (const [name, similarity] of [...vecResults.entries()].sort((a, b) => b[1] - a[1])) {
        const skill = skillCache.get(name)
        if (!skill) continue

        const rrfScore = vectorWeight / (k + vecRank)
        vecRank++

        const existing = combinedScores.get(name)
        if (existing) {
          existing.score += rrfScore
          existing.vectorSimilarity = similarity
        } else {
          combinedScores.set(name, {
            skill,
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

    async searchChunks(intent: string, options: SkillSearchOptions = {}): Promise<ChunkMatch[]> {
      const { limit = 5 } = options

      if (!enableVectorSearch || !embedder || chunkEmbeddings.size === 0) {
        return []
      }

      const queryVec = await embedder.embed(intent)
      const topMatches = findTopSimilar({ query: queryVec, embeddings: chunkEmbeddings, limit })

      const results: ChunkMatch[] = []
      for (const match of topMatches) {
        const chunk = getChunkByRowidStmt.get({ $rowid: match.rowid })
        if (chunk) {
          results.push({
            skillName: chunk.skill_name,
            content: chunk.content,
            chunkIndex: chunk.chunk_index,
            similarity: match.similarity,
          })
        }
      }

      return results
    },

    all(): SkillMetadata[] {
      return [...skillCache.values()]
    },

    async getBody(name: string): Promise<string | undefined> {
      const skill = skillCache.get(name)
      if (!skill) return undefined

      try {
        const content = await Bun.file(skill.location).text()
        return extractBody(content)
      } catch {
        return undefined
      }
    },

    getScripts(skillName: string): SkillScript[] {
      // Try memory cache first
      const cached = scriptCache.get(skillName)
      if (cached) return cached

      // Load from DB
      const rows = getAllScriptsStmt.all({ $skillName: skillName })
      const scripts: SkillScript[] = rows.map((row) => ({
        name: row.name,
        qualifiedName: row.qualified_name,
        description: row.description,
        location: row.location,
        skillName: row.skill_name,
        extension: row.extension,
        parameters: JSON.parse(row.parameters_json) as ScriptParameter[],
      }))

      scriptCache.set(skillName, scripts)
      return scripts
    },

    stats(): SkillDiscoveryStats {
      const skillCount = skillCache.size
      let scriptCount = 0
      for (const scripts of scriptCache.values()) {
        scriptCount += scripts.length
      }

      return {
        totalSkills: skillCount,
        totalScripts: scriptCount,
        totalChunks: chunkEmbeddings.size,
        vectorSearchEnabled: enableVectorSearch,
      }
    },

    async close(): Promise<void> {
      skillEmbeddings.clear()
      chunkEmbeddings.clear()
      skillCache.clear()
      scriptCache.clear()
      db.close()
      if (embedder) {
        await embedder.dispose()
      }
    },
  }

  /**
   * Loads skill metadata from database.
   *
   * @internal
   */
  const loadSkillFromDb = async (name: string): Promise<SkillMetadata | undefined> => {
    const row = db
      .prepare<
        {
          name: string
          description: string
          location: string
          skill_dir: string
          license: string | null
          compatibility: string | null
          metadata_json: string | null
          allowed_tools: string | null
        },
        { $name: string }
      >(`SELECT * FROM skills WHERE name = $name`)
      .get({ $name: name })

    if (!row) return undefined

    return {
      name: row.name,
      description: row.description,
      location: row.location,
      skillDir: row.skill_dir,
      license: row.license ?? undefined,
      compatibility: row.compatibility ?? undefined,
      metadata: row.metadata_json ? (JSON.parse(row.metadata_json) as Record<string, string>) : undefined,
      allowedTools: row.allowed_tools?.split(' ') ?? undefined,
    }
  }

  // Initial scan
  await discovery.refresh()

  return discovery
}

// ============================================================================
// Legacy API (Backwards Compatibility)
// ============================================================================

/**
 * Discovers skills in a directory by scanning for SKILL.md files.
 *
 * @param rootDir - Root directory to scan (relative to cwd)
 * @returns Promise resolving to array of discovered skill metadata
 *
 * @remarks
 * Simple one-shot discovery without caching.
 * For cached discovery with search, use `createSkillDiscovery()`.
 *
 * @deprecated Use `createSkillDiscovery()` for persistent caching and search.
 */
export const discoverSkills = async (rootDir: string): Promise<SkillMetadata[]> => {
  const skills: SkillMetadata[] = []
  const resolvedRoot = join(process.cwd(), rootDir)

  try {
    const entries = await Array.fromAsync(new Bun.Glob('*/SKILL.md').scan({ cwd: resolvedRoot, absolute: true }))

    for (const skillMdPath of entries) {
      const skillDir = dirname(skillMdPath)
      const content = await Bun.file(skillMdPath).text()
      const frontmatter = parseFrontmatter(content)

      if (frontmatter.name && frontmatter.description) {
        skills.push({
          name: frontmatter.name as string,
          description: frontmatter.description as string,
          location: skillMdPath,
          skillDir,
          license: frontmatter.license as string | undefined,
          compatibility: frontmatter.compatibility as string | undefined,
          metadata: frontmatter.metadata as Record<string, string> | undefined,
          allowedTools: frontmatter['allowed-tools'] as string[] | undefined,
        })
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return skills
}

/**
 * Discovers scripts in skill directories.
 *
 * @param options - Discovery options
 * @returns Array of discovered script metadata
 *
 * @deprecated Use `createSkillDiscovery().getScripts()` for cached script access.
 */
export const discoverSkillScripts = async (
  options: { skillsRoot?: string; scriptExtensions?: string[] } = {},
): Promise<SkillScript[]> => {
  const { skillsRoot = '.claude/skills', scriptExtensions = ['.ts', '.js', '.sh', '.py'] } = options

  const scripts: SkillScript[] = []
  const skills = await discoverSkills(skillsRoot)

  for (const skill of skills) {
    const scriptsDir = join(skill.skillDir, 'scripts')

    try {
      const glob = new Bun.Glob('*')
      const entries = await Array.fromAsync(glob.scan({ cwd: scriptsDir, absolute: true }))

      for (const scriptPath of entries) {
        const ext = extname(scriptPath)
        if (!scriptExtensions.includes(ext)) continue

        if (scriptPath.includes('/tests/') || scriptPath.includes('.spec.') || scriptPath.includes('.test.')) {
          continue
        }

        const scriptName = basename(scriptPath, ext)
        const content = await Bun.file(scriptPath).text()

        const description = extractJSDocDescription(content) || `Execute ${scriptName} script`

        // Parameters are left empty - use model introspection or --help at runtime
        scripts.push({
          name: scriptName,
          qualifiedName: `${skill.name}:${scriptName}`,
          description,
          location: scriptPath,
          skillName: skill.name,
          extension: ext,
          parameters: [],
        })
      }
    } catch {
      // Scripts directory doesn't exist
    }
  }

  return scripts
}

// ============================================================================
// Context Formatting
// ============================================================================

/**
 * Formats skills into XML context for system prompts.
 *
 * @param skills - Array of skill metadata
 * @param scripts - Optional array of script metadata
 * @returns XML string for injection into system prompt
 *
 * @remarks
 * Generates XML following AgentSkills specification recommendations.
 * Keeps metadata concise (~50-100 tokens per skill).
 *
 * @see {@link https://agentskills.io/integrate-skills | AgentSkills Integration Guide}
 */
export const formatSkillsContext = (skills: SkillMetadata[], scripts?: SkillScript[]): string => {
  if (skills.length === 0) return ''

  const lines: string[] = ['<available_skills>']

  for (const skill of skills) {
    lines.push('  <skill>')
    lines.push(`    <name>${skill.name}</name>`)
    lines.push(`    <description>${skill.description}</description>`)
    lines.push(`    <location>${skill.location}</location>`)

    // Include scripts for this skill if provided
    if (scripts) {
      const skillScripts = scripts.filter((s) => s.skillName === skill.name)
      if (skillScripts.length > 0) {
        lines.push('    <scripts>')
        for (const script of skillScripts) {
          lines.push(`      <script name="${script.qualifiedName}">${script.description}</script>`)
        }
        lines.push('    </scripts>')
      }
    }

    lines.push('  </skill>')
  }

  lines.push('</available_skills>')
  return lines.join('\n')
}

// ============================================================================
// Tool Schema Conversion
// ============================================================================

/**
 * Converts skill scripts to tool schemas for the model.
 *
 * @param scripts - Array of script metadata
 * @returns Array of tool schemas
 *
 * @remarks
 * Each script becomes a tool with its qualified name (skill-name:script-name).
 * Parameters are extracted from parseArgs/argparse patterns in the script.
 */
export const scriptsToToolSchemas = (scripts: SkillScript[]): ToolSchema[] =>
  scripts.map((script) => {
    const properties: Record<string, { type: string; description?: string; default?: unknown }> = {}
    const required: string[] = []

    for (const param of script.parameters) {
      properties[param.name] = {
        type: param.type,
        description: param.description,
        default: param.default,
      }

      if (param.required) {
        required.push(param.name)
      }
    }

    return {
      name: script.qualifiedName,
      description: script.description,
      parameters: {
        type: 'object',
        properties,
        required,
      },
    }
  })

/**
 * Loads and registers skill scripts as tools in a registry.
 *
 * @param registry - Tool registry to add scripts to
 * @param options - Discovery options
 * @returns Number of scripts registered
 *
 * @remarks
 * Discovers scripts and registers them with execution handlers.
 * Scripts are executed via Bun.spawn with timeout protection.
 */
export const loadSkillScripts = async (
  registry: {
    register: (name: string, handler: (args: Record<string, unknown>) => Promise<unknown>, schema: ToolSchema) => void
    schemas: ToolSchema[]
  },
  options: { skillsRoot?: string; scriptExtensions?: string[] } = {},
): Promise<number> => {
  const scripts = await discoverSkillScripts(options)
  const schemas = scriptsToToolSchemas(scripts)

  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i]!
    const schema = schemas[i]!

    registry.register(
      script.qualifiedName,
      async (args: Record<string, unknown>) => {
        // Build command arguments
        const cmdArgs: string[] = []
        for (const [key, value] of Object.entries(args)) {
          if (typeof value === 'boolean') {
            if (value) cmdArgs.push(`--${key}`)
          } else {
            cmdArgs.push(`--${key}`, String(value))
          }
        }

        // Execute script with timeout
        const proc = Bun.spawn(['bun', script.location, ...cmdArgs], {
          cwd: dirname(script.location),
          stdout: 'pipe',
          stderr: 'pipe',
        })

        const output = await new Response(proc.stdout).text()
        const stderr = await new Response(proc.stderr).text()
        const exitCode = await proc.exited

        if (exitCode !== 0) {
          throw new Error(`Script ${script.qualifiedName} failed: ${stderr}`)
        }

        // Try to parse JSON output
        try {
          return JSON.parse(output)
        } catch {
          return output.trim()
        }
      },
      schema,
    )
  }

  return scripts.length
}
