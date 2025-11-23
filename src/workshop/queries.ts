/**
 * Database query operations for Plaited documentation storage.
 * These functions are exposed via CLI commands and will become MCP tools.
 *
 * @module workshop/queries
 *
 * @remarks
 * - All functions use prepared statements for performance
 * - JSON arrays stored as stringified JSON in TEXT columns
 * - MCP-ready: Each function designed for code execution pattern
 * - CLI-friendly: Returns JSON-serializable results
 *
 * @see {@link db} for database connection
 * @since 1.0.0
 */

import { db, initDB } from '../databases/db.ts'

/**
 * Example data structure for storing API code examples.
 *
 * @property module - Module this example belongs to ('main', 'testing', 'utils', 'workshop')
 * @property export_name - Name of the exported API (e.g., 'bElement', 'story')
 * @property category - Categorization of the example (e.g., 'web-components', 'testing')
 * @property title - Short, descriptive title for the example
 * @property description - Detailed description of what the example demonstrates
 * @property code - Complete, self-contained, runnable code example
 * @property dependencies - Optional JSON array of required imports/dependencies
 * @property runtime_context - Where this code can run ('browser', 'node', 'worker', 'any')
 * @property mcp_tool_compatible - Whether this example can be executed via MCP tools
 * @property expected_output - Optional description of expected output when run
 * @property github_permalink - Optional GitHub permalink to original source
 * @property derived_from - Source of the example ('story', 'test', 'manual')
 * @property tags - Optional JSON array of searchable tags
 * @property complexity - Difficulty level ('basic', 'intermediate', 'advanced')
 *
 * @remarks
 * - code field must be self-contained (no references to test/story files)
 * - dependencies stored as JSON array string (e.g., '["bun:test","plaited"]')
 * - tags stored as JSON array string (e.g., '["jsx","shadow-dom"]')
 *
 * @since 1.0.0
 */
export type ExampleData = {
  module: 'main' | 'testing' | 'utils' | 'workshop'
  export_name: string
  category: string
  title: string
  description: string
  code: string
  dependencies?: string[]
  runtime_context?: 'browser' | 'node' | 'worker' | 'any'
  mcp_tool_compatible?: boolean
  expected_output?: string
  github_permalink?: string
  derived_from?: 'story' | 'test' | 'manual'
  tags?: string[]
  complexity?: 'basic' | 'intermediate' | 'advanced'
}

/**
 * Pattern data structure for storing architectural patterns.
 *
 * @property name - Unique identifier for the pattern (kebab-case)
 * @property category - Pattern category (e.g., 'behavioral-programming', 'web-components')
 * @property title - Human-readable pattern title
 * @property description - Overview of what the pattern is
 * @property problem - What problem this pattern solves
 * @property solution - How the pattern solves the problem
 * @property code_example - Complete code demonstrating the pattern
 * @property use_cases - JSON array of when to use this pattern
 * @property anti_patterns - What NOT to do, common mistakes
 * @property related_patterns - JSON array of related pattern names
 * @property related_apis - JSON array of related API export names
 * @property related_examples - JSON array of related example IDs
 * @property mcp_tool_compatible - Whether pattern examples can be executed via MCP
 * @property expected_outcome - What should happen when pattern is applied
 * @property github_permalink - Optional GitHub permalink to pattern usage
 * @property reference_links - JSON array of external references/docs
 * @property maintainer_notes - Internal notes for maintainers
 * @property tags - JSON array of searchable tags
 * @property complexity - Difficulty level ('basic', 'intermediate', 'advanced')
 *
 * @remarks
 * - name must be unique across all patterns
 * - Arrays stored as JSON strings in database
 * - code_example should be complete and runnable
 *
 * @since 1.0.0
 */
export type PatternData = {
  name: string
  category: string
  title: string
  description: string
  problem: string
  solution: string
  code_example: string
  use_cases?: string[]
  anti_patterns?: string
  related_patterns?: string[]
  related_apis?: string[]
  related_examples?: number[]
  mcp_tool_compatible?: boolean
  expected_outcome?: string
  github_permalink?: string
  reference_links?: string[]
  maintainer_notes?: string
  tags?: string[]
  complexity?: 'basic' | 'intermediate' | 'advanced'
}

/**
 * Search result for examples full-text search.
 *
 * @property id - Example ID
 * @property export_name - API export name
 * @property title - Example title
 * @property description - Example description
 * @property rank - FTS5 relevance score (lower is better)
 *
 * @since 1.0.0
 */
export type ExampleSearchResult = {
  id: number
  export_name: string
  title: string
  description: string
  rank: number
}

/**
 * Search result for patterns full-text search.
 *
 * @property id - Pattern ID
 * @property name - Pattern name
 * @property title - Pattern title
 * @property description - Pattern description
 * @property rank - FTS5 relevance score (lower is better)
 *
 * @since 1.0.0
 */
export type PatternSearchResult = {
  id: number
  name: string
  title: string
  description: string
  rank: number
}

/**
 * Insert a new code example into the database.
 *
 * @param example - Example data to insert
 * @returns The ID of the inserted example
 *
 * @remarks
 * - Arrays (dependencies, tags) converted to JSON strings
 * - mcp_tool_compatible converted to INTEGER (0 or 1)
 * - created_at and updated_at set automatically
 * - Triggers FTS index update automatically
 *
 * @throws {Error} If database not initialized or insert fails
 *
 * @see {@link ExampleData} for data structure
 * @since 1.0.0
 */
export const insertExample = (example: ExampleData): number => {
  const stmt = db.prepare(`
    INSERT INTO examples (
      module, export_name, category, title, description, code,
      dependencies, runtime_context, mcp_tool_compatible, expected_output,
      github_permalink, derived_from, tags, complexity
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    example.module,
    example.export_name,
    example.category,
    example.title,
    example.description,
    example.code,
    example.dependencies ? JSON.stringify(example.dependencies) : null,
    example.runtime_context ?? null,
    example.mcp_tool_compatible ? 1 : 0,
    example.expected_output ?? null,
    example.github_permalink ?? null,
    example.derived_from ?? null,
    example.tags ? JSON.stringify(example.tags) : null,
    example.complexity ?? 'basic',
  )

  return result.lastInsertRowid as number
}

/**
 * Insert a new architectural pattern into the database.
 *
 * @param pattern - Pattern data to insert
 * @returns The ID of the inserted pattern
 *
 * @remarks
 * - Arrays converted to JSON strings before storage
 * - name must be unique (will throw on duplicate)
 * - Triggers FTS index update automatically
 *
 * @throws {Error} If pattern name already exists or insert fails
 *
 * @see {@link PatternData} for data structure
 * @since 1.0.0
 */
export const insertPattern = (pattern: PatternData): number => {
  const stmt = db.prepare(`
    INSERT INTO patterns (
      name, category, title, description, problem, solution, code_example,
      use_cases, anti_patterns, related_patterns, related_apis, related_examples,
      mcp_tool_compatible, expected_outcome, github_permalink, reference_links,
      maintainer_notes, tags, complexity
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    pattern.name,
    pattern.category,
    pattern.title,
    pattern.description,
    pattern.problem,
    pattern.solution,
    pattern.code_example,
    pattern.use_cases ? JSON.stringify(pattern.use_cases) : null,
    pattern.anti_patterns ?? null,
    pattern.related_patterns ? JSON.stringify(pattern.related_patterns) : null,
    pattern.related_apis ? JSON.stringify(pattern.related_apis) : null,
    pattern.related_examples ? JSON.stringify(pattern.related_examples) : null,
    pattern.mcp_tool_compatible ? 1 : 0,
    pattern.expected_outcome ?? null,
    pattern.github_permalink ?? null,
    pattern.reference_links ? JSON.stringify(pattern.reference_links) : null,
    pattern.maintainer_notes ?? null,
    pattern.tags ? JSON.stringify(pattern.tags) : null,
    pattern.complexity ?? 'basic',
  )

  return result.lastInsertRowid as number
}

/**
 * Search examples using full-text search.
 *
 * @param query - Search query string (FTS5 syntax supported)
 * @param limit - Maximum number of results to return
 * @returns Array of search results ordered by relevance
 *
 * @remarks
 * - Uses FTS5 MATCH for fast full-text search
 * - Searches export_name, title, description, code, and tags
 * - Results ordered by rank (lower rank = better match)
 * - FTS5 syntax: "term1 term2", term1 OR term2, -excluded
 *
 * @see {@link ExampleSearchResult} for result structure
 * @since 1.0.0
 */
export const searchExamples = (query: string, limit = 10): ExampleSearchResult[] => {
  const stmt = db.prepare(`
    SELECT
      e.id, e.export_name, e.title, e.description,
      fts.rank
    FROM examples_fts fts
    JOIN examples e ON e.id = fts.rowid
    WHERE examples_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `)

  return stmt.all(query, limit) as ExampleSearchResult[]
}

/**
 * Search patterns using full-text search.
 *
 * @param query - Search query string (FTS5 syntax supported)
 * @param limit - Maximum number of results to return
 * @returns Array of search results ordered by relevance
 *
 * @remarks
 * - Uses FTS5 MATCH for fast full-text search
 * - Searches name, title, description, problem, solution, code_example, and tags
 * - Results ordered by rank (lower rank = better match)
 *
 * @see {@link PatternSearchResult} for result structure
 * @since 1.0.0
 */
export const searchPatterns = (query: string, limit = 10): PatternSearchResult[] => {
  const stmt = db.prepare(`
    SELECT
      p.id, p.name, p.title, p.description,
      fts.rank
    FROM patterns_fts fts
    JOIN patterns p ON p.id = fts.rowid
    WHERE patterns_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `)

  return stmt.all(query, limit) as PatternSearchResult[]
}

/**
 * Get all examples for a specific export.
 *
 * @param exportName - The export name to filter by
 * @returns Array of examples for the specified export
 *
 * @remarks
 * - JSON strings automatically parsed back to arrays
 * - Returns all fields from examples table
 * - Ordered by created_at descending (newest first)
 *
 * @since 1.0.0
 */
export const getExamplesByExport = (exportName: string): ExampleData[] => {
  const stmt = db.prepare(`
    SELECT * FROM examples
    WHERE export_name = ?
    ORDER BY created_at DESC
  `)

  const rows = stmt.all(exportName) as unknown[]
  return rows.map((row: unknown) => parseExampleRow(row))
}

/**
 * Get a single pattern by name.
 *
 * @param name - The unique pattern name
 * @returns Pattern data or null if not found
 *
 * @remarks
 * - JSON strings automatically parsed back to arrays
 * - Returns all fields from patterns table
 *
 * @since 1.0.0
 */
export const getPattern = (name: string): PatternData | null => {
  const stmt = db.prepare(`
    SELECT * FROM patterns
    WHERE name = ?
  `)

  const row = stmt.get(name) as unknown
  return row ? parsePatternRow(row) : null
}

/**
 * List all patterns with optional filtering.
 *
 * @param options - Filter options
 * @param options.category - Filter by category
 * @param options.complexity - Filter by complexity level
 * @param options.mcp_tool_compatible - Filter by MCP compatibility
 * @returns Array of patterns matching the filters
 *
 * @remarks
 * - All filters are optional
 * - Multiple filters combined with AND logic
 * - Results ordered by created_at descending
 *
 * @since 1.0.0
 */
export const listPatterns = (options?: {
  category?: string
  complexity?: 'basic' | 'intermediate' | 'advanced'
  mcp_tool_compatible?: boolean
}): PatternData[] => {
  let query = 'SELECT * FROM patterns WHERE 1=1'
  const params: (string | number)[] = []

  if (options?.category) {
    query += ' AND category = ?'
    params.push(options.category)
  }

  if (options?.complexity) {
    query += ' AND complexity = ?'
    params.push(options.complexity)
  }

  if (options?.mcp_tool_compatible !== undefined) {
    query += ' AND mcp_tool_compatible = ?'
    params.push(options.mcp_tool_compatible ? 1 : 0)
  }

  query += ' ORDER BY created_at DESC'

  const stmt = db.prepare(query)
  const rows = (params.length > 0 ? stmt.all(...params) : stmt.all()) as unknown[]
  return rows.map((row: unknown) => parsePatternRow(row))
}

/**
 * List all examples with optional filtering.
 *
 * @param options - Filter options
 * @param options.module - Filter by module
 * @param options.category - Filter by category
 * @param options.complexity - Filter by complexity level
 * @param options.runtime_context - Filter by runtime context
 * @returns Array of examples matching the filters
 *
 * @remarks
 * - All filters are optional
 * - Multiple filters combined with AND logic
 * - Results ordered by created_at descending
 *
 * @since 1.0.0
 */
export const listExamples = (options?: {
  module?: 'main' | 'testing' | 'utils' | 'workshop'
  category?: string
  complexity?: 'basic' | 'intermediate' | 'advanced'
  runtime_context?: 'browser' | 'node' | 'worker' | 'any'
}): ExampleData[] => {
  let query = 'SELECT * FROM examples WHERE 1=1'
  const params: string[] = []

  if (options?.module) {
    query += ' AND module = ?'
    params.push(options.module)
  }

  if (options?.category) {
    query += ' AND category = ?'
    params.push(options.category)
  }

  if (options?.complexity) {
    query += ' AND complexity = ?'
    params.push(options.complexity)
  }

  if (options?.runtime_context) {
    query += ' AND runtime_context = ?'
    params.push(options.runtime_context)
  }

  query += ' ORDER BY created_at DESC'

  const stmt = db.prepare(query)
  const rows = (params.length > 0 ? stmt.all(...params) : stmt.all()) as unknown[]
  return rows.map((row: unknown) => parseExampleRow(row))
}

/**
 * @internal
 * Parse a database row into ExampleData structure.
 * Converts JSON strings back to arrays and INTEGER to boolean.
 */
const parseExampleRow = (row: unknown): ExampleData => {
  const r = row as Record<string, unknown>
  return {
    module: r.module as 'main' | 'testing' | 'utils' | 'workshop',
    export_name: r.export_name as string,
    category: r.category as string,
    title: r.title as string,
    description: r.description as string,
    code: r.code as string,
    dependencies: r.dependencies ? JSON.parse(r.dependencies as string) : undefined,
    runtime_context: r.runtime_context as 'browser' | 'node' | 'worker' | 'any' | undefined,
    mcp_tool_compatible: r.mcp_tool_compatible === 1,
    expected_output: r.expected_output as string | undefined,
    github_permalink: r.github_permalink as string | undefined,
    derived_from: r.derived_from as 'story' | 'test' | 'manual' | undefined,
    tags: r.tags ? JSON.parse(r.tags as string) : undefined,
    complexity: r.complexity as 'basic' | 'intermediate' | 'advanced' | undefined,
  }
}

/**
 * @internal
 * Parse a database row into PatternData structure.
 * Converts JSON strings back to arrays and INTEGER to boolean.
 */
const parsePatternRow = (row: unknown): PatternData => {
  const r = row as Record<string, unknown>
  return {
    name: r.name as string,
    category: r.category as string,
    title: r.title as string,
    description: r.description as string,
    problem: r.problem as string,
    solution: r.solution as string,
    code_example: r.code_example as string,
    use_cases: r.use_cases ? JSON.parse(r.use_cases as string) : undefined,
    anti_patterns: r.anti_patterns as string | undefined,
    related_patterns: r.related_patterns ? JSON.parse(r.related_patterns as string) : undefined,
    related_apis: r.related_apis ? JSON.parse(r.related_apis as string) : undefined,
    related_examples: r.related_examples ? JSON.parse(r.related_examples as string) : undefined,
    mcp_tool_compatible: r.mcp_tool_compatible === 1,
    expected_outcome: r.expected_outcome as string | undefined,
    github_permalink: r.github_permalink as string | undefined,
    reference_links: r.reference_links ? JSON.parse(r.reference_links as string) : undefined,
    maintainer_notes: r.maintainer_notes as string | undefined,
    tags: r.tags ? JSON.parse(r.tags as string) : undefined,
    complexity: r.complexity as 'basic' | 'intermediate' | 'advanced' | undefined,
  }
}

// Initialize database on module import
await initDB()
