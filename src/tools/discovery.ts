/**
 * Agent-facing discovery store — CRUD + search over a unified catalog of
 * remote MCP tools and local skills.
 *
 * @remarks
 * Backs the search-mediated progressive-disclosure loop: a kernel behavioral
 * thread populates the store via this tool (create/update) from `mcp-client
 * discover` / `skill-client discover` results, then searches it (tier 1) to
 * surface candidates to the model; the model picks and loads tier-2/tier-3
 * content through the relevant client tool. This tool is the dumb primitive;
 * the smarts live in the thread.
 *
 * Backed by `.plaited/discovery.sqlite` via `bun:sqlite`. Unified rows:
 * `kind ∈ {'mcp-tool','skill'}`, `id`, `name`, `description`, `handle`
 * (server-url for mcp-tool, SKILL.md path for skill), `metadata_json`
 * (inputSchema for mcp-tool, frontmatter for skill), `updated_at`.
 *
 * **The only tool that touches the store file.** Population/refresh/search are
 * kernel-thread policy via this tool, not adapter provisioning. Not git-backed
 * — local SQLite, regenerable (re-scan filesystem, re-discover servers).
 *
 * `dbPath` is **provisioner-injected, not model-facing**: the provisioner
 * resolves `.plaited/discovery.sqlite` against the project root and injects it
 * at tool construction (see {@link createDiscoveryTool}). The model never
 * chooses it — a model-supplied `dbPath` is rejected at the schema boundary
 * (`additionalProperties: false`, no `dbPath` field). This is the one deviation
 * from "takes a path like the other file tools": the other file tools take a
 * path relative to a provisioned `cwd`, not an absolute store path.
 *
 * MINIMAL: search is case-insensitive LIKE over name + description, not FTS5.
 * Upgrade path: an FTS5 virtual table over name/description for ranking and
 * prefix matching once the catalog grows beyond LIKE's usefulness.
 *
 * @packageDocumentation
 */

import { Database } from 'bun:sqlite'
import * as path from 'node:path'
import type { JSONSchemaType } from 'ajv'
import { useTool } from './use-tool.ts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiscoveryKind = 'mcp-tool' | 'skill'

type DiscoveryRow = {
  id: string
  kind: DiscoveryKind
  name: string
  description: string
  handle: string
  metadata: Record<string, unknown> | null
  updated_at: number
}

export type DiscoveryInput =
  | {
      mode: 'create'
      kind: DiscoveryKind
      name: string
      description: string
      handle: string
      metadata?: Record<string, unknown>
    }
  | { mode: 'read'; id: string }
  | {
      mode: 'update'
      id: string
      name?: string
      description?: string
      handle?: string
      metadata?: Record<string, unknown>
    }
  | { mode: 'delete'; id: string }
  | { mode: 'search'; query: string; kind?: DiscoveryKind; limit?: number }

export type DiscoveryOutput =
  | { mode: 'create'; row: DiscoveryRow }
  | { mode: 'read'; row: DiscoveryRow | null }
  | { mode: 'update'; row: DiscoveryRow | null; isError?: boolean; message?: string }
  | { mode: 'delete'; deleted: boolean }
  | { mode: 'search'; rows: DiscoveryRow[] }

// ---------------------------------------------------------------------------
// Tool JSON schemas — hand-written oneOf on `mode`, cast through `unknown`
// as JSONSchemaType (discriminated unions exceed its static power; read.ts /
// frontier.ts / mcp-client.ts / skill-client.ts precedent). AJV validates at
// runtime. `dbPath` is deliberately absent — it is provisioner-injected, so a
// model-supplied `dbPath` is rejected by `additionalProperties: false`.
// ---------------------------------------------------------------------------

const kindJsonSchema = { type: 'string', enum: ['mcp-tool', 'skill'] } as const
const metadataJsonSchema = {
  type: 'object',
  additionalProperties: true,
  nullable: true,
  description: 'metadata blob — inputSchema for mcp-tool, frontmatter for skill',
} as const

export const DiscoveryInputSchema = {
  type: 'object',
  oneOf: [
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'create' },
        kind: kindJsonSchema,
        name: { type: 'string', minLength: 1, description: 'tool or skill name' },
        description: { type: 'string', description: 'short description for tier-1 search' },
        handle: {
          type: 'string',
          minLength: 1,
          description: 'server-url for mcp-tool, SKILL.md path for skill',
        },
        metadata: metadataJsonSchema,
      },
      required: ['mode', 'kind', 'name', 'description', 'handle'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'read' },
        id: { type: 'string', minLength: 1, description: 'row id' },
      },
      required: ['mode', 'id'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'update' },
        id: { type: 'string', minLength: 1, description: 'row id' },
        name: { type: 'string', nullable: true, description: 'new name' },
        description: { type: 'string', nullable: true, description: 'new description' },
        handle: { type: 'string', nullable: true, description: 'new handle' },
        metadata: metadataJsonSchema,
      },
      required: ['mode', 'id'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'delete' },
        id: { type: 'string', minLength: 1, description: 'row id' },
      },
      required: ['mode', 'id'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'search' },
        query: { type: 'string', description: 'substring to match against name and description (empty = all)' },
        kind: { ...kindJsonSchema, nullable: true, description: 'optional kind filter' },
        limit: { type: 'integer', minimum: 1, nullable: true, description: 'max results (default 100)' },
      },
      required: ['mode', 'query'],
      additionalProperties: false,
    },
  ],
  description:
    'Discovery store CRUD + search over a unified catalog of remote MCP tools and local skills. dbPath is provisioner-injected (not accepted here).',
} as unknown as JSONSchemaType<DiscoveryInput>

export const DiscoveryOutputSchema = {
  type: 'object',
  oneOf: [
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'create' },
        row: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            kind: { type: 'string', enum: ['mcp-tool', 'skill'] },
            name: { type: 'string' },
            description: { type: 'string' },
            handle: { type: 'string' },
            metadata: { type: 'object', additionalProperties: true, nullable: true },
            updated_at: { type: 'integer' },
          },
          required: ['id', 'kind', 'name', 'description', 'handle', 'updated_at'],
          additionalProperties: false,
        },
      },
      required: ['mode', 'row'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'read' },
        row: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            kind: { type: 'string', enum: ['mcp-tool', 'skill'] },
            name: { type: 'string' },
            description: { type: 'string' },
            handle: { type: 'string' },
            metadata: { type: 'object', additionalProperties: true, nullable: true },
            updated_at: { type: 'integer' },
          },
          required: ['id', 'kind', 'name', 'description', 'handle', 'updated_at'],
          additionalProperties: false,
          nullable: true,
        },
      },
      required: ['mode', 'row'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'update' },
        row: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            kind: { type: 'string', enum: ['mcp-tool', 'skill'] },
            name: { type: 'string' },
            description: { type: 'string' },
            handle: { type: 'string' },
            metadata: { type: 'object', additionalProperties: true, nullable: true },
            updated_at: { type: 'integer' },
          },
          required: ['id', 'kind', 'name', 'description', 'handle', 'updated_at'],
          additionalProperties: false,
          nullable: true,
        },
        isError: { type: 'boolean', nullable: true },
        message: { type: 'string', nullable: true },
      },
      required: ['mode', 'row'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'delete' },
        deleted: { type: 'boolean', description: 'true when a row was removed' },
      },
      required: ['mode', 'deleted'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        mode: { type: 'string', const: 'search' },
        rows: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              kind: { type: 'string', enum: ['mcp-tool', 'skill'] },
              name: { type: 'string' },
              description: { type: 'string' },
              handle: { type: 'string' },
              metadata: { type: 'object', additionalProperties: true, nullable: true },
              updated_at: { type: 'integer' },
            },
            required: ['id', 'kind', 'name', 'description', 'handle', 'updated_at'],
            additionalProperties: false,
          },
        },
      },
      required: ['mode', 'rows'],
      additionalProperties: false,
    },
  ],
  description: 'Discovery operation result, discriminated by mode.',
} as unknown as JSONSchemaType<DiscoveryOutput>

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DISCOVERY_TOOL_NAME = 'discovery'
const DEFAULT_SEARCH_LIMIT = 100

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS discovery (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('mcp-tool','skill')),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  handle TEXT NOT NULL,
  metadata_json TEXT,
  updated_at INTEGER NOT NULL
)
`

// ---------------------------------------------------------------------------
// Row (de)serialization
// ---------------------------------------------------------------------------

type StoredRow = {
  id: string
  kind: DiscoveryKind
  name: string
  description: string
  handle: string
  metadata_json: string | null
  updated_at: number
}

const toDiscoveryRow = (row: StoredRow): DiscoveryRow => {
  let metadata: Record<string, unknown> | null = null
  if (row.metadata_json) {
    try {
      const parsed = JSON.parse(row.metadata_json)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        metadata = parsed as Record<string, unknown>
      }
    } catch {
      metadata = null
    }
  }
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    description: row.description,
    handle: row.handle,
    metadata,
    updated_at: row.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Tool factory — dbPath is provisioner-injected, never model-facing
// ---------------------------------------------------------------------------

export type DiscoveryTool = ReturnType<typeof useTool<DiscoveryInput, DiscoveryOutput>>

/**
 * Build a provisioned discovery tool bound to `dbPath`. The provisioner
 * resolves `.plaited/discovery.sqlite` against the project root and injects
 * it here; the model never supplies a `dbPath` (rejected at the schema
 * boundary). Returns a {@link useTool}-shaped function ready to register.
 */
export const createDiscoveryTool = ({ dbPath }: { dbPath: string }): DiscoveryTool => {
  // Lazy-open the SQLite connection on first use so constructing the tool
  // (at provision time) never touches the filesystem. One connection per
  // provisioned instance, reused across calls — this tool is the only writer.
  let db: Database | undefined

  const getDb = async (): Promise<Database> => {
    if (db) return db
    // bun:sqlite creates the file but not its parent directory — ensure the
    // store dir exists before opening (mirrors the `write` tool's mkdir -p).
    await Bun.$`mkdir -p ${path.dirname(dbPath)}`.quiet().nothrow()
    const next = new Database(dbPath)
    next.exec(CREATE_TABLE_SQL)
    db = next
    return next
  }

  const run = async (input: DiscoveryInput): Promise<DiscoveryOutput> => {
    const database = await getDb()
    switch (input.mode) {
      case 'create': {
        const id = crypto.randomUUID()
        const updatedAt = Date.now()
        const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null
        database
          .prepare(
            'INSERT INTO discovery (id, kind, name, description, handle, metadata_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          )
          .run(id, input.kind, input.name, input.description, input.handle, metadataJson, updatedAt)
        const row = toDiscoveryRow(database.prepare('SELECT * FROM discovery WHERE id = ?').get(id) as StoredRow)
        return { mode: 'create', row }
      }
      case 'read': {
        const stored = database.prepare('SELECT * FROM discovery WHERE id = ?').get(input.id) as StoredRow | null
        return { mode: 'read', row: stored ? toDiscoveryRow(stored) : null }
      }
      case 'update': {
        const existing = database.prepare('SELECT * FROM discovery WHERE id = ?').get(input.id) as StoredRow | null
        if (!existing) {
          return { mode: 'update', row: null, isError: true, message: `No discovery row with id ${input.id}` }
        }
        const next: StoredRow = {
          ...existing,
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.handle === undefined ? {} : { handle: input.handle }),
          ...(input.metadata === undefined ? {} : { metadata_json: JSON.stringify(input.metadata) }),
          updated_at: Date.now(),
        }
        database
          .prepare(
            'UPDATE discovery SET name = ?, description = ?, handle = ?, metadata_json = ?, updated_at = ? WHERE id = ?',
          )
          .run(next.name, next.description, next.handle, next.metadata_json, next.updated_at, next.id)
        return { mode: 'update', row: toDiscoveryRow(next) }
      }
      case 'delete': {
        const result = database.prepare('DELETE FROM discovery WHERE id = ?').run(input.id)
        return { mode: 'delete', deleted: result.changes > 0 }
      }
      case 'search': {
        const limit = input.limit ?? DEFAULT_SEARCH_LIMIT
        // Case-insensitive LIKE over name + description. An empty query matches
        // all rows (tier-1 catalog). LIKE is case-insensitive for ASCII by
        // default; LOWER() covers non-ASCII consistently.
        let sql = 'SELECT * FROM discovery WHERE (LOWER(name) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?))'
        const params: (string | number)[] = [`%${input.query}%`, `%${input.query}%`]
        if (input.kind) {
          sql += ' AND kind = ?'
          params.push(input.kind)
        }
        sql += ' ORDER BY name ASC LIMIT ?'
        params.push(limit)
        const rows = database.prepare(sql).all(...params) as StoredRow[]
        return { mode: 'search', rows: rows.map(toDiscoveryRow) }
      }
    }
  }

  return useTool<DiscoveryInput, DiscoveryOutput>(
    {
      name: DISCOVERY_TOOL_NAME,
      description:
        'CRUD + search over a unified catalog of remote MCP tools and local ' +
        'skills, backed by a local SQLite store. The model searches (tier 1) ' +
        'to find candidates, then loads full content via mcp-client / ' +
        'skill-client. dbPath is provisioner-injected — never supplied here.',
      inputSchema: DiscoveryInputSchema,
      outputSchema: DiscoveryOutputSchema,
    },
    run,
  )
}
