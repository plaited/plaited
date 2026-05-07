import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { closeKanbanDatabase, openKanbanDatabase } from '../kanban.ts'

const REQUIRED_TABLES = [
  'requests',
  'work_items',
  'work_item_dependencies',
  'discovery_artifacts',
  'gate_decisions',
  'gate_decision_failures',
  'check_runs',
  'work_item_events',
]

describe('kanban database migrations', () => {
  test('creates the foundational orchestration tables', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-db-'))
    const dbPath = join(tempDir, 'kanban.sqlite')
    let db: Awaited<ReturnType<typeof openKanbanDatabase>> | undefined

    try {
      db = await openKanbanDatabase({ dbPath })

      const tableRows = db
        .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all()
      const tableNames = new Set(tableRows.map((row) => row.name))

      for (const tableName of REQUIRED_TABLES) {
        expect(tableNames.has(tableName)).toBeTrue()
      }
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('enforces FK/index scaffolding and append-only work_item_events', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-db-'))
    const dbPath = join(tempDir, 'kanban.sqlite')
    let db: Awaited<ReturnType<typeof openKanbanDatabase>> | undefined

    try {
      db = await openKanbanDatabase({ dbPath })

      const fkRows = db
        .query<{ table: string; from: string; to: string }, []>("PRAGMA foreign_key_list('work_items')")
        .all()
      expect(fkRows.some((row) => row.table === 'requests' && row.from === 'request_id' && row.to === 'id')).toBeTrue()

      const dependencyFkRows = db
        .query<{ table: string; from: string; to: string }, []>("PRAGMA foreign_key_list('work_item_dependencies')")
        .all()
      expect(
        dependencyFkRows.some((row) => row.table === 'work_items' && row.from === 'work_item_id' && row.to === 'id'),
      ).toBeTrue()
      expect(
        dependencyFkRows.some(
          (row) => row.table === 'work_items' && row.from === 'depends_on_work_item_id' && row.to === 'id',
        ),
      ).toBeTrue()

      const indexRows = db
        .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'")
        .all()
      const indexNames = new Set(indexRows.map((row) => row.name))

      expect(indexNames.has('idx_work_items_request_id')).toBeTrue()
      expect(indexNames.has('idx_work_item_dependencies_work_item_id')).toBeTrue()
      expect(indexNames.has('idx_work_item_dependencies_depends_on_work_item_id')).toBeTrue()
      expect(indexNames.has('idx_work_item_events_work_item_id')).toBeTrue()

      db.query(
        `INSERT INTO requests (
          id,
          summary,
          status,
          requested_by_actor_type,
          requested_by_actor_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run('req-1', 'request summary', 'new', 'user', 'user-1', '2026-05-05T00:00:00.000Z', '2026-05-05T00:00:00.000Z')
      db.query(
        'INSERT INTO work_items (id, request_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run('item-1', 'req-1', 'item title', 'draft', '2026-05-05T00:00:00.000Z', '2026-05-05T00:00:00.000Z')
      db.query(
        'INSERT INTO work_item_events (id, work_item_id, event_kind, payload_json, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(
        'evt-1',
        'item-1',
        'created',
        JSON.stringify({ message: 'hello' }),
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      expect(() =>
        db?.query('UPDATE work_item_events SET work_item_id = ? WHERE id = ?').run('item-1', 'evt-1'),
      ).toThrow()
      expect(() => db?.query('DELETE FROM work_item_events WHERE id = ?').run('evt-1')).toThrow()
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('allows parent lifecycle FK actions to apply to work_item_events', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-db-'))
    const dbPath = join(tempDir, 'kanban.sqlite')
    let db: Awaited<ReturnType<typeof openKanbanDatabase>> | undefined

    try {
      db = await openKanbanDatabase({ dbPath })

      db.query(
        `INSERT INTO requests (
          id,
          summary,
          status,
          requested_by_actor_type,
          requested_by_actor_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'req-parent',
        'parent request',
        'new',
        'user',
        'user-parent',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        'INSERT INTO work_items (id, request_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run('item-delete', 'req-parent', 'item delete', 'draft', '2026-05-05T00:00:00.000Z', '2026-05-05T00:00:00.000Z')
      db.query(
        'INSERT INTO work_items (id, request_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run('item-update', 'req-parent', 'item update', 'draft', '2026-05-05T00:00:00.000Z', '2026-05-05T00:00:00.000Z')
      db.query(
        'INSERT INTO work_item_events (id, work_item_id, event_kind, payload_json, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(
        'evt-delete',
        'item-delete',
        'created',
        JSON.stringify({ message: 'delete path' }),
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        'INSERT INTO work_item_events (id, work_item_id, event_kind, payload_json, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(
        'evt-update',
        'item-update',
        'created',
        JSON.stringify({ message: 'update path' }),
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      expect(() => db?.query('DELETE FROM work_items WHERE id = ?').run('item-delete')).not.toThrow()
      const deletedEventCount = db
        .query<{ total: number }, [string]>('SELECT COUNT(*) AS total FROM work_item_events WHERE id = ?')
        .get('evt-delete')
      expect(deletedEventCount?.total).toBe(0)

      expect(() =>
        db?.query('UPDATE work_items SET id = ? WHERE id = ?').run('item-update-renamed', 'item-update'),
      ).not.toThrow()
      const updatedEvent = db
        .query<{ work_item_id: string }, [string]>('SELECT work_item_id FROM work_item_events WHERE id = ?')
        .get('evt-update')
      expect(updatedEvent?.work_item_id).toBe('item-update-renamed')
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('stores discovery and gate decision audit records with constraint guards', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-db-'))
    const dbPath = join(tempDir, 'kanban.sqlite')
    let db: Awaited<ReturnType<typeof openKanbanDatabase>> | undefined

    try {
      db = await openKanbanDatabase({ dbPath })

      const discoveryColumns = db
        .query<{ name: string }, []>("PRAGMA table_info('discovery_artifacts')")
        .all()
        .map((row) => row.name)

      expect(discoveryColumns).toContain('rules')
      expect(discoveryColumns).toContain('examples')
      expect(discoveryColumns).toContain('open_questions')
      expect(discoveryColumns).toContain('out_of_scope')

      db.query(
        `INSERT INTO requests (
          id,
          summary,
          status,
          requested_by_actor_type,
          requested_by_actor_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'req-2',
        'another request',
        'new',
        'system',
        'planner',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        'INSERT INTO work_items (id, request_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run('item-2', 'req-2', 'item two', 'red_pending', '2026-05-05T00:00:00.000Z', '2026-05-05T00:00:00.000Z')

      db.query(
        `INSERT INTO discovery_artifacts (
          id,
          work_item_id,
          artifact_version,
          rules,
          examples,
          open_questions,
          out_of_scope,
          collected_at,
          stale_after_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'disc-1',
        'item-2',
        1,
        JSON.stringify([{ id: 'rule-1', text: 'always gather evidence' }]),
        JSON.stringify([{ id: 'example-1', text: 'failing test first' }]),
        JSON.stringify([{ id: 'question-1', text: 'is merge gate required?' }]),
        JSON.stringify([{ id: 'scope-1', text: 'do not rewrite CLI yet' }]),
        '2026-05-05T00:00:00.000Z',
        '2026-05-06T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      db.query(
        `INSERT INTO gate_decisions (
          id,
          work_item_id,
          gate_name,
          decision,
          actor_type,
          actor_id,
          reason,
          discovery_artifact_id,
          decided_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'gate-1',
        'item-2',
        'red_approval',
        'approved',
        'agent',
        'coder',
        'red test evidence and discovery are sufficient',
        'disc-1',
        '2026-05-05T00:05:00.000Z',
        '2026-05-05T00:05:00.000Z',
      )

      db.query(
        `INSERT INTO gate_decision_evidence_cache_refs (
          gate_decision_id,
          context_db_path,
          evidence_cache_row_id
        ) VALUES (?, ?, ?)`,
      ).run('gate-1', '.plaited/context.sqlite', 7)

      const gateRow = db
        .query<{ actor_type: string; actor_id: string; reason: string; decided_at: string }, [string]>(
          'SELECT actor_type, actor_id, reason, decided_at FROM gate_decisions WHERE id = ?',
        )
        .get('gate-1')
      expect(gateRow?.actor_type).toBe('agent')
      expect(gateRow?.actor_id).toBe('coder')
      expect(gateRow?.reason).toContain('discovery')
      expect(gateRow?.decided_at).toBe('2026-05-05T00:05:00.000Z')

      const evidenceRefs = db
        .query<{ context_db_path: string; evidence_cache_row_id: number }, [string]>(
          'SELECT context_db_path, evidence_cache_row_id FROM gate_decision_evidence_cache_refs WHERE gate_decision_id = ?',
        )
        .all('gate-1')
      expect(evidenceRefs).toEqual([{ context_db_path: '.plaited/context.sqlite', evidence_cache_row_id: 7 }])

      expect(() =>
        db
          ?.query(
            `INSERT INTO discovery_artifacts (
              id,
              work_item_id,
              artifact_version,
              rules,
              examples,
              open_questions,
              out_of_scope,
              collected_at,
              stale_after_at,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            'disc-2',
            'item-2',
            2,
            JSON.stringify([]),
            JSON.stringify([]),
            JSON.stringify([]),
            JSON.stringify([]),
            '2026-05-06T00:00:00.000Z',
            '2026-05-05T00:00:00.000Z',
            '2026-05-05T00:00:00.000Z',
            '2026-05-05T00:00:00.000Z',
          ),
      ).toThrow()
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('rejects malformed discovery artifact timestamps', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-db-'))
    const dbPath = join(tempDir, 'kanban.sqlite')
    let db: Awaited<ReturnType<typeof openKanbanDatabase>> | undefined

    try {
      db = await openKanbanDatabase({ dbPath })

      db.query(
        `INSERT INTO requests (
          id,
          summary,
          status,
          requested_by_actor_type,
          requested_by_actor_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run('req-3', 'request three', 'new', 'user', 'user-3', '2026-05-05T00:00:00.000Z', '2026-05-05T00:00:00.000Z')
      db.query(
        'INSERT INTO work_items (id, request_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run('item-3', 'req-3', 'item three', 'red_pending', '2026-05-05T00:00:00.000Z', '2026-05-05T00:00:00.000Z')

      expect(() =>
        db
          ?.query(
            `INSERT INTO discovery_artifacts (
              id,
              work_item_id,
              artifact_version,
              rules,
              examples,
              open_questions,
              out_of_scope,
              collected_at,
              stale_after_at,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            'disc-bad-1',
            'item-3',
            1,
            JSON.stringify([]),
            JSON.stringify([]),
            JSON.stringify([]),
            JSON.stringify([]),
            'not-a-date',
            'still-not-a-date',
            '2026-05-05T00:00:00.000Z',
            '2026-05-05T00:00:00.000Z',
          ),
      ).toThrow()

      expect(() =>
        db
          ?.query(
            `INSERT INTO discovery_artifacts (
              id,
              work_item_id,
              artifact_version,
              rules,
              examples,
              open_questions,
              out_of_scope,
              collected_at,
              stale_after_at,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            'disc-bad-2',
            'item-3',
            2,
            JSON.stringify([]),
            JSON.stringify([]),
            JSON.stringify([]),
            JSON.stringify([]),
            '2026-05-05T00:00:00.000Z',
            'zzz',
            '2026-05-05T00:00:00.000Z',
            '2026-05-05T00:00:00.000Z',
          ),
      ).toThrow()
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('tracks schema migration version idempotently', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-db-'))
    const dbPath = join(tempDir, 'kanban.sqlite')

    let firstDb: Awaited<ReturnType<typeof openKanbanDatabase>> | undefined
    let secondDb: Awaited<ReturnType<typeof openKanbanDatabase>> | undefined

    try {
      firstDb = await openKanbanDatabase({ dbPath })
      const firstRows = firstDb
        .query<{ version: number; applied_at: string }, []>(
          'SELECT version, applied_at FROM kanban_migrations ORDER BY version ASC',
        )
        .all()
      expect(firstRows).toHaveLength(1)
      expect(firstRows[0]?.version).toBe(1)
      expect(firstRows[0]?.applied_at).toContain('T')

      closeKanbanDatabase(firstDb)
      firstDb = undefined

      secondDb = await openKanbanDatabase({ dbPath })
      const secondRows = secondDb
        .query<{ version: number }, []>('SELECT version FROM kanban_migrations ORDER BY version ASC')
        .all()

      expect(secondRows).toEqual([{ version: 1 }])
    } finally {
      if (firstDb) {
        closeKanbanDatabase(firstDb)
      }
      if (secondDb) {
        closeKanbanDatabase(secondDb)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
