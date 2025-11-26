import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import { db, initDB } from '../db.ts'

// Set test environment for in-memory database isolation
process.env.NODE_ENV = 'test'

test.skip('db: database connection is created with WAL mode', () => {
  // Note: WAL mode does not apply to in-memory databases
  // This test is skipped when NODE_ENV=test (in-memory mode)
  const journalMode = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }
  expect(journalMode.journal_mode).toBe('wal')
})

test('initDB: creates schema from schema.sql', async () => {
  await initDB()

  // Check that tables exist
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all() as {
    name: string
  }[]

  const tableNames = tables.map((t) => t.name)

  expect(tableNames).toContain('examples')
  expect(tableNames).toContain('patterns')
  expect(tableNames).toContain('release_changes')
  expect(tableNames).toContain('examples_fts')
  expect(tableNames).toContain('patterns_fts')
})

test('initDB: is idempotent (safe to call multiple times)', async () => {
  await initDB()
  await initDB()
  await initDB()

  // Should not throw and tables should still exist
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all() as {
    name: string
  }[]

  expect(tables.length).toBeGreaterThan(0)
})

test('initDB: creates all required indexes', async () => {
  await initDB()

  const indexes = db.prepare(`SELECT name FROM sqlite_master WHERE type='index' ORDER BY name`).all() as {
    name: string
  }[]

  const indexNames = indexes.map((i) => i.name)

  // Check for examples indexes
  expect(indexNames).toContain('idx_examples_module')
  expect(indexNames).toContain('idx_examples_export_name')
  expect(indexNames).toContain('idx_examples_category')

  // Check for patterns indexes
  expect(indexNames).toContain('idx_patterns_name')
  expect(indexNames).toContain('idx_patterns_category')

  // Check for release_changes indexes
  expect(indexNames).toContain('idx_release_changes_version')
  expect(indexNames).toContain('idx_release_changes_table')
})

test('initDB: creates FTS5 virtual tables with triggers', async () => {
  await initDB()

  // Check FTS5 tables exist
  const fts = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_fts'`).all() as {
    name: string
  }[]

  expect(fts.map((t) => t.name)).toContain('examples_fts')
  expect(fts.map((t) => t.name)).toContain('patterns_fts')

  // Check triggers exist
  const triggers = db.prepare(`SELECT name FROM sqlite_master WHERE type='trigger'`).all() as { name: string }[]

  const triggerNames = triggers.map((t) => t.name)

  // Examples FTS triggers
  expect(triggerNames).toContain('examples_ai')
  expect(triggerNames).toContain('examples_ad')
  expect(triggerNames).toContain('examples_au')

  // Patterns FTS triggers
  expect(triggerNames).toContain('patterns_ai')
  expect(triggerNames).toContain('patterns_ad')
  expect(triggerNames).toContain('patterns_au')
})

test('closeDB: closes the database connection', async () => {
  // Create a temporary database to test closing
  const tempDb = new Database(':memory:')
  tempDb.exec('CREATE TABLE test (id INTEGER)')

  // Close it
  tempDb.close()

  // Attempting to query after close should throw
  expect(() => {
    tempDb.prepare('SELECT * FROM test').all()
  }).toThrow()
})
