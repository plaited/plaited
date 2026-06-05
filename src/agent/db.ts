import { Database } from 'bun:sqlite'
import { mkdirSync, unlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { SnapshotMessage } from '../behavioral.ts'
import type { AttrsMessage, DisconnectMessage, ImportModuleMessage, RenderMessage } from '../shared/shared.schemas.ts'

const DB_PATH = '.plaited/context.sqlite'

let db: Database | undefined

const getDbPath = () => resolve(process.cwd(), DB_PATH)

const ensureDbDir = () => {
  const dir = dirname(getDbPath())
  mkdirSync(dir, { recursive: true })
}

/** @internal Close connection, delete file, and reset singleton. For tests only. */
export const resetDb = () => {
  if (db) {
    db.close()
    db = undefined
  }
  try {
    unlinkSync(getDbPath())
  } catch {
    // file may not exist
  }
}

// bun-types has a spread inference bug in Database.run and Statement.get/all/run.
// These wrappers bypass the broken generic inference while preserving runtime behavior.
// https://github.com/oven-sh/bun/issues/XXXXX
const sqlRun = (database: Database, sql: string, ...params: unknown[]) =>
  (
    database.run as unknown as (
      sql: string,
      ...params: unknown[]
    ) => { changes: number; lastInsertRowid: number | bigint }
  )(sql, ...params)

const sqlQuery = <R>(database: Database, sql: string) =>
  database.query(sql) as unknown as {
    get: (...params: unknown[]) => R | null
    all: (...params: unknown[]) => R[]
    run: (...params: unknown[]) => { changes: number; lastInsertRowid: number | bigint }
  }

const initSchema = (database: Database) => {
  sqlRun(
    database,
    `
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      memory TEXT CHECK(length(memory) <= 2200),
      user TEXT CHECK(length(user) <= 1375),
      created_at INTEGER DEFAULT (unixepoch())
    )
  `,
  )

  sqlRun(
    database,
    `
    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      version TEXT,
      path TEXT NOT NULL,
      type TEXT CHECK(type IN ('workspace', 'npm')) NOT NULL,
      discovered_at INTEGER,
      last_modified INTEGER
    )
  `,
  )

  sqlRun(
    database,
    `
    CREATE TABLE IF NOT EXISTS package_exports (
      id INTEGER PRIMARY KEY,
      package_id INTEGER REFERENCES packages(id),
      export_type TEXT CHECK(export_type IN ('behaviors', 'templates', 'skills')) NOT NULL,
      file_path TEXT,
      name TEXT
    )
  `,
  )

  sqlRun(
    database,
    `
    CREATE TABLE IF NOT EXISTS topic_packages (
      topic_id TEXT REFERENCES topics(id),
      package_id INTEGER REFERENCES packages(id),
      loaded_at INTEGER,
      PRIMARY KEY (topic_id, package_id)
    )
  `,
  )

  sqlRun(
    database,
    `
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY,
      export_id INTEGER REFERENCES package_exports(id),
      name TEXT NOT NULL,
      scale TEXT,
      input_schema TEXT,
      file_path TEXT
    )
  `,
  )

  sqlRun(
    database,
    `
    CREATE TABLE IF NOT EXISTS behaviors (
      id INTEGER PRIMARY KEY,
      export_id INTEGER REFERENCES package_exports(id),
      name TEXT NOT NULL,
      events TEXT,
      file_path TEXT
    )
  `,
  )

  sqlRun(
    database,
    `
    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY,
      export_id INTEGER REFERENCES package_exports(id),
      name TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      frontmatter TEXT,
      file_path TEXT
    )
  `,
  )

  sqlRun(
    database,
    `
    CREATE TABLE IF NOT EXISTS bp_snapshots (
      id INTEGER PRIMARY KEY,
      topic_id TEXT REFERENCES topics(id),
      kind TEXT CHECK(kind IN ('frontier', 'selection', 'deadlock', 'feedback_error')) NOT NULL,
      step INTEGER,
      data TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    )
  `,
  )

  sqlRun(
    database,
    `
    CREATE TABLE IF NOT EXISTS ui_events (
      id INTEGER PRIMARY KEY,
      topic_id TEXT REFERENCES topics(id),
      type TEXT CHECK(type IN ('render', 'attrs', 'import', 'disconnect')) NOT NULL,
      version TEXT,
      target TEXT,
      html TEXT,
      swap TEXT,
      attr TEXT,
      registry TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    )
  `,
  )
}

const getDb = (): Database => {
  if (db) return db
  ensureDbDir()
  db = new Database(getDbPath(), { create: true })
  initSchema(db)
  return db
}

export const recordSnapshot = (topicId: string, message: SnapshotMessage) => {
  const database = getDb()
  sqlRun(
    database,
    'INSERT INTO bp_snapshots (topic_id, kind, step, data) VALUES (?, ?, ?, ?)',
    topicId,
    message.kind,
    'step' in message ? message.step : null,
    JSON.stringify(message),
  )
}

export type UiEventType = 'render' | 'attrs' | 'import' | 'disconnect'

export const recordUiEvent = (
  topicId: string,
  type: UiEventType,
  event: RenderMessage | AttrsMessage | ImportModuleMessage | DisconnectMessage,
) => {
  const database = getDb()
  const detail = 'detail' in event ? (event.detail as Record<string, unknown>) : undefined
  sqlRun(
    database,
    'INSERT INTO ui_events (topic_id, type, version, target, html, swap, attr, registry) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    topicId,
    type,
    (detail?.version as string | undefined) ?? null,
    detail && 'target' in detail ? (detail.target as string) : null,
    detail && 'html' in detail ? (detail.html as string) : null,
    detail && 'swap' in detail ? (detail.swap as string) : null,
    detail && 'attr' in detail ? JSON.stringify(detail.attr) : null,
    detail && 'registry' in detail ? JSON.stringify(detail.registry) : null,
  )
}

type UpsertTopicArgs = {
  id: string
  name?: string
  description?: string
  memory?: string
  user?: string
}

export const upsertTopic = ({ id, name, description, memory, user }: UpsertTopicArgs) => {
  const database = getDb()
  const existing = sqlQuery<{ '1': number }>(database, 'SELECT 1 FROM topics WHERE id = ?').get(id)
  if (existing) {
    const sets: string[] = []
    const values: (string | null)[] = []
    if (name !== undefined) {
      sets.push('name = ?')
      values.push(name)
    }
    if (description !== undefined) {
      sets.push('description = ?')
      values.push(description)
    }
    if (memory !== undefined) {
      sets.push('memory = ?')
      values.push(memory)
    }
    if (user !== undefined) {
      sets.push('user = ?')
      values.push(user)
    }
    if (sets.length === 0) return
    sqlRun(database, `UPDATE topics SET ${sets.join(', ')} WHERE id = ?`, ...values, id)
  } else {
    sqlRun(
      database,
      'INSERT INTO topics (id, name, description, memory, user) VALUES (?, ?, ?, ?, ?)',
      id,
      name ?? null,
      description ?? null,
      memory ?? null,
      user ?? null,
    )
  }
}

export type PackageMetadata = {
  name: string
  version?: string
  path: string
  type: 'workspace' | 'npm'
  exports: {
    behaviors?: Array<{ name: string; filePath: string; events?: string[] }>
    templates?: Array<{ name: string; filePath: string; scale?: string; inputSchema?: string }>
    skills?: Array<{ name: string; filePath: string; description?: string; tags?: string[]; frontmatter?: unknown }>
  }
}

export const upsertPackages = (packages: PackageMetadata[]) => {
  const database = getDb()
  const tx = database.transaction(() => {
    for (const pkg of packages) {
      sqlRun(
        database,
        `INSERT INTO packages (name, version, path, type, discovered_at, last_modified)
         VALUES (?, ?, ?, ?, unixepoch(), unixepoch())
         ON CONFLICT(name) DO UPDATE SET
           version = excluded.version,
           path = excluded.path,
           type = excluded.type,
           last_modified = unixepoch()`,
        pkg.name,
        pkg.version ?? null,
        pkg.path,
        pkg.type,
      )

      const row = sqlQuery<{ id: number }>(database, 'SELECT id FROM packages WHERE name = ?').get(pkg.name)
      if (!row) continue
      const packageId = row.id

      sqlRun(database, 'DELETE FROM package_exports WHERE package_id = ?', packageId)
      sqlRun(
        database,
        'DELETE FROM templates WHERE export_id IN (SELECT id FROM package_exports WHERE package_id = ?)',
        packageId,
      )
      sqlRun(
        database,
        'DELETE FROM behaviors WHERE export_id IN (SELECT id FROM package_exports WHERE package_id = ?)',
        packageId,
      )
      sqlRun(
        database,
        'DELETE FROM skills WHERE export_id IN (SELECT id FROM package_exports WHERE package_id = ?)',
        packageId,
      )

      for (const exportType of ['behaviors', 'templates', 'skills'] as const) {
        const items = pkg.exports[exportType]
        if (!items) continue
        for (const item of items) {
          sqlRun(
            database,
            'INSERT INTO package_exports (package_id, export_type, file_path, name) VALUES (?, ?, ?, ?)',
            packageId,
            exportType,
            item.filePath,
            item.name,
          )
          const exportRow = sqlQuery<{ id: number }>(
            database,
            'SELECT id FROM package_exports WHERE package_id = ? AND export_type = ? AND name = ?',
          ).get(packageId, exportType, item.name)
          if (!exportRow) continue
          const exportId = exportRow.id

          if (exportType === 'behaviors' && 'events' in item) {
            sqlRun(
              database,
              'INSERT INTO behaviors (export_id, name, events, file_path) VALUES (?, ?, ?, ?)',
              exportId,
              item.name,
              item.events ? JSON.stringify(item.events) : null,
              item.filePath,
            )
          }
          if (exportType === 'templates' && 'scale' in item) {
            sqlRun(
              database,
              'INSERT INTO templates (export_id, name, scale, input_schema, file_path) VALUES (?, ?, ?, ?, ?)',
              exportId,
              item.name,
              item.scale ?? null,
              item.inputSchema ?? null,
              item.filePath,
            )
          }
          if (exportType === 'skills' && 'frontmatter' in item) {
            sqlRun(
              database,
              'INSERT INTO skills (export_id, name, description, tags, frontmatter, file_path) VALUES (?, ?, ?, ?, ?, ?)',
              exportId,
              item.name,
              item.description ?? null,
              item.tags ? JSON.stringify(item.tags) : null,
              item.frontmatter ? JSON.stringify(item.frontmatter) : null,
              item.filePath,
            )
          }
        }
      }
    }
  })
  tx()
}

export const linkTopicPackage = (topicId: string, packageId: number) => {
  const database = getDb()
  sqlRun(
    database,
    'INSERT INTO topic_packages (topic_id, package_id, loaded_at) VALUES (?, ?, unixepoch()) ON CONFLICT DO NOTHING',
    topicId,
    packageId,
  )
}

export type SnapshotQueryOptions = {
  since?: number
  limit?: number
  kinds?: Array<'frontier' | 'selection' | 'deadlock' | 'feedback_error'>
}

export const querySnapshots = (topicId: string, options: SnapshotQueryOptions = {}) => {
  const database = getDb()
  const conditions = ['topic_id = ?']
  const values: (string | number)[] = [topicId]

  if (options.since !== undefined) {
    conditions.push('created_at > ?')
    values.push(options.since)
  }
  if (options.kinds !== undefined && options.kinds.length > 0) {
    conditions.push(`kind IN (${options.kinds.map(() => '?').join(', ')})`)
    values.push(...options.kinds)
  }

  const limitClause = options.limit === undefined ? '' : `LIMIT ${options.limit}`
  const sql = `SELECT data FROM bp_snapshots WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC ${limitClause}`

  const rows = sqlQuery<{ data: string }>(database, sql).all(...values)
  return rows.map((row) => JSON.parse(row.data) as SnapshotMessage)
}

export const getTopicContext = (id: string): { memory: string | null; user: string | null } | undefined => {
  const database = getDb()
  const row = sqlQuery<{ memory: string | null; user: string | null }>(
    database,
    'SELECT memory, user FROM topics WHERE id = ?',
  ).get(id)
  return row ?? undefined
}

export const pruneSnapshots = (threshold: { maxAgeMs?: number; maxRows?: number }) => {
  const database = getDb()
  if (threshold.maxAgeMs !== undefined) {
    const cutoff = Math.floor((Date.now() - threshold.maxAgeMs) / 1000)
    sqlRun(database, 'DELETE FROM bp_snapshots WHERE created_at < ?', cutoff)
  }
  if (threshold.maxRows !== undefined) {
    sqlRun(
      database,
      `DELETE FROM bp_snapshots WHERE id IN (
        SELECT id FROM bp_snapshots ORDER BY created_at DESC LIMIT -1 OFFSET ?
      )`,
      threshold.maxRows,
    )
  }
}
