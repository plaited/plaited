/**
 * @internal
 * @module databases/db
 *
 * Purpose: Internal SQLite database connection for Plaited documentation storage
 * Architecture: Singleton database instance with lazy initialization
 * Dependencies: bun:sqlite
 * Consumers: src/workshop/queries.ts, src/workshop/changelog.ts
 *
 * Maintainer Notes:
 * - This module is NOT exported publicly via src/workshop.ts
 * - Database connection is reused across all query operations
 * - WAL mode enabled for better concurrency during reads/writes
 * - Schema initialization is idempotent (safe to call multiple times)
 *
 * Performance considerations:
 * - Database opened in readwrite mode for CLI operations
 * - Prepared statements created once and reused (see queries.ts)
 * - FTS5 indexes for fast full-text search
 *
 * Known limitations:
 * - Single database file for all documentation
 * - No connection pooling (not needed for CLI usage)
 */

import { Database } from 'bun:sqlite'

/**
 * @internal
 * Determines database path based on environment.
 * Returns :memory: for tests, examples.db for production.
 *
 * @returns Database path string
 *
 * @remarks
 * - Test environment: Returns ':memory:' for isolated in-memory database
 * - Production: Returns path to examples.db in databases directory
 * - Environment detected via NODE_ENV === 'test'
 */
const getDbPath = (): string => {
  // Test environment: use in-memory database
  if (process.env.NODE_ENV === 'test') {
    return ':memory:'
  }

  // Production: use committed database file
  return `${import.meta.dir}/examples.db`
}

/**
 * @internal
 * SQLite database connection for documentation storage.
 * Configured with WAL mode for better concurrency (production only).
 *
 * @remarks
 * - Test mode: Uses in-memory database (:memory:)
 * - Production: Uses examples.db with WAL journaling
 * - WAL mode not applied to in-memory databases
 */
export const db = new Database(getDbPath(), {
  create: true,
  readwrite: true,
})

// Enable Write-Ahead Logging for better concurrency (production only)
// Note: WAL mode may not apply to in-memory databases
if (process.env.NODE_ENV !== 'test') {
  db.exec('PRAGMA journal_mode = WAL')
}

/**
 * @internal
 * Initialize the database schema from schema.sql file.
 * This function is idempotent and safe to call multiple times.
 *
 * @returns Promise that resolves when schema is initialized
 *
 * @remarks
 * - Reads schema.sql from the same directory
 * - Creates tables, indexes, and FTS5 virtual tables
 * - Should be called before any database operations
 * - Safe to call multiple times (CREATE IF NOT EXISTS)
 */
export const initDB = async (): Promise<void> => {
  const schemaPath = `${import.meta.dir}/schema.sql`
  const schemaFile = Bun.file(schemaPath)

  if (!(await schemaFile.exists())) {
    throw new Error(`Schema file not found: ${schemaPath}`)
  }

  const schema = await schemaFile.text()
  db.exec(schema)
}

/**
 * @internal
 * Close the database connection.
 * Should be called when shutting down the CLI or completing operations.
 *
 * @remarks
 * - Flushes any pending writes
 * - Closes WAL file
 * - Should be called in CLI cleanup
 */
export const closeDB = (): void => {
  db.close()
}
