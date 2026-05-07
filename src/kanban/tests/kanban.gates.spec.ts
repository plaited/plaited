import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  closeKanbanDatabase,
  evaluateAndRecordEscalationDecision,
  evaluateAndRecordFrontierVerificationGate,
  evaluateAndRecordMergeSimulationGate,
  evaluateAndRecordRedApprovalGate,
  openKanbanDatabase,
  revokeStaleRedApprovalOnDrift,
} from '../kanban.ts'

describe('kanban gate engine', () => {
  test('rejects red approval with deterministic ownership reason when discovery artifact id is null', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
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
        'req-null-artifact',
        'null artifact request',
        'new',
        'user',
        'user-null-artifact',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-null-artifact',
        'req-null-artifact',
        'null artifact item',
        'red_pending',
        'specs/item-null-artifact.spec.json',
        'sha-null-artifact',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      const decision = evaluateAndRecordRedApprovalGate({
        db,
        decisionId: 'gate-null-artifact-1',
        workItemId: 'item-null-artifact',
        actorType: 'agent',
        actorId: 'coder',
        reason: 'missing discovery artifact id',
        discoveryArtifactId: null,
        decidedAt: '2026-05-05T00:01:00.000Z',
        failures: [
          {
            category: 'expected_behavior_fail',
            checkName: 'bun test src/kanban/tests/kanban.gates.spec.ts',
            detail: 'failing test',
          },
        ],
        evidenceRefs: [],
      })

      expect(decision.decision).toBe('rejected')
      expect(decision.reasons).toEqual([
        'Red gate discovery artifact must belong to the same work item as the decision.',
      ])
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('persists rejected red approval when discovery artifact id does not exist', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
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
        'req-missing-artifact',
        'missing artifact request',
        'new',
        'user',
        'user-missing-artifact',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-missing-artifact',
        'req-missing-artifact',
        'missing artifact item',
        'red_pending',
        'specs/item-missing-artifact.spec.json',
        'sha-missing-artifact',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      const decision = evaluateAndRecordRedApprovalGate({
        db,
        decisionId: 'gate-missing-artifact-1',
        workItemId: 'item-missing-artifact',
        actorType: 'agent',
        actorId: 'coder',
        reason: 'missing discovery artifact row should be auditable',
        discoveryArtifactId: 'disc-does-not-exist',
        decidedAt: '2026-05-05T00:01:00.000Z',
        failures: [
          {
            category: 'expected_behavior_fail',
            checkName: 'bun test src/kanban/tests/kanban.gates.spec.ts',
            detail: 'failing test',
          },
        ],
        evidenceRefs: [],
      })

      expect(decision.decision).toBe('rejected')
      expect(decision.reasons).toContain(
        'Red gate discovery artifact must belong to the same work item as the decision.',
      )

      const decisionRow = db
        .query<{ decision: string; discovery_artifact_id: string | null }, [string]>(
          `SELECT decision, discovery_artifact_id
           FROM gate_decisions
           WHERE id = ?`,
        )
        .get('gate-missing-artifact-1')
      expect(decisionRow).toEqual({
        decision: 'rejected',
        discovery_artifact_id: null,
      })
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('rejects red approval when latest discovery artifact has open questions', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
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
        'req-open-question-red',
        'open question red request',
        'new',
        'user',
        'user-open-question-red',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-open-question-red',
        'req-open-question-red',
        'open question red item',
        'red_pending',
        'specs/item-open-question-red.spec.json',
        'sha-open-question-red',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
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
        'disc-open-question-red-1',
        'item-open-question-red',
        1,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([{ id: 'question-1', text: 'What should happen on cancellation?' }]),
        JSON.stringify([]),
        '2026-05-05T00:00:00.000Z',
        '2026-05-06T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      const decision = evaluateAndRecordRedApprovalGate({
        db,
        decisionId: 'gate-open-question-red-1',
        workItemId: 'item-open-question-red',
        actorType: 'agent',
        actorId: 'analyst',
        reason: 'open questions must block red approval',
        discoveryArtifactId: 'disc-open-question-red-1',
        decidedAt: '2026-05-05T00:01:00.000Z',
        failures: [
          {
            category: 'expected_behavior_fail',
            checkName: 'bun test src/kanban/tests/kanban.gates.spec.ts',
            detail: 'failing test proves behavior gap',
          },
        ],
        evidenceRefs: [],
      })

      expect(decision.decision).toBe('rejected')
      expect(decision.reasons).toContain('Red gate requires latest discovery open questions to be resolved.')
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('rejects red approval when discovery artifact belongs to a different work item', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
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
        'req-xwork',
        'cross-work request',
        'new',
        'user',
        'user-xwork',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-owner',
        'req-xwork',
        'owner item',
        'red_pending',
        'specs/item-owner.spec.json',
        'sha-owner',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-target',
        'req-xwork',
        'target item',
        'red_pending',
        'specs/item-target.spec.json',
        'sha-target',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
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
        'disc-owner-1',
        'item-owner',
        1,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        '2026-05-05T00:00:00.000Z',
        '2026-05-06T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      const decision = evaluateAndRecordRedApprovalGate({
        db,
        decisionId: 'gate-xwork-1',
        workItemId: 'item-target',
        actorType: 'agent',
        actorId: 'coder',
        reason: 'attempting cross-work artifact link',
        discoveryArtifactId: 'disc-owner-1',
        decidedAt: '2026-05-05T00:01:00.000Z',
        failures: [
          {
            category: 'expected_behavior_fail',
            checkName: 'bun test src/kanban/tests/kanban.gates.spec.ts',
            detail: 'failing test',
          },
        ],
        evidenceRefs: [],
      })

      expect(decision.decision).toBe('rejected')
      expect(decision.reasons).toContain(
        'Red gate discovery artifact must belong to the same work item as the decision.',
      )
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('approves red gate only for allowed failure taxonomy and persists audit records', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
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
        'req-gate',
        'gate request',
        'new',
        'user',
        'user-gate',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-gate',
        'req-gate',
        'gate item',
        'red_pending',
        'specs/item-gate.spec.json',
        'abc1234',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
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
        'disc-gate-1',
        'item-gate',
        1,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        '2026-05-05T00:00:00.000Z',
        '2026-05-06T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      const approvedDecision = evaluateAndRecordRedApprovalGate({
        db,
        decisionId: 'gate-approve-1',
        workItemId: 'item-gate',
        actorType: 'agent',
        actorId: 'coder',
        reason: 'targeted tests fail for intended behavior',
        discoveryArtifactId: 'disc-gate-1',
        decidedAt: '2026-05-05T00:01:00.000Z',
        failures: [
          {
            category: 'expected_behavior_fail',
            checkName: 'bun test src/kanban/tests/kanban.gates.spec.ts',
            detail: 'new behavior assertion failed',
          },
        ],
        evidenceRefs: [{ contextDbPath: '.plaited/context.sqlite', evidenceCacheRowId: 11 }],
      })

      expect(approvedDecision.decision).toBe('approved')

      const decisionRow = db
        .query<
          {
            decision: string
            actor_type: string
            actor_id: string
            discovery_artifact_id: string
            spec_commit_sha: string
          },
          [string]
        >(
          `SELECT decision, actor_type, actor_id, discovery_artifact_id, spec_commit_sha
           FROM gate_decisions
           WHERE id = ?`,
        )
        .get('gate-approve-1')
      expect(decisionRow?.decision).toBe('approved')
      expect(decisionRow?.actor_type).toBe('agent')
      expect(decisionRow?.actor_id).toBe('coder')
      expect(decisionRow?.discovery_artifact_id).toBe('disc-gate-1')
      expect(decisionRow?.spec_commit_sha).toBe('abc1234')

      const evidenceRefs = db
        .query<{ context_db_path: string; evidence_cache_row_id: number }, [string]>(
          `SELECT context_db_path, evidence_cache_row_id
           FROM gate_decision_evidence_cache_refs
           WHERE gate_decision_id = ?`,
        )
        .all('gate-approve-1')
      expect(evidenceRefs).toEqual([{ context_db_path: '.plaited/context.sqlite', evidence_cache_row_id: 11 }])

      const taxonomyRows = db
        .query<{ failure_category: string }, [string]>(
          'SELECT failure_category FROM gate_decision_failures WHERE gate_decision_id = ?',
        )
        .all('gate-approve-1')
      expect(taxonomyRows).toEqual([{ failure_category: 'expected_behavior_fail' }])

      const rejectedDecision = evaluateAndRecordRedApprovalGate({
        db,
        decisionId: 'gate-reject-1',
        workItemId: 'item-gate',
        actorType: 'agent',
        actorId: 'coder',
        reason: 'infra failure should not be approvable as red',
        discoveryArtifactId: 'disc-gate-1',
        decidedAt: '2026-05-05T00:02:00.000Z',
        failures: [
          {
            category: 'env_fail',
            checkName: 'bun --bun tsc --noEmit',
            detail: 'network resolution failure',
          },
        ],
        evidenceRefs: [],
      })

      expect(rejectedDecision.decision).toBe('rejected')
      expect(rejectedDecision.reasons).toContain(
        'Red gate failure categories must be approvable: expected_behavior_fail|missing_impl.',
      )
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('persists multiple red gate decisions for the same work item, gate, and decided_at', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
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
        'req-duplicate-red-decisions',
        'duplicate red decision request',
        'new',
        'user',
        'user-duplicate-red-decisions',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-duplicate-red-decisions',
        'req-duplicate-red-decisions',
        'duplicate red decision item',
        'red_pending',
        'specs/item-duplicate-red-decisions.spec.json',
        'sha-duplicate-red-decisions',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
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
        'disc-duplicate-red-decisions-1',
        'item-duplicate-red-decisions',
        1,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        '2026-05-05T00:00:00.000Z',
        '2026-05-06T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      const decidedAt = '2026-05-05T00:01:00.000Z'

      expect(() =>
        evaluateAndRecordRedApprovalGate({
          db: db!,
          decisionId: 'gate-duplicate-red-decision-1',
          workItemId: 'item-duplicate-red-decisions',
          actorType: 'agent',
          actorId: 'coder',
          reason: 'first decision at shared timestamp',
          discoveryArtifactId: 'disc-duplicate-red-decisions-1',
          decidedAt,
          failures: [
            {
              category: 'expected_behavior_fail',
              checkName: 'bun test src/kanban/tests/kanban.gates.spec.ts',
              detail: 'first failure detail',
            },
          ],
          evidenceRefs: [],
        }),
      ).not.toThrow()

      expect(() =>
        evaluateAndRecordRedApprovalGate({
          db: db!,
          decisionId: 'gate-duplicate-red-decision-2',
          workItemId: 'item-duplicate-red-decisions',
          actorType: 'agent',
          actorId: 'coder',
          reason: 'second decision at shared timestamp',
          discoveryArtifactId: 'disc-duplicate-red-decisions-1',
          decidedAt,
          failures: [
            {
              category: 'missing_impl',
              checkName: 'bun test src/kanban/tests/kanban.gates.spec.ts',
              detail: 'second failure detail',
            },
          ],
          evidenceRefs: [],
        }),
      ).not.toThrow()

      const decisionRows = db
        .query<{ id: string; decision: string; reason: string; decided_at: string }, [string]>(
          `SELECT id, decision, reason, decided_at
           FROM gate_decisions
           WHERE work_item_id = ?
             AND gate_name = 'red_approval'
           ORDER BY id ASC`,
        )
        .all('item-duplicate-red-decisions')
      expect(decisionRows).toEqual([
        {
          id: 'gate-duplicate-red-decision-1',
          decision: 'approved',
          reason: 'first decision at shared timestamp',
          decided_at: decidedAt,
        },
        {
          id: 'gate-duplicate-red-decision-2',
          decision: 'approved',
          reason: 'second decision at shared timestamp',
          decided_at: decidedAt,
        },
      ])
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('persists multiple failure rows with the same category and check name when details differ', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
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
        'req-duplicate-failures',
        'duplicate failure audit request',
        'new',
        'user',
        'user-duplicate-failures',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-duplicate-failures',
        'req-duplicate-failures',
        'duplicate failure item',
        'red_pending',
        'specs/item-duplicate-failures.spec.json',
        'sha-duplicate-failures',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
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
        'disc-duplicate-failures-1',
        'item-duplicate-failures',
        1,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        '2026-05-05T00:00:00.000Z',
        '2026-05-06T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      expect(() =>
        evaluateAndRecordRedApprovalGate({
          db: db!,
          decisionId: 'gate-duplicate-failures-1',
          workItemId: 'item-duplicate-failures',
          actorType: 'agent',
          actorId: 'coder',
          reason: 'same failure key should retain both details',
          discoveryArtifactId: 'disc-duplicate-failures-1',
          decidedAt: '2026-05-05T00:01:00.000Z',
          failures: [
            {
              category: 'expected_behavior_fail',
              checkName: 'bun test src/kanban/tests/kanban.gates.spec.ts',
              detail: 'first detail',
            },
            {
              category: 'expected_behavior_fail',
              checkName: 'bun test src/kanban/tests/kanban.gates.spec.ts',
              detail: 'second detail',
            },
          ],
          evidenceRefs: [],
        }),
      ).not.toThrow()

      const failureRows = db
        .query<{ failure_category: string; check_name: string; detail: string }, [string]>(
          `SELECT failure_category, check_name, detail
           FROM gate_decision_failures
           WHERE gate_decision_id = ?
           ORDER BY detail ASC`,
        )
        .all('gate-duplicate-failures-1')
      expect(failureRows).toEqual([
        {
          failure_category: 'expected_behavior_fail',
          check_name: 'bun test src/kanban/tests/kanban.gates.spec.ts',
          detail: 'first detail',
        },
        {
          failure_category: 'expected_behavior_fail',
          check_name: 'bun test src/kanban/tests/kanban.gates.spec.ts',
          detail: 'second detail',
        },
      ])
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('revokes stale red approval when discovery or spec drift is detected', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
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
        'req-drift',
        'drift request',
        'new',
        'user',
        'user-drift',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-drift',
        'req-drift',
        'drift item',
        'red_pending',
        'specs/item-drift.spec.json',
        'sha-old',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
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
        'disc-drift-1',
        'item-drift',
        1,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        '2026-05-05T00:00:00.000Z',
        '2026-05-06T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      const firstDecision = evaluateAndRecordRedApprovalGate({
        db,
        decisionId: 'gate-drift-approve-1',
        workItemId: 'item-drift',
        actorType: 'agent',
        actorId: 'coder',
        reason: 'initial red approval',
        discoveryArtifactId: 'disc-drift-1',
        decidedAt: '2026-05-05T00:01:00.000Z',
        failures: [
          {
            category: 'missing_impl',
            checkName: 'bun test src/kanban/tests/kanban.gates.spec.ts',
            detail: 'implementation not present yet',
          },
        ],
        evidenceRefs: [],
      })
      expect(firstDecision.decision).toBe('approved')

      db.query('UPDATE work_items SET spec_commit_sha = ?, updated_at = ? WHERE id = ?').run(
        'sha-new',
        '2026-05-05T00:02:00.000Z',
        'item-drift',
      )

      const driftResult = revokeStaleRedApprovalOnDrift({
        db,
        decisionId: 'gate-drift-revoke-1',
        workItemId: 'item-drift',
        actorType: 'system',
        actorId: 'gate-engine',
        decidedAt: '2026-05-05T00:03:00.000Z',
      })

      expect(driftResult.revoked).toBeTrue()
      expect(driftResult.reason).toContain('spec_commit_sha drift')

      const latestRedDecision = db
        .query<{ decision: string; actor_type: string; reason: string }, []>(
          `SELECT decision, actor_type, reason
           FROM gate_decisions
           WHERE work_item_id = 'item-drift' AND gate_name = 'red_approval'
           ORDER BY decided_at DESC
           LIMIT 1`,
        )
        .get()
      expect(latestRedDecision?.decision).toBe('rejected')
      expect(latestRedDecision?.actor_type).toBe('system')
      expect(latestRedDecision?.reason).toContain('drift')
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('does not revoke drift from an older approved red decision when a tied later rejection exists', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
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
        'req-latest-red-tie',
        'latest red tie request',
        'new',
        'user',
        'user-latest-red-tie',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-latest-red-tie',
        'req-latest-red-tie',
        'latest red tie item',
        'red_pending',
        'specs/item-latest-red-tie.spec.json',
        'sha-before-drift',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
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
        'disc-latest-red-tie-1',
        'item-latest-red-tie',
        1,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
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
          discovery_artifact_updated_at_snapshot,
          spec_commit_sha,
          decided_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'gate-latest-red-tie-1',
        'item-latest-red-tie',
        'red_approval',
        'approved',
        'agent',
        'coder',
        'older approval in tied timestamp bucket',
        'disc-latest-red-tie-1',
        '2026-05-05T00:00:00.000Z',
        'sha-before-drift',
        '2026-05-05T00:01:00.000Z',
        '2026-05-05T00:01:00.000Z',
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
          discovery_artifact_updated_at_snapshot,
          spec_commit_sha,
          decided_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'gate-latest-red-tie-2',
        'item-latest-red-tie',
        'red_approval',
        'rejected',
        'agent',
        'coder',
        'later rejection in tied timestamp bucket',
        'disc-latest-red-tie-1',
        '2026-05-05T00:00:00.000Z',
        'sha-before-drift',
        '2026-05-05T00:01:00.000Z',
        '2026-05-05T00:01:00.000Z',
      )

      db.query('UPDATE work_items SET spec_commit_sha = ?, updated_at = ? WHERE id = ?').run(
        'sha-after-drift',
        '2026-05-05T00:02:00.000Z',
        'item-latest-red-tie',
      )

      const driftResult = revokeStaleRedApprovalOnDrift({
        db,
        decisionId: 'gate-latest-red-tie-revoke-1',
        workItemId: 'item-latest-red-tie',
        actorType: 'system',
        actorId: 'gate-engine',
        decidedAt: '2026-05-05T00:03:00.000Z',
      })

      expect(driftResult.revoked).toBeFalse()
      expect(driftResult.reason).toContain('No approved red decision exists')

      const systemRejections = db
        .query<{ total: number }, []>(
          `SELECT COUNT(*) AS total
           FROM gate_decisions
           WHERE work_item_id = 'item-latest-red-tie'
             AND gate_name = 'red_approval'
             AND actor_type = 'system'`,
        )
        .get()
      expect(systemRejections?.total).toBe(0)
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('does not duplicate drift revocation when drift basis is unchanged', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
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
        'req-idem',
        'idempotency request',
        'new',
        'user',
        'user-idem',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-idem',
        'req-idem',
        'idempotency item',
        'red_pending',
        'specs/item-idem.spec.json',
        'sha-initial',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
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
        'disc-idem-1',
        'item-idem',
        1,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        '2026-05-05T00:00:00.000Z',
        '2026-05-06T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      const firstApproval = evaluateAndRecordRedApprovalGate({
        db,
        decisionId: 'gate-idem-approve-1',
        workItemId: 'item-idem',
        actorType: 'agent',
        actorId: 'coder',
        reason: 'approve before drift',
        discoveryArtifactId: 'disc-idem-1',
        decidedAt: '2026-05-05T00:01:00.000Z',
        failures: [
          {
            category: 'missing_impl',
            checkName: 'bun test src/kanban/tests/kanban.gates.spec.ts',
            detail: 'expected red failure',
          },
        ],
        evidenceRefs: [],
      })
      expect(firstApproval.decision).toBe('approved')

      db.query('UPDATE work_items SET spec_commit_sha = ?, updated_at = ? WHERE id = ?').run(
        'sha-drifted',
        '2026-05-05T00:02:00.000Z',
        'item-idem',
      )

      const firstRevocation = revokeStaleRedApprovalOnDrift({
        db,
        decisionId: 'gate-idem-revoke-1',
        workItemId: 'item-idem',
        actorType: 'system',
        actorId: 'gate-engine',
        decidedAt: '2026-05-05T00:03:00.000Z',
      })
      expect(firstRevocation.revoked).toBeTrue()

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
          discovery_artifact_updated_at_snapshot,
          spec_commit_sha,
          drift_stale_approval_decision_id,
          drift_signature,
          decided_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'gate-idem-agent-reject-1',
        'item-idem',
        'red_approval',
        'rejected',
        'agent',
        'coder',
        'manual retry still failing',
        'disc-idem-1',
        '2026-05-05T00:00:00.000Z',
        'sha-drifted',
        null,
        null,
        '2026-05-05T00:03:30.000Z',
        '2026-05-05T00:03:30.000Z',
      )

      const secondRevocation = revokeStaleRedApprovalOnDrift({
        db,
        decisionId: 'gate-idem-revoke-2',
        workItemId: 'item-idem',
        actorType: 'system',
        actorId: 'gate-engine',
        decidedAt: '2026-05-05T00:04:00.000Z',
      })
      expect(secondRevocation.revoked).toBeFalse()
      expect(secondRevocation.reason).toContain('No approved red decision exists')

      const rejectionRows = db
        .query<{ total: number }, []>(
          `SELECT COUNT(*) AS total
           FROM gate_decisions
           WHERE work_item_id = 'item-idem'
             AND gate_name = 'red_approval'
             AND decision = 'rejected'
             AND actor_type = 'system'
             AND drift_stale_approval_decision_id IS NOT NULL`,
        )
        .get()
      expect(rejectionRows?.total).toBe(1)
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('revokes red approval when the same discovery artifact row is mutated after approval', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
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
        'req-mut',
        'mutation request',
        'new',
        'user',
        'user-mut',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-mut',
        'req-mut',
        'mutation item',
        'red_pending',
        'specs/item-mut.spec.json',
        'sha-mut',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
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
        'disc-mut-1',
        'item-mut',
        1,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        '2026-05-05T00:00:00.000Z',
        '2026-05-06T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      const approval = evaluateAndRecordRedApprovalGate({
        db,
        decisionId: 'gate-mut-approve-1',
        workItemId: 'item-mut',
        actorType: 'agent',
        actorId: 'coder',
        reason: 'approval before mutation',
        discoveryArtifactId: 'disc-mut-1',
        decidedAt: '2026-05-05T00:01:00.000Z',
        failures: [
          {
            category: 'expected_behavior_fail',
            checkName: 'bun test src/kanban/tests/kanban.gates.spec.ts',
            detail: 'red check failure',
          },
        ],
        evidenceRefs: [],
      })
      expect(approval.decision).toBe('approved')

      db.query('UPDATE discovery_artifacts SET rules = ?, updated_at = ? WHERE id = ?').run(
        JSON.stringify([{ id: 'rule-2', text: 'newly discovered rule' }]),
        '2026-05-05T00:02:00.000Z',
        'disc-mut-1',
      )

      const revokeResult = revokeStaleRedApprovalOnDrift({
        db,
        decisionId: 'gate-mut-revoke-1',
        workItemId: 'item-mut',
        actorType: 'system',
        actorId: 'gate-engine',
        decidedAt: '2026-05-05T00:03:00.000Z',
      })
      expect(revokeResult.revoked).toBeTrue()
      expect(revokeResult.reason).toContain('discovery mutation drift')
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('evaluates deterministic escalation triggers and records authority decisions', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
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
        'req-escalate',
        'escalate request',
        'new',
        'user',
        'user-escalate',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-escalate',
        'req-escalate',
        'escalate item',
        'formulated',
        'specs/item-escalate.spec.json',
        'sha-escalate',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
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
        'disc-escalate-1',
        'item-escalate',
        1,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([{ id: 'q1', text: 'still unresolved' }]),
        JSON.stringify([]),
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
          spec_commit_sha,
          decided_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'gate-escalate-reject-1',
        'item-escalate',
        'red_approval',
        'rejected',
        'agent',
        'coder',
        'first rejection',
        'disc-escalate-1',
        'sha-escalate',
        '2026-05-05T00:01:00.000Z',
        '2026-05-05T00:01:00.000Z',
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
          spec_commit_sha,
          decided_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'gate-escalate-reject-2',
        'item-escalate',
        'red_approval',
        'rejected',
        'agent',
        'coder',
        'second rejection',
        'disc-escalate-1',
        'sha-escalate',
        '2026-05-05T00:02:00.000Z',
        '2026-05-05T00:02:00.000Z',
      )

      const escalation = evaluateAndRecordEscalationDecision({
        db,
        workItemId: 'item-escalate',
        evaluationContext: 'formulation',
        dependencyDeadlockCount: 1,
        riskyImpactScore: 9,
        actorType: 'agent',
        actorId: 'coder',
        occurredAt: '2026-05-05T00:03:00.000Z',
      })

      expect(escalation.triggered).toBeTrue()
      expect(escalation.targetAuthority).toBe('user')
      expect(escalation.triggers).toEqual([
        'open_questions_unresolved',
        'dependency_deadlock_detected',
        'consecutive_red_rejections',
        'risky_impact_threshold_exceeded',
      ])

      const latestEvent = db
        .query<{ event_kind: string; payload_json: string }, []>(
          `SELECT event_kind, payload_json
           FROM work_item_events
           WHERE work_item_id = 'item-escalate'
           ORDER BY occurred_at DESC
           LIMIT 1`,
        )
        .get()
      expect(latestEvent?.event_kind).toBe('escalation_decision_recorded')

      const payload = latestEvent ? JSON.parse(latestEvent.payload_json) : null
      expect(payload).toEqual({
        actorType: 'agent',
        actorId: 'coder',
        targetAuthority: 'user',
        triggers: [
          'open_questions_unresolved',
          'dependency_deadlock_detected',
          'consecutive_red_rejections',
          'risky_impact_threshold_exceeded',
        ],
      })
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('open questions at formulation gate trigger escalation', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
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
        'req-open-questions',
        'open questions request',
        'new',
        'user',
        'user-open-questions',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-open-questions',
        'req-open-questions',
        'open questions item',
        'formulated',
        'specs/item-open-questions.spec.json',
        'sha-open-questions',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
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
        'disc-open-questions-1',
        'item-open-questions',
        1,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify(['Need user decision']),
        JSON.stringify([]),
        '2026-05-05T00:00:00.000Z',
        '2026-05-06T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      const escalation = evaluateAndRecordEscalationDecision({
        db,
        workItemId: 'item-open-questions',
        evaluationContext: 'formulation',
        dependencyDeadlockCount: 0,
        riskyImpactScore: 0,
        actorType: 'agent',
        actorId: 'coder',
        occurredAt: '2026-05-05T00:01:00.000Z',
      })

      expect(escalation.triggered).toBeTrue()
      expect(escalation.triggers).toEqual(['open_questions_unresolved'])
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('does not count older tied red rejections after a tied later approval', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
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
        'req-escalate-tie',
        'escalate tie request',
        'new',
        'user',
        'user-escalate-tie',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-escalate-tie',
        'req-escalate-tie',
        'escalate tie item',
        'red_pending',
        'specs/item-escalate-tie.spec.json',
        'sha-escalate-tie',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      for (const decision of [
        {
          id: 'gate-escalate-tie-1',
          decision: 'rejected',
          reason: 'older tied rejection one',
        },
        {
          id: 'gate-escalate-tie-2',
          decision: 'rejected',
          reason: 'older tied rejection two',
        },
        {
          id: 'gate-escalate-tie-3',
          decision: 'approved',
          reason: 'latest tied approval',
        },
      ] as const) {
        db.query(
          `INSERT INTO gate_decisions (
            id,
            work_item_id,
            gate_name,
            decision,
            actor_type,
            actor_id,
            reason,
            spec_commit_sha,
            decided_at,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          decision.id,
          'item-escalate-tie',
          'red_approval',
          decision.decision,
          'agent',
          'coder',
          decision.reason,
          'sha-escalate-tie',
          '2026-05-05T00:01:00.000Z',
          '2026-05-05T00:01:00.000Z',
        )
      }

      const escalation = evaluateAndRecordEscalationDecision({
        db,
        workItemId: 'item-escalate-tie',
        evaluationContext: 'red_approval',
        dependencyDeadlockCount: 0,
        riskyImpactScore: 0,
        actorType: 'agent',
        actorId: 'coder',
        occurredAt: '2026-05-05T00:02:00.000Z',
      })

      expect(escalation.triggered).toBeFalse()
      expect(escalation.triggers).toEqual([])

      const eventRows = db
        .query<{ total: number }, []>(
          `SELECT COUNT(*) AS total
           FROM work_item_events
           WHERE work_item_id = 'item-escalate-tie'
             AND event_kind = 'escalation_decision_recorded'`,
        )
        .get()
      expect(eventRows?.total).toBe(0)
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('open questions outside formulation gate do not trigger escalation', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
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
        'req-open-questions-other',
        'open questions other request',
        'new',
        'user',
        'user-open-questions-other',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-open-questions-other',
        'req-open-questions-other',
        'open questions other item',
        'red_pending',
        'specs/item-open-questions-other.spec.json',
        'sha-open-questions-other',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
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
        'disc-open-questions-other-1',
        'item-open-questions-other',
        1,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify(['Need user decision']),
        JSON.stringify([]),
        '2026-05-05T00:00:00.000Z',
        '2026-05-06T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      const escalation = evaluateAndRecordEscalationDecision({
        db,
        workItemId: 'item-open-questions-other',
        evaluationContext: 'merge_simulation',
        dependencyDeadlockCount: 0,
        riskyImpactScore: 0,
        actorType: 'agent',
        actorId: 'coder',
        occurredAt: '2026-05-05T00:01:00.000Z',
      })

      expect(escalation.triggered).toBeFalse()
      expect(escalation.triggers).toEqual([])
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('records deterministic behavioral-frontier verification gate artifacts and links them to decisions', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
    const dbPath = join(tempDir, 'kanban.sqlite')
    const specPath = join(tempDir, 'item-frontier.spec.jsonl')
    let db: Awaited<ReturnType<typeof openKanbanDatabase>> | undefined

    try {
      await Bun.write(
        specPath,
        `${JSON.stringify({
          label: 'choose-a',
          thread: {
            once: true,
            syncPoints: [{ request: { type: 'A' } }],
          },
        })}\n`,
      )

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
        'req-frontier',
        'frontier request',
        'new',
        'user',
        'user-frontier',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-frontier',
        'req-frontier',
        'frontier item',
        'red_approved',
        specPath,
        'sha-frontier',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
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
        'disc-frontier-1',
        'item-frontier',
        1,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        '2026-05-05T00:00:00.000Z',
        '2026-05-06T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      const result = await evaluateAndRecordFrontierVerificationGate({
        db,
        decisionId: 'gate-frontier-approve-1',
        workItemId: 'item-frontier',
        actorType: 'agent',
        actorId: 'coder',
        reason: 'verify behavioral intent before green',
        discoveryArtifactId: 'disc-frontier-1',
        evidenceRefs: [{ contextDbPath: '.plaited/context.sqlite', evidenceCacheRowId: 21 }],
        decidedAt: '2026-05-05T00:01:00.000Z',
      })

      expect(result.decision).toBe('approved')
      expect(result.verifyStatus).toBe('verified')
      expect(result.failureCategories).toEqual([])

      const decisionRow = db
        .query<{ gate_name: string; decision: string; spec_commit_sha: string }, [string]>(
          `SELECT gate_name, decision, spec_commit_sha
           FROM gate_decisions
           WHERE id = ?`,
        )
        .get('gate-frontier-approve-1')
      expect(decisionRow).toEqual({
        gate_name: 'frontier_verification',
        decision: 'approved',
        spec_commit_sha: 'sha-frontier',
      })

      const checkRunRow = db
        .query<{ gate_decision_id: string; check_type: string; status: string; required_gate: string }, [string]>(
          `SELECT gate_decision_id, check_type, status, required_gate
           FROM check_runs
           WHERE id = ?`,
        )
        .get(result.checkRunId)
      expect(checkRunRow).toEqual({
        gate_decision_id: 'gate-frontier-approve-1',
        check_type: 'behavioral_frontier',
        status: 'passed',
        required_gate: 'red_approval',
      })

      const latestEvent = db
        .query<{ event_kind: string; payload_json: string }, []>(
          `SELECT event_kind, payload_json
           FROM work_item_events
           WHERE work_item_id = 'item-frontier'
           ORDER BY occurred_at DESC, created_at DESC
           LIMIT 1`,
        )
        .get()
      expect(latestEvent?.event_kind).toBe('frontier_verification_recorded')

      const eventPayload = latestEvent ? JSON.parse(latestEvent.payload_json) : null
      expect(eventPayload).toEqual({
        decisionId: 'gate-frontier-approve-1',
        checkRunId: result.checkRunId,
        status: 'verified',
        report: {
          strategy: 'bfs',
          selectionPolicy: 'scheduler',
          visitedCount: 2,
          findingCount: 0,
          truncated: false,
        },
        findings: [],
        failureCategories: [],
      })
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('categorizes frontier verification failures and exposes deadlock signal for escalation', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
    const dbPath = join(tempDir, 'kanban.sqlite')
    const specPath = join(tempDir, 'item-frontier-fail.spec.jsonl')
    let db: Awaited<ReturnType<typeof openKanbanDatabase>> | undefined

    try {
      await Bun.write(
        specPath,
        `${[
          JSON.stringify({
            label: 'choose-a',
            thread: {
              once: true,
              syncPoints: [{ request: { type: 'A' } }],
            },
          }),
          JSON.stringify({
            label: 'choose-b',
            thread: {
              once: true,
              syncPoints: [{ request: { type: 'B' } }],
            },
          }),
          JSON.stringify({
            label: 'deadlock-after-a',
            thread: {
              once: true,
              syncPoints: [{ waitFor: [{ type: 'A' }] }, { block: [{ type: 'B' }] }],
            },
          }),
        ].join('\n')}\n`,
      )

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
        'req-frontier-fail',
        'frontier fail request',
        'new',
        'user',
        'user-frontier-fail',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-frontier-fail',
        'req-frontier-fail',
        'frontier fail item',
        'red_approved',
        specPath,
        'sha-frontier-fail',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
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
        'disc-frontier-fail-1',
        'item-frontier-fail',
        1,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        '2026-05-05T00:00:00.000Z',
        '2026-05-06T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      const result = await evaluateAndRecordFrontierVerificationGate({
        db,
        decisionId: 'gate-frontier-reject-1',
        workItemId: 'item-frontier-fail',
        actorType: 'agent',
        actorId: 'coder',
        reason: 'deadlock should reject frontier verification',
        discoveryArtifactId: 'disc-frontier-fail-1',
        evidenceRefs: [],
        decidedAt: '2026-05-05T00:01:00.000Z',
      })

      expect(result.decision).toBe('rejected')
      expect(result.verifyStatus).toBe('failed')
      expect(result.failureCategories).toEqual(['frontier_deadlock_detected'])
      expect(result.escalationHints).toEqual({
        dependencyDeadlockCount: 1,
      })

      const failureRows = db
        .query<{ failure_category: string }, [string]>(
          `SELECT failure_category
           FROM gate_decision_failures
           WHERE gate_decision_id = ?`,
        )
        .all('gate-frontier-reject-1')
      expect(failureRows).toEqual([{ failure_category: 'frontier_deadlock_detected' }])
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('rejects frontier verification with invalid discovery artifact id without FK error and persists rejected decision', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
    const dbPath = join(tempDir, 'kanban.sqlite')
    const specPath = join(tempDir, 'item-frontier-invalid-artifact.spec.jsonl')
    let db: Awaited<ReturnType<typeof openKanbanDatabase>> | undefined

    try {
      await Bun.write(
        specPath,
        `${JSON.stringify({
          label: 'choose-a',
          thread: {
            once: true,
            syncPoints: [{ request: { type: 'A' } }],
          },
        })}\n`,
      )

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
        'req-frontier-invalid-artifact',
        'frontier invalid artifact request',
        'new',
        'user',
        'user-frontier-invalid-artifact',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-frontier-invalid-artifact',
        'req-frontier-invalid-artifact',
        'frontier invalid artifact item',
        'red_approved',
        specPath,
        'sha-frontier-invalid-artifact',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      let thrown: unknown
      let result: Awaited<ReturnType<typeof evaluateAndRecordFrontierVerificationGate>> | undefined
      try {
        result = await evaluateAndRecordFrontierVerificationGate({
          db,
          decisionId: 'gate-frontier-invalid-artifact-1',
          workItemId: 'item-frontier-invalid-artifact',
          actorType: 'agent',
          actorId: 'coder',
          reason: 'invalid artifact id should reject without FK failure',
          discoveryArtifactId: 'disc-does-not-exist',
          evidenceRefs: [],
          decidedAt: '2026-05-05T00:01:00.000Z',
        })
      } catch (error: unknown) {
        thrown = error
      }

      expect(thrown).toBeUndefined()
      expect(result?.decision).toBe('rejected')
      expect(result?.failureCategories).toEqual(['frontier_execution_error'])

      const decisionRow = db
        .query<{ decision: string; gate_name: string; discovery_artifact_id: string | null }, [string]>(
          `SELECT decision, gate_name, discovery_artifact_id
           FROM gate_decisions
           WHERE id = ?`,
        )
        .get('gate-frontier-invalid-artifact-1')
      expect(decisionRow).toEqual({
        decision: 'rejected',
        gate_name: 'frontier_verification',
        discovery_artifact_id: null,
      })
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('persists multiple frontier precondition failures without gate_decision_failures uniqueness collision', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
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
        'req-frontier-preconditions',
        'frontier preconditions request',
        'new',
        'user',
        'user-frontier-preconditions',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-frontier-preconditions-owner',
        'req-frontier-preconditions',
        'owner item',
        'red_approved',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-frontier-preconditions-target',
        'req-frontier-preconditions',
        'target item',
        'red_approved',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

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
        'disc-frontier-preconditions-owner',
        'item-frontier-preconditions-owner',
        1,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        '2026-05-05T00:00:00.000Z',
        '2026-05-06T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      let thrown: unknown
      let result: Awaited<ReturnType<typeof evaluateAndRecordFrontierVerificationGate>> | undefined
      try {
        result = await evaluateAndRecordFrontierVerificationGate({
          db,
          decisionId: 'gate-frontier-preconditions-1',
          workItemId: 'item-frontier-preconditions-target',
          actorType: 'agent',
          actorId: 'coder',
          reason: 'multiple precondition failures should persist deterministically',
          discoveryArtifactId: 'disc-frontier-preconditions-owner',
          evidenceRefs: [],
          decidedAt: '2026-05-05T00:01:00.000Z',
        })
      } catch (error: unknown) {
        thrown = error
      }

      expect(thrown).toBeUndefined()
      expect(result?.decision).toBe('rejected')
      expect(result?.failureCategories).toEqual(['frontier_execution_error'])

      const failureRows = db
        .query<{ failure_category: string; check_name: string }, [string]>(
          `SELECT failure_category, check_name
           FROM gate_decision_failures
           WHERE gate_decision_id = ?
           ORDER BY check_name ASC`,
        )
        .all('gate-frontier-preconditions-1')
      expect(failureRows).toHaveLength(2)
      expect(failureRows.every((row) => row.failure_category === 'frontier_execution_error')).toBeTrue()
      expect(new Set(failureRows.map((row) => row.check_name)).size).toBe(2)
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('records local merge simulation evidence with required checks and commit refs on success', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
    const dbPath = join(tempDir, 'kanban.sqlite')
    const repoPath = join(tempDir, 'repo')
    let db: Awaited<ReturnType<typeof openKanbanDatabase>> | undefined

    try {
      await mkdir(repoPath, { recursive: true })

      await Bun.$`git init`.cwd(repoPath).quiet()
      await Bun.$`git config user.name "Test User"`.cwd(repoPath).quiet()
      await Bun.$`git config user.email "test@example.com"`.cwd(repoPath).quiet()
      await Bun.$`git checkout -b main`.cwd(repoPath).quiet()

      await Bun.write(join(repoPath, 'shared.txt'), 'base\n')
      await Bun.$`git add .`.cwd(repoPath).quiet()
      await Bun.$`git commit -m "base"`.cwd(repoPath).quiet()

      await Bun.$`git checkout -b feature`.cwd(repoPath).quiet()
      await Bun.write(join(repoPath, 'feature.txt'), 'feature\n')
      await Bun.$`git add .`.cwd(repoPath).quiet()
      await Bun.$`git commit -m "feature change"`.cwd(repoPath).quiet()

      await Bun.$`git checkout main`.cwd(repoPath).quiet()
      await Bun.write(join(repoPath, 'main.txt'), 'main\n')
      await Bun.$`git add .`.cwd(repoPath).quiet()
      await Bun.$`git commit -m "main change"`.cwd(repoPath).quiet()

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
        'req-merge',
        'merge request',
        'new',
        'user',
        'user-merge',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-merge',
        'req-merge',
        'merge item',
        'review_pending',
        'specs/item-merge.spec.json',
        'sha-merge',
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
        spec_commit_sha,
        decided_at,
        created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'gate-frontier-prereq-merge-1',
        'item-merge',
        'frontier_verification',
        'approved',
        'agent',
        'coder',
        'frontier checks passed',
        'sha-merge',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      db.query(
        `INSERT INTO check_runs (
          id,
          work_item_id,
          gate_decision_id,
          check_name,
          check_type,
          status,
          required_gate,
          started_at,
          completed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'check-frontier-1',
        'item-merge',
        'gate-frontier-prereq-merge-1',
        'behavioral-frontier verify',
        'behavioral_frontier',
        'passed',
        'red_approval',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.500Z',
        '2026-05-05T00:00:00.500Z',
        '2026-05-05T00:00:00.500Z',
      )

      db.query(
        `INSERT INTO check_runs (
          id,
          work_item_id,
          gate_decision_id,
          check_name,
          check_type,
          status,
          required_gate,
          started_at,
          completed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'check-tests-1',
        'item-merge',
        null,
        'bun test src/kanban/tests/kanban.gates.spec.ts',
        'tests',
        'passed',
        'frontier_verification',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:01.000Z',
        '2026-05-05T00:00:01.000Z',
        '2026-05-05T00:00:01.000Z',
      )
      db.query(
        `INSERT INTO check_runs (
          id,
          work_item_id,
          gate_decision_id,
          check_name,
          check_type,
          status,
          required_gate,
          started_at,
          completed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'check-types-1',
        'item-merge',
        null,
        'bun --bun tsc --noEmit',
        'types',
        'passed',
        'frontier_verification',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:02.000Z',
        '2026-05-05T00:00:02.000Z',
        '2026-05-05T00:00:02.000Z',
      )

      const result = await evaluateAndRecordMergeSimulationGate({
        db,
        decisionId: 'gate-merge-approve-1',
        workItemId: 'item-merge',
        actorType: 'agent',
        actorId: 'coder',
        reason: 'local merge simulation for merge readiness',
        repoPath,
        sourceRef: 'feature',
        targetRef: 'main',
        requiredCheckRunIds: ['check-frontier-1', 'check-tests-1', 'check-types-1'],
        decidedAt: '2026-05-05T00:01:00.000Z',
      })

      expect(result.decision).toBe('approved')
      expect(result.failureCategories).toEqual([])

      const decisionRow = db
        .query<{ gate_name: string; decision: string; reason: string }, [string]>(
          `SELECT gate_name, decision, reason
           FROM gate_decisions
           WHERE id = ?`,
        )
        .get('gate-merge-approve-1')
      expect(decisionRow).toEqual({
        gate_name: 'merge_simulation',
        decision: 'approved',
        reason: 'local merge simulation for merge readiness',
      })

      const checkRunRow = db
        .query<{ gate_decision_id: string; check_type: string; status: string; required_gate: string }, [string]>(
          `SELECT gate_decision_id, check_type, status, required_gate
           FROM check_runs
           WHERE id = ?`,
        )
        .get(result.checkRunId)
      expect(checkRunRow).toEqual({
        gate_decision_id: 'gate-merge-approve-1',
        check_type: 'merge_simulation',
        status: 'passed',
        required_gate: 'frontier_verification',
      })

      const latestEvent = db
        .query<{ event_kind: string; payload_json: string }, []>(
          `SELECT event_kind, payload_json
           FROM work_item_events
           WHERE work_item_id = 'item-merge'
           ORDER BY occurred_at DESC, created_at DESC
           LIMIT 1`,
        )
        .get()
      expect(latestEvent?.event_kind).toBe('merge_simulation_recorded')

      const payload = latestEvent ? JSON.parse(latestEvent.payload_json) : null
      expect(payload).toEqual({
        decisionId: 'gate-merge-approve-1',
        checkRunId: result.checkRunId,
        targetRef: 'main',
        sourceRef: 'feature',
        decision: 'approved',
        requiredChecks: [
          {
            id: 'check-frontier-1',
            status: 'passed',
          },
          {
            id: 'check-tests-1',
            status: 'passed',
          },
          {
            id: 'check-types-1',
            status: 'passed',
          },
        ],
        commitRefs: {
          sourceHeadSha: result.commitRefs.sourceHeadSha,
          targetHeadSha: result.commitRefs.targetHeadSha,
        },
        command: `git merge --no-commit --no-ff ${result.commitRefs.sourceHeadSha}`,
        failureCategories: [],
        simulatedAt: '2026-05-05T00:01:00.000Z',
      })
      expect(result.commitRefs.sourceHeadSha).toMatch(/^[a-f0-9]{40}$/)
      expect(result.commitRefs.targetHeadSha).toMatch(/^[a-f0-9]{40}$/)
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('rejects merge simulation and persists conflict failure cause when merge cannot be applied cleanly', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
    const dbPath = join(tempDir, 'kanban.sqlite')
    const repoPath = join(tempDir, 'repo')
    let db: Awaited<ReturnType<typeof openKanbanDatabase>> | undefined

    try {
      await mkdir(repoPath, { recursive: true })

      await Bun.$`git init`.cwd(repoPath).quiet()
      await Bun.$`git config user.name "Test User"`.cwd(repoPath).quiet()
      await Bun.$`git config user.email "test@example.com"`.cwd(repoPath).quiet()
      await Bun.$`git checkout -b main`.cwd(repoPath).quiet()

      await Bun.write(join(repoPath, 'shared.txt'), 'base\n')
      await Bun.$`git add .`.cwd(repoPath).quiet()
      await Bun.$`git commit -m "base"`.cwd(repoPath).quiet()

      await Bun.$`git checkout -b feature`.cwd(repoPath).quiet()
      await Bun.write(join(repoPath, 'shared.txt'), 'feature branch value\n')
      await Bun.$`git add .`.cwd(repoPath).quiet()
      await Bun.$`git commit -m "feature edit"`.cwd(repoPath).quiet()

      await Bun.$`git checkout main`.cwd(repoPath).quiet()
      await Bun.write(join(repoPath, 'shared.txt'), 'main branch value\n')
      await Bun.$`git add .`.cwd(repoPath).quiet()
      await Bun.$`git commit -m "main edit"`.cwd(repoPath).quiet()

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
        'req-merge-conflict',
        'merge conflict request',
        'new',
        'user',
        'user-merge-conflict',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-merge-conflict',
        'req-merge-conflict',
        'merge conflict item',
        'review_pending',
        'specs/item-merge-conflict.spec.json',
        'sha-merge-conflict',
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
        spec_commit_sha,
        decided_at,
        created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'gate-frontier-prereq-merge-conflict-1',
        'item-merge-conflict',
        'frontier_verification',
        'approved',
        'agent',
        'coder',
        'frontier checks passed',
        'sha-merge-conflict',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      db.query(
        `INSERT INTO check_runs (
          id,
          work_item_id,
          gate_decision_id,
          check_name,
          check_type,
          status,
          required_gate,
          started_at,
          completed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'check-frontier-conflict-1',
        'item-merge-conflict',
        'gate-frontier-prereq-merge-conflict-1',
        'behavioral-frontier verify',
        'behavioral_frontier',
        'passed',
        'red_approval',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.500Z',
        '2026-05-05T00:00:00.500Z',
        '2026-05-05T00:00:00.500Z',
      )

      db.query(
        `INSERT INTO check_runs (
          id,
          work_item_id,
          gate_decision_id,
          check_name,
          check_type,
          status,
          required_gate,
          started_at,
          completed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'check-pre-merge-1',
        'item-merge-conflict',
        null,
        'bun test src/kanban/tests/kanban.gates.spec.ts',
        'tests',
        'passed',
        'frontier_verification',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:01.000Z',
        '2026-05-05T00:00:01.000Z',
        '2026-05-05T00:00:01.000Z',
      )

      const result = await evaluateAndRecordMergeSimulationGate({
        db,
        decisionId: 'gate-merge-conflict-1',
        workItemId: 'item-merge-conflict',
        actorType: 'agent',
        actorId: 'coder',
        reason: 'conflict should block merge readiness',
        repoPath,
        sourceRef: 'feature',
        targetRef: 'main',
        requiredCheckRunIds: ['check-frontier-conflict-1', 'check-pre-merge-1'],
        decidedAt: '2026-05-05T00:01:00.000Z',
      })

      expect(result.decision).toBe('rejected')
      expect(result.failureCategories).toEqual(['merge_conflict_detected'])

      const checkRunRow = db
        .query<{ gate_decision_id: string; status: string; check_type: string }, [string]>(
          `SELECT gate_decision_id, status, check_type
           FROM check_runs
           WHERE id = ?`,
        )
        .get(result.checkRunId)
      expect(checkRunRow).toEqual({
        gate_decision_id: 'gate-merge-conflict-1',
        status: 'failed',
        check_type: 'merge_simulation',
      })

      const failureRows = db
        .query<{ failure_category: string }, [string]>(
          `SELECT failure_category
           FROM gate_decision_failures
           WHERE gate_decision_id = ?`,
        )
        .all('gate-merge-conflict-1')
      expect(failureRows).toEqual([{ failure_category: 'merge_conflict_detected' }])
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('rejects merge simulation when required checks are stale red_approval checks without merge eligibility', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
    const dbPath = join(tempDir, 'kanban.sqlite')
    const repoPath = join(tempDir, 'repo')
    let db: Awaited<ReturnType<typeof openKanbanDatabase>> | undefined

    try {
      await mkdir(repoPath, { recursive: true })

      await Bun.$`git init`.cwd(repoPath).quiet()
      await Bun.$`git config user.name "Test User"`.cwd(repoPath).quiet()
      await Bun.$`git config user.email "test@example.com"`.cwd(repoPath).quiet()
      await Bun.$`git checkout -b main`.cwd(repoPath).quiet()

      await Bun.write(join(repoPath, 'shared.txt'), 'base\n')
      await Bun.$`git add .`.cwd(repoPath).quiet()
      await Bun.$`git commit -m "base"`.cwd(repoPath).quiet()

      await Bun.$`git checkout -b feature`.cwd(repoPath).quiet()
      await Bun.write(join(repoPath, 'feature.txt'), 'feature\n')
      await Bun.$`git add .`.cwd(repoPath).quiet()
      await Bun.$`git commit -m "feature change"`.cwd(repoPath).quiet()

      await Bun.$`git checkout main`.cwd(repoPath).quiet()

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
        'req-merge-stale-checks',
        'merge stale checks request',
        'new',
        'user',
        'user-merge-stale-checks',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-merge-stale-checks',
        'req-merge-stale-checks',
        'merge stale checks item',
        'review_pending',
        'specs/item-merge-stale-checks.spec.json',
        'sha-merge-stale-checks',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      db.query(
        `INSERT INTO check_runs (
          id,
          work_item_id,
          gate_decision_id,
          check_name,
          check_type,
          status,
          required_gate,
          started_at,
          completed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'check-stale-red-only-1',
        'item-merge-stale-checks',
        null,
        'bun test src/kanban/tests/kanban.gates.spec.ts',
        'tests',
        'passed',
        'red_approval',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:01.000Z',
        '2026-05-05T00:00:01.000Z',
        '2026-05-05T00:00:01.000Z',
      )

      const result = await evaluateAndRecordMergeSimulationGate({
        db,
        decisionId: 'gate-merge-stale-checks-1',
        workItemId: 'item-merge-stale-checks',
        actorType: 'agent',
        actorId: 'coder',
        reason: 'stale red checks should not satisfy merge gate',
        repoPath,
        sourceRef: 'feature',
        targetRef: 'main',
        requiredCheckRunIds: ['check-stale-red-only-1'],
        decidedAt: '2026-05-05T00:01:00.000Z',
      })

      expect(result.decision).toBe('rejected')
      expect(result.failureCategories).toContain('required_checks_failed')

      const failureRows = db
        .query<{ failure_category: string; check_name: string }, [string]>(
          `SELECT failure_category, check_name
           FROM gate_decision_failures
           WHERE gate_decision_id = ?
           ORDER BY check_name ASC`,
        )
        .all('gate-merge-stale-checks-1')
      expect(failureRows).toContainEqual({
        failure_category: 'required_checks_failed',
        check_name: 'required-check:check-stale-red-only-1',
      })
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('rejects merge simulation when frontier verification evidence is approved for a stale spec commit sha', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
    const dbPath = join(tempDir, 'kanban.sqlite')
    const repoPath = join(tempDir, 'repo')
    let db: Awaited<ReturnType<typeof openKanbanDatabase>> | undefined

    try {
      await mkdir(repoPath, { recursive: true })

      await Bun.$`git init`.cwd(repoPath).quiet()
      await Bun.$`git config user.name "Test User"`.cwd(repoPath).quiet()
      await Bun.$`git config user.email "test@example.com"`.cwd(repoPath).quiet()
      await Bun.$`git checkout -b main`.cwd(repoPath).quiet()

      await Bun.write(join(repoPath, 'shared.txt'), 'base\n')
      await Bun.$`git add .`.cwd(repoPath).quiet()
      await Bun.$`git commit -m "base"`.cwd(repoPath).quiet()

      await Bun.$`git checkout -b feature`.cwd(repoPath).quiet()
      await Bun.write(join(repoPath, 'feature.txt'), 'feature\n')
      await Bun.$`git add .`.cwd(repoPath).quiet()
      await Bun.$`git commit -m "feature change"`.cwd(repoPath).quiet()

      await Bun.$`git checkout main`.cwd(repoPath).quiet()
      await Bun.write(join(repoPath, 'main.txt'), 'main\n')
      await Bun.$`git add .`.cwd(repoPath).quiet()
      await Bun.$`git commit -m "main change"`.cwd(repoPath).quiet()

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
        'req-merge-stale-frontier',
        'merge stale frontier request',
        'new',
        'user',
        'user-merge-stale-frontier',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-merge-stale-frontier',
        'req-merge-stale-frontier',
        'merge stale frontier item',
        'review_pending',
        'specs/item-merge-stale-frontier.spec.json',
        'new-sha',
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
          spec_commit_sha,
          decided_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'gate-frontier-stale-spec-1',
        'item-merge-stale-frontier',
        'frontier_verification',
        'approved',
        'agent',
        'coder',
        'frontier checks passed for prior spec revision',
        'old-sha',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )

      db.query(
        `INSERT INTO check_runs (
          id,
          work_item_id,
          gate_decision_id,
          check_name,
          check_type,
          status,
          required_gate,
          started_at,
          completed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'check-frontier-stale-spec-1',
        'item-merge-stale-frontier',
        'gate-frontier-stale-spec-1',
        'behavioral-frontier verify',
        'behavioral_frontier',
        'passed',
        'red_approval',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.500Z',
        '2026-05-05T00:00:00.500Z',
        '2026-05-05T00:00:00.500Z',
      )
      db.query(
        `INSERT INTO check_runs (
          id,
          work_item_id,
          gate_decision_id,
          check_name,
          check_type,
          status,
          required_gate,
          started_at,
          completed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'check-tests-stale-spec-1',
        'item-merge-stale-frontier',
        null,
        'bun test src/kanban/tests/kanban.gates.spec.ts',
        'tests',
        'passed',
        'frontier_verification',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:01.000Z',
        '2026-05-05T00:00:01.000Z',
        '2026-05-05T00:00:01.000Z',
      )
      db.query(
        `INSERT INTO check_runs (
          id,
          work_item_id,
          gate_decision_id,
          check_name,
          check_type,
          status,
          required_gate,
          started_at,
          completed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'check-types-stale-spec-1',
        'item-merge-stale-frontier',
        null,
        'bun --bun tsc --noEmit',
        'types',
        'passed',
        'frontier_verification',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:02.000Z',
        '2026-05-05T00:00:02.000Z',
        '2026-05-05T00:00:02.000Z',
      )

      const result = await evaluateAndRecordMergeSimulationGate({
        db,
        decisionId: 'gate-merge-stale-frontier-1',
        workItemId: 'item-merge-stale-frontier',
        actorType: 'agent',
        actorId: 'coder',
        reason: 'stale frontier verification should not satisfy merge gate',
        repoPath,
        sourceRef: 'feature',
        targetRef: 'main',
        requiredCheckRunIds: ['check-frontier-stale-spec-1', 'check-tests-stale-spec-1', 'check-types-stale-spec-1'],
        decidedAt: '2026-05-05T00:01:00.000Z',
      })

      expect(result.decision).toBe('rejected')
      expect(result.failureCategories).toEqual(
        expect.arrayContaining(['required_checks_failed', 'required_checks_missing']),
      )

      const failureRows = db
        .query<{ failure_category: string; check_name: string; detail: string }, [string]>(
          `SELECT failure_category, check_name, detail
           FROM gate_decision_failures
           WHERE gate_decision_id = ?
           ORDER BY check_name ASC, failure_category ASC`,
        )
        .all('gate-merge-stale-frontier-1')
      expect(failureRows).toContainEqual({
        failure_category: 'required_checks_failed',
        check_name: 'required-check:check-frontier-stale-spec-1',
        detail:
          'Required check "check-frontier-stale-spec-1" is linked to frontier_verification decision "gate-frontier-stale-spec-1" for stale spec_commit_sha "old-sha" (current "new-sha").',
      })
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('persists rejected merge simulation decision when worktree setup fails before merge command runs', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-kanban-gates-'))
    const dbPath = join(tempDir, 'kanban.sqlite')
    const repoPath = join(tempDir, 'repo')
    const setupFailureWorktreePath = join(tempDir, 'non-empty-sim-worktree')
    let db: Awaited<ReturnType<typeof openKanbanDatabase>> | undefined

    try {
      await mkdir(repoPath, { recursive: true })
      await mkdir(setupFailureWorktreePath, { recursive: true })
      await Bun.write(join(setupFailureWorktreePath, 'occupied.txt'), 'occupied\n')

      await Bun.$`git init`.cwd(repoPath).quiet()
      await Bun.$`git config user.name "Test User"`.cwd(repoPath).quiet()
      await Bun.$`git config user.email "test@example.com"`.cwd(repoPath).quiet()
      await Bun.$`git checkout -b main`.cwd(repoPath).quiet()

      await Bun.write(join(repoPath, 'shared.txt'), 'base\n')
      await Bun.$`git add .`.cwd(repoPath).quiet()
      await Bun.$`git commit -m "base"`.cwd(repoPath).quiet()

      await Bun.$`git checkout -b feature`.cwd(repoPath).quiet()
      await Bun.write(join(repoPath, 'feature.txt'), 'feature\n')
      await Bun.$`git add .`.cwd(repoPath).quiet()
      await Bun.$`git commit -m "feature change"`.cwd(repoPath).quiet()

      await Bun.$`git checkout main`.cwd(repoPath).quiet()

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
        'req-merge-setup-fail',
        'merge setup fail request',
        'new',
        'user',
        'user-merge-setup-fail',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_items (
          id,
          request_id,
          title,
          status,
          spec_path,
          spec_commit_sha,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'item-merge-setup-fail',
        'req-merge-setup-fail',
        'merge setup fail item',
        'review_pending',
        'specs/item-merge-setup-fail.spec.json',
        'sha-merge-setup-fail',
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
        spec_commit_sha,
        decided_at,
        created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'gate-frontier-prereq-setup-fail-1',
        'item-merge-setup-fail',
        'frontier_verification',
        'approved',
        'agent',
        'coder',
        'frontier checks passed',
        'sha-merge-setup-fail',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO check_runs (
          id,
          work_item_id,
          gate_decision_id,
          check_name,
          check_type,
          status,
          required_gate,
          started_at,
          completed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'check-frontier-setup-fail-1',
        'item-merge-setup-fail',
        'gate-frontier-prereq-setup-fail-1',
        'behavioral-frontier verify',
        'behavioral_frontier',
        'passed',
        'red_approval',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.500Z',
        '2026-05-05T00:00:00.500Z',
        '2026-05-05T00:00:00.500Z',
      )
      db.query(
        `INSERT INTO check_runs (
          id,
          work_item_id,
          gate_decision_id,
          check_name,
          check_type,
          status,
          required_gate,
          started_at,
          completed_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'check-tests-setup-fail-1',
        'item-merge-setup-fail',
        null,
        'bun test src/kanban/tests/kanban.gates.spec.ts',
        'tests',
        'passed',
        'frontier_verification',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:01.000Z',
        '2026-05-05T00:00:01.000Z',
        '2026-05-05T00:00:01.000Z',
      )

      const result = await evaluateAndRecordMergeSimulationGate({
        db,
        decisionId: 'gate-merge-setup-fail-1',
        workItemId: 'item-merge-setup-fail',
        actorType: 'agent',
        actorId: 'coder',
        reason: 'setup failures must persist as rejected decisions',
        repoPath,
        sourceRef: 'feature',
        targetRef: 'main',
        requiredCheckRunIds: ['check-frontier-setup-fail-1', 'check-tests-setup-fail-1'],
        simulationWorktreePath: setupFailureWorktreePath,
        decidedAt: '2026-05-05T00:01:00.000Z',
      })

      expect(result.decision).toBe('rejected')
      expect(result.failureCategories).toContain('merge_simulation_execution_error')

      const decisionRow = db
        .query<{ gate_name: string; decision: string }, [string]>(
          `SELECT gate_name, decision
           FROM gate_decisions
           WHERE id = ?`,
        )
        .get('gate-merge-setup-fail-1')
      expect(decisionRow).toEqual({
        gate_name: 'merge_simulation',
        decision: 'rejected',
      })

      const failureRows = db
        .query<{ failure_category: string }, [string]>(
          `SELECT failure_category
           FROM gate_decision_failures
           WHERE gate_decision_id = ?`,
        )
        .all('gate-merge-setup-fail-1')
      expect(failureRows).toContainEqual({ failure_category: 'merge_simulation_execution_error' })

      const eventRow = db
        .query<{ event_kind: string }, []>(
          `SELECT event_kind
           FROM work_item_events
           WHERE work_item_id = 'item-merge-setup-fail'
           ORDER BY occurred_at DESC, created_at DESC
           LIMIT 1`,
        )
        .get()
      expect(eventRow?.event_kind).toBe('merge_simulation_recorded')
    } finally {
      if (db) {
        closeKanbanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
