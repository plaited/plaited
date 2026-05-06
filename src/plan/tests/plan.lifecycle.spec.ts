import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { closePlanDatabase, openPlanDatabase, runWorkItemPostMergeCleanup, startWorkItemExecution } from '../plan.ts'

const seedWorkItem = ({
  db,
  workItemId = '338',
  title = 'Implement worktree and branch cleanup policy',
  specCommitSha = 'sha-lifecycle',
}: {
  db: Awaited<ReturnType<typeof openPlanDatabase>>
  workItemId?: string
  title?: string
  specCommitSha?: string
}) => {
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
    'req-lifecycle',
    'lifecycle request',
    'new',
    'user',
    'user-lifecycle',
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
    workItemId,
    'req-lifecycle',
    title,
    'red_approved',
    `specs/item-${workItemId}.spec.json`,
    specCommitSha,
    '2026-05-05T00:00:00.000Z',
    '2026-05-05T00:00:00.000Z',
  )
}

const seedApprovedRedDecision = ({
  db,
  workItemId,
  decisionId = `gate-red-${workItemId}`,
  decidedAt = '2026-05-05T00:00:30.000Z',
  specCommitSha = 'sha-lifecycle',
  discoveryArtifactId = 'disc-lifecycle-1',
  discoveryArtifactUpdatedAtSnapshot = '2026-05-05T00:00:10.000Z',
}: {
  db: Awaited<ReturnType<typeof openPlanDatabase>>
  workItemId: string
  decisionId?: string
  decidedAt?: string
  specCommitSha?: string
  discoveryArtifactId?: string | null
  discoveryArtifactUpdatedAtSnapshot?: string | null
}) => {
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
    decisionId,
    workItemId,
    'red_approval',
    'approved',
    'agent',
    'analyst',
    'red approval granted',
    discoveryArtifactId,
    discoveryArtifactUpdatedAtSnapshot,
    specCommitSha,
    decidedAt,
    decidedAt,
  )
}

const seedDiscoveryArtifact = ({
  db,
  workItemId,
  artifactId = 'disc-lifecycle-1',
  artifactVersion = 1,
  openQuestions = [],
  collectedAt = '2026-05-05T00:00:10.000Z',
  updatedAt = '2026-05-05T00:00:10.000Z',
}: {
  db: Awaited<ReturnType<typeof openPlanDatabase>>
  workItemId: string
  artifactId?: string
  artifactVersion?: number
  openQuestions?: unknown[]
  collectedAt?: string
  updatedAt?: string
}) => {
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
    artifactId,
    workItemId,
    artifactVersion,
    JSON.stringify([]),
    JSON.stringify([]),
    JSON.stringify(openQuestions),
    JSON.stringify([]),
    collectedAt,
    '2026-05-06T00:00:10.000Z',
    collectedAt,
    updatedAt,
  )
}

const initRepo = async ({ repoPath }: { repoPath: string }) => {
  await mkdir(repoPath, { recursive: true })
  await Bun.$`git init`.cwd(repoPath).quiet()
  await Bun.$`git config user.name "Test User"`.cwd(repoPath).quiet()
  await Bun.$`git config user.email "test@example.com"`.cwd(repoPath).quiet()
  await Bun.$`git checkout -b main`.cwd(repoPath).quiet()
  await Bun.write(join(repoPath, 'README.md'), '# test repo\n')
  await Bun.$`git add .`.cwd(repoPath).quiet()
  await Bun.$`git commit -m "base"`.cwd(repoPath).quiet()
}

describe('plan lifecycle execution environment', () => {
  test('rejects green execution start when dependencies are unresolved before mutating git state', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-plan-lifecycle-'))
    const dbPath = join(tempDir, 'plan.sqlite')
    const repoPath = join(tempDir, 'repo')
    let db: Awaited<ReturnType<typeof openPlanDatabase>> | undefined

    try {
      await initRepo({ repoPath })
      db = await openPlanDatabase({ dbPath })
      seedWorkItem({ db })
      seedDiscoveryArtifact({ db, workItemId: '338' })
      seedApprovedRedDecision({ db, workItemId: '338' })

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
        'dep-1',
        'req-lifecycle',
        'dependency item',
        'green_pending',
        'specs/dep-1.spec.json',
        'sha-dep-1',
        '2026-05-05T00:00:00.000Z',
        '2026-05-05T00:00:00.000Z',
      )
      db.query(
        `INSERT INTO work_item_dependencies (
          work_item_id,
          depends_on_work_item_id,
          created_at
        ) VALUES (?, ?, ?)`,
      ).run('338', 'dep-1', '2026-05-05T00:00:00.000Z')

      await expect(
        startWorkItemExecution({
          db,
          workItemId: '338',
          actorType: 'agent',
          actorId: 'coder',
          repoPath,
          targetRef: 'main',
          occurredAt: '2026-05-05T00:01:00.000Z',
        }),
      ).rejects.toThrow('dependencies_resolved')

      const branchHead =
        await Bun.$`git rev-parse --verify item/338-implement-worktree-and-branch-cleanup-policy^{commit}`
          .cwd(repoPath)
          .quiet()
          .nothrow()
      expect(branchHead.exitCode).not.toBe(0)

      const worktreeGitFileExists = await Bun.file(
        join(repoPath, '.worktrees', '338-implement-worktree-and-branch-cleanup-policy', '.git'),
      ).exists()
      expect(worktreeGitFileExists).toBeFalse()
    } finally {
      if (db) {
        closePlanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('rejects green execution start when the latest approved red decision is stale', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-plan-lifecycle-'))
    const dbPath = join(tempDir, 'plan.sqlite')
    const repoPath = join(tempDir, 'repo')
    let db: Awaited<ReturnType<typeof openPlanDatabase>> | undefined

    try {
      await initRepo({ repoPath })
      db = await openPlanDatabase({ dbPath })
      seedWorkItem({ db })
      seedDiscoveryArtifact({ db, workItemId: '338' })
      seedApprovedRedDecision({
        db,
        workItemId: '338',
        decidedAt: '2026-05-05T00:00:30.000Z',
      })
      db.query(`UPDATE work_items SET spec_commit_sha = ?, updated_at = ? WHERE id = ?`).run(
        'sha-lifecycle-new',
        '2026-05-05T00:00:45.000Z',
        '338',
      )

      await expect(
        startWorkItemExecution({
          db,
          workItemId: '338',
          actorType: 'agent',
          actorId: 'coder',
          repoPath,
          targetRef: 'main',
          occurredAt: '2026-05-05T00:01:00.000Z',
        }),
      ).rejects.toThrow('red_approval_is_fresh')

      const branchHead =
        await Bun.$`git rev-parse --verify item/338-implement-worktree-and-branch-cleanup-policy^{commit}`
          .cwd(repoPath)
          .quiet()
          .nothrow()
      expect(branchHead.exitCode).not.toBe(0)
    } finally {
      if (db) {
        closePlanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('rejects green execution start when no current discovery artifact exists for the latest approved red decision', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-plan-lifecycle-'))
    const dbPath = join(tempDir, 'plan.sqlite')
    const repoPath = join(tempDir, 'repo')
    let db: Awaited<ReturnType<typeof openPlanDatabase>> | undefined

    try {
      await initRepo({ repoPath })
      db = await openPlanDatabase({ dbPath })
      seedWorkItem({ db })
      seedApprovedRedDecision({
        db,
        workItemId: '338',
        discoveryArtifactId: null,
        discoveryArtifactUpdatedAtSnapshot: null,
      })

      await expect(
        startWorkItemExecution({
          db,
          workItemId: '338',
          actorType: 'agent',
          actorId: 'coder',
          repoPath,
          targetRef: 'main',
          occurredAt: '2026-05-05T00:01:00.000Z',
        }),
      ).rejects.toThrow('red_approval_is_fresh')

      const branchHead =
        await Bun.$`git rev-parse --verify item/338-implement-worktree-and-branch-cleanup-policy^{commit}`
          .cwd(repoPath)
          .quiet()
          .nothrow()
      expect(branchHead.exitCode).not.toBe(0)
    } finally {
      if (db) {
        closePlanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('rejects green execution start when a later red revocation supersedes the approval', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-plan-lifecycle-'))
    const dbPath = join(tempDir, 'plan.sqlite')
    const repoPath = join(tempDir, 'repo')
    let db: Awaited<ReturnType<typeof openPlanDatabase>> | undefined

    try {
      await initRepo({ repoPath })
      db = await openPlanDatabase({ dbPath })
      seedWorkItem({ db })
      seedDiscoveryArtifact({ db, workItemId: '338' })
      seedApprovedRedDecision({
        db,
        workItemId: '338',
        decisionId: 'gate-red-338-approved',
        decidedAt: '2026-05-05T00:00:30.000Z',
      })
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
          drift_stale_approval_decision_id,
          drift_signature,
          decided_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'gate-red-338-revoked',
        '338',
        'red_approval',
        'rejected',
        'system',
        'gate-engine',
        'Auto-revoked stale red approval after drift.',
        'sha-lifecycle',
        'gate-red-338-approved',
        '{"kind":"drift"}',
        '2026-05-05T00:00:45.000Z',
        '2026-05-05T00:00:45.000Z',
      )

      await expect(
        startWorkItemExecution({
          db,
          workItemId: '338',
          actorType: 'agent',
          actorId: 'coder',
          repoPath,
          targetRef: 'main',
          occurredAt: '2026-05-05T00:01:00.000Z',
        }),
      ).rejects.toThrow('red_approval_is_fresh')

      const branchHead =
        await Bun.$`git rev-parse --verify item/338-implement-worktree-and-branch-cleanup-policy^{commit}`
          .cwd(repoPath)
          .quiet()
          .nothrow()
      expect(branchHead.exitCode).not.toBe(0)
    } finally {
      if (db) {
        closePlanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('rejects green execution start when latest discovery still has open questions', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-plan-lifecycle-'))
    const dbPath = join(tempDir, 'plan.sqlite')
    const repoPath = join(tempDir, 'repo')
    let db: Awaited<ReturnType<typeof openPlanDatabase>> | undefined

    try {
      await initRepo({ repoPath })
      db = await openPlanDatabase({ dbPath })
      seedWorkItem({ db })

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
        'disc-lifecycle-open-question-1',
        '338',
        1,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([{ id: 'question-1', text: 'What should happen on cancellation?' }]),
        JSON.stringify([]),
        '2026-05-05T00:00:10.000Z',
        '2026-05-06T00:00:10.000Z',
        '2026-05-05T00:00:10.000Z',
        '2026-05-05T00:00:10.000Z',
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
        'gate-red-open-question-lifecycle',
        '338',
        'red_approval',
        'approved',
        'agent',
        'analyst',
        'legacy red approval with unresolved open questions',
        'disc-lifecycle-open-question-1',
        '2026-05-05T00:00:10.000Z',
        'sha-lifecycle',
        '2026-05-05T00:00:30.000Z',
        '2026-05-05T00:00:30.000Z',
      )

      await expect(
        startWorkItemExecution({
          db,
          workItemId: '338',
          actorType: 'agent',
          actorId: 'coder',
          repoPath,
          targetRef: 'main',
          occurredAt: '2026-05-05T00:01:00.000Z',
        }),
      ).rejects.toThrow('open_questions_resolved')

      const branchHead =
        await Bun.$`git rev-parse --verify item/338-implement-worktree-and-branch-cleanup-policy^{commit}`
          .cwd(repoPath)
          .quiet()
          .nothrow()
      expect(branchHead.exitCode).not.toBe(0)
    } finally {
      if (db) {
        closePlanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('treats an older artifact version updated after a newer version as the current discovery artifact', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-plan-lifecycle-'))
    const dbPath = join(tempDir, 'plan.sqlite')
    const repoPath = join(tempDir, 'repo')
    let db: Awaited<ReturnType<typeof openPlanDatabase>> | undefined

    try {
      await initRepo({ repoPath })
      db = await openPlanDatabase({ dbPath })
      seedWorkItem({ db })
      seedDiscoveryArtifact({
        db,
        workItemId: '338',
        artifactId: 'disc-lifecycle-v2',
        artifactVersion: 2,
        openQuestions: [{ id: 'q1', text: 'superseded by later update on v1 artifact' }],
        collectedAt: '2026-05-05T00:00:20.000Z',
        updatedAt: '2026-05-05T00:00:20.000Z',
      })
      seedDiscoveryArtifact({
        db,
        workItemId: '338',
        artifactId: 'disc-lifecycle-v1',
        artifactVersion: 1,
        collectedAt: '2026-05-05T00:00:10.000Z',
        updatedAt: '2026-05-05T00:00:25.000Z',
      })
      seedApprovedRedDecision({
        db,
        workItemId: '338',
        discoveryArtifactId: 'disc-lifecycle-v1',
        discoveryArtifactUpdatedAtSnapshot: '2026-05-05T00:00:25.000Z',
        decidedAt: '2026-05-05T00:00:30.000Z',
      })

      const result = await startWorkItemExecution({
        db,
        workItemId: '338',
        actorType: 'agent',
        actorId: 'coder',
        repoPath,
        targetRef: 'main',
        occurredAt: '2026-05-05T00:01:00.000Z',
      })

      expect(result).toEqual({
        branchRef: 'item/338-implement-worktree-and-branch-cleanup-policy',
        worktreePath: join(repoPath, '.worktrees', '338-implement-worktree-and-branch-cleanup-policy'),
        targetRef: 'main',
      })
    } finally {
      if (db) {
        closePlanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('sanitizes the work-item id segment for git refs and keeps the worktree path under the repo root', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-plan-lifecycle-'))
    const dbPath = join(tempDir, 'plan.sqlite')
    const repoPath = join(tempDir, 'repo')
    let db: Awaited<ReturnType<typeof openPlanDatabase>> | undefined

    try {
      await initRepo({ repoPath })
      db = await openPlanDatabase({ dbPath })
      seedWorkItem({
        db,
        workItemId: '../338 bad/id',
      })
      seedDiscoveryArtifact({
        db,
        workItemId: '../338 bad/id',
      })
      seedApprovedRedDecision({
        db,
        workItemId: '../338 bad/id',
      })

      const result = await startWorkItemExecution({
        db,
        workItemId: '../338 bad/id',
        actorType: 'agent',
        actorId: 'coder',
        repoPath,
        targetRef: 'main',
        occurredAt: '2026-05-05T00:01:00.000Z',
      })

      expect(result).toEqual({
        branchRef: 'item/338-bad-id-implement-worktree-and-branch-cleanup-policy',
        worktreePath: join(repoPath, '.worktrees', '338-bad-id-implement-worktree-and-branch-cleanup-policy'),
        targetRef: 'main',
      })

      const worktreesRoot = resolve(join(repoPath, '.worktrees'))
      expect(resolve(result.worktreePath).startsWith(`${worktreesRoot}/`)).toBeTrue()
    } finally {
      if (db) {
        closePlanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('creates a deterministic branch and worktree and persists them before green execution', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-plan-lifecycle-'))
    const dbPath = join(tempDir, 'plan.sqlite')
    const repoPath = join(tempDir, 'repo')
    let db: Awaited<ReturnType<typeof openPlanDatabase>> | undefined

    try {
      await initRepo({ repoPath })
      db = await openPlanDatabase({ dbPath })
      seedWorkItem({ db })
      seedDiscoveryArtifact({ db, workItemId: '338' })
      seedApprovedRedDecision({ db, workItemId: '338' })

      const result = await startWorkItemExecution({
        db,
        workItemId: '338',
        actorType: 'agent',
        actorId: 'coder',
        repoPath,
        targetRef: 'main',
        occurredAt: '2026-05-05T00:01:00.000Z',
      })

      expect(result).toEqual({
        branchRef: 'item/338-implement-worktree-and-branch-cleanup-policy',
        worktreePath: join(repoPath, '.worktrees', '338-implement-worktree-and-branch-cleanup-policy'),
        targetRef: 'main',
      })

      const worktreeGitFileExists = await Bun.file(join(result.worktreePath, '.git')).exists()
      expect(worktreeGitFileExists).toBeTrue()

      const branchHead = await Bun.$`git rev-parse --verify ${result.branchRef}^{commit}`.cwd(repoPath).quiet()
      expect(branchHead.exitCode).toBe(0)

      const workItemRow = db
        .query<
          {
            status: string
            execution_branch_ref: string | null
            execution_worktree_path: string | null
            execution_target_ref: string | null
          },
          [string]
        >(
          `SELECT status, execution_branch_ref, execution_worktree_path, execution_target_ref
           FROM work_items
           WHERE id = ?`,
        )
        .get('338')
      expect(workItemRow).toEqual({
        status: 'green_pending',
        execution_branch_ref: result.branchRef,
        execution_worktree_path: result.worktreePath,
        execution_target_ref: 'main',
      })

      const latestEvent = db
        .query<{ event_kind: string; payload_json: string }, [string]>(
          `SELECT event_kind, payload_json
           FROM work_item_events
           WHERE work_item_id = ?
           ORDER BY occurred_at DESC, created_at DESC
           LIMIT 1`,
        )
        .get('338')
      expect(latestEvent?.event_kind).toBe('start_green_execution')
      expect(latestEvent ? JSON.parse(latestEvent.payload_json) : null).toEqual({
        actorType: 'agent',
        actorId: 'coder',
        branchRef: result.branchRef,
        worktreePath: result.worktreePath,
        targetRef: 'main',
      })
    } finally {
      if (db) {
        closePlanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('does not create branch or worktree when execution state cannot be persisted', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-plan-lifecycle-'))
    const dbPath = join(tempDir, 'plan.sqlite')
    const repoPath = join(tempDir, 'repo')
    let db: Awaited<ReturnType<typeof openPlanDatabase>> | undefined

    try {
      await initRepo({ repoPath })
      db = await openPlanDatabase({ dbPath })
      seedWorkItem({ db })
      seedDiscoveryArtifact({ db, workItemId: '338' })
      seedApprovedRedDecision({ db, workItemId: '338' })

      db.exec(`
        CREATE TRIGGER abort_green_transition_for_test
        BEFORE UPDATE OF status ON work_items
        WHEN NEW.status = 'green_pending'
        BEGIN
          SELECT RAISE(ABORT, 'test persistence failure');
        END;
      `)

      await expect(
        startWorkItemExecution({
          db,
          workItemId: '338',
          actorType: 'agent',
          actorId: 'coder',
          repoPath,
          targetRef: 'main',
          occurredAt: '2026-05-05T00:01:00.000Z',
        }),
      ).rejects.toThrow('test persistence failure')

      const branchHead =
        await Bun.$`git rev-parse --verify item/338-implement-worktree-and-branch-cleanup-policy^{commit}`
          .cwd(repoPath)
          .quiet()
          .nothrow()
      expect(branchHead.exitCode).not.toBe(0)

      const worktreeGitFileExists = await Bun.file(
        join(repoPath, '.worktrees', '338-implement-worktree-and-branch-cleanup-policy', '.git'),
      ).exists()
      expect(worktreeGitFileExists).toBeFalse()
    } finally {
      if (db) {
        closePlanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('removes the worktree immediately after merge and prunes the branch after the retention TTL', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-plan-lifecycle-'))
    const dbPath = join(tempDir, 'plan.sqlite')
    const repoPath = join(tempDir, 'repo')
    let db: Awaited<ReturnType<typeof openPlanDatabase>> | undefined

    try {
      await initRepo({ repoPath })
      db = await openPlanDatabase({ dbPath })
      seedWorkItem({ db })
      seedDiscoveryArtifact({ db, workItemId: '338' })
      seedApprovedRedDecision({ db, workItemId: '338' })

      const execution = await startWorkItemExecution({
        db,
        workItemId: '338',
        actorType: 'agent',
        actorId: 'coder',
        repoPath,
        targetRef: 'main',
        occurredAt: '2026-05-05T00:01:00.000Z',
      })

      await Bun.write(join(execution.worktreePath, 'feature.txt'), 'feature branch change\n')
      await Bun.$`git add .`.cwd(execution.worktreePath).quiet()
      await Bun.$`git commit -m "feature work"`.cwd(execution.worktreePath).quiet()
      await Bun.$`git merge --no-ff ${execution.branchRef} -m "merge lifecycle item"`.cwd(repoPath).quiet()

      db.query(`UPDATE work_items SET status = ?, updated_at = ? WHERE id = ?`).run(
        'merged',
        '2026-05-05T00:01:30.000Z',
        '338',
      )

      const pendingCleanup = await runWorkItemPostMergeCleanup({
        db,
        workItemId: '338',
        actorType: 'system',
        actorId: 'cleanup-daemon',
        repoPath,
        branchRetentionTtlSeconds: 3600,
        occurredAt: '2026-05-05T00:02:00.000Z',
      })

      expect(pendingCleanup).toEqual({
        status: 'cleanup_pending',
        branchRef: execution.branchRef,
        worktreePath: execution.worktreePath,
        targetRef: 'main',
        branchPruneAfterAt: '2026-05-05T01:02:00.000Z',
        worktreeRemovedAt: '2026-05-05T00:02:00.000Z',
        branchPrunedAt: null,
      })

      const worktreeGitFileExists = await Bun.file(join(execution.worktreePath, '.git')).exists()
      expect(worktreeGitFileExists).toBeFalse()

      const retainedBranch = await Bun.$`git rev-parse --verify ${execution.branchRef}^{commit}`.cwd(repoPath).quiet()
      expect(retainedBranch.exitCode).toBe(0)

      const cleanupPendingRow = db
        .query<
          {
            status: string
            cleanup_branch_prune_after_at: string | null
            cleanup_worktree_removed_at: string | null
            cleanup_branch_pruned_at: string | null
          },
          [string]
        >(
          `SELECT status, cleanup_branch_prune_after_at, cleanup_worktree_removed_at, cleanup_branch_pruned_at
           FROM work_items
           WHERE id = ?`,
        )
        .get('338')
      expect(cleanupPendingRow).toEqual({
        status: 'cleanup_pending',
        cleanup_branch_prune_after_at: '2026-05-05T01:02:00.000Z',
        cleanup_worktree_removed_at: '2026-05-05T00:02:00.000Z',
        cleanup_branch_pruned_at: null,
      })

      const cleaned = await runWorkItemPostMergeCleanup({
        db,
        workItemId: '338',
        actorType: 'system',
        actorId: 'cleanup-daemon',
        repoPath,
        branchRetentionTtlSeconds: 3600,
        occurredAt: '2026-05-05T01:03:00.000Z',
      })

      expect(cleaned).toEqual({
        status: 'cleaned',
        branchRef: execution.branchRef,
        worktreePath: execution.worktreePath,
        targetRef: 'main',
        branchPruneAfterAt: '2026-05-05T01:02:00.000Z',
        worktreeRemovedAt: '2026-05-05T00:02:00.000Z',
        branchPrunedAt: '2026-05-05T01:03:00.000Z',
      })

      const deletedBranch = await Bun.$`git rev-parse --verify ${execution.branchRef}^{commit}`
        .cwd(repoPath)
        .quiet()
        .nothrow()
      expect(deletedBranch.exitCode).not.toBe(0)

      const cleanedRow = db
        .query<
          {
            status: string
            cleanup_branch_prune_after_at: string | null
            cleanup_worktree_removed_at: string | null
            cleanup_branch_pruned_at: string | null
          },
          [string]
        >(
          `SELECT status, cleanup_branch_prune_after_at, cleanup_worktree_removed_at, cleanup_branch_pruned_at
           FROM work_items
           WHERE id = ?`,
        )
        .get('338')
      expect(cleanedRow).toEqual({
        status: 'cleaned',
        cleanup_branch_prune_after_at: '2026-05-05T01:02:00.000Z',
        cleanup_worktree_removed_at: '2026-05-05T00:02:00.000Z',
        cleanup_branch_pruned_at: '2026-05-05T01:03:00.000Z',
      })

      const latestEvents = db
        .query<{ event_kind: string }, [string]>(
          `SELECT event_kind
           FROM work_item_events
           WHERE work_item_id = ?
           ORDER BY occurred_at DESC, created_at DESC
           LIMIT 2`,
        )
        .all('338')
      expect(latestEvents).toEqual([{ event_kind: 'mark_cleaned' }, { event_kind: 'schedule_cleanup' }])
    } finally {
      if (db) {
        closePlanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('persists cleanup_pending on the first cleanup pass even when the persisted prune deadline has already elapsed', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'plaited-plan-lifecycle-'))
    const dbPath = join(tempDir, 'plan.sqlite')
    const repoPath = join(tempDir, 'repo')
    let db: Awaited<ReturnType<typeof openPlanDatabase>> | undefined

    try {
      await initRepo({ repoPath })
      db = await openPlanDatabase({ dbPath })
      seedWorkItem({ db })
      seedDiscoveryArtifact({ db, workItemId: '338' })
      seedApprovedRedDecision({ db, workItemId: '338' })

      const execution = await startWorkItemExecution({
        db,
        workItemId: '338',
        actorType: 'agent',
        actorId: 'coder',
        repoPath,
        targetRef: 'main',
        occurredAt: '2026-05-05T00:01:00.000Z',
      })

      await Bun.write(join(execution.worktreePath, 'feature.txt'), 'feature branch change\n')
      await Bun.$`git add .`.cwd(execution.worktreePath).quiet()
      await Bun.$`git commit -m "feature work"`.cwd(execution.worktreePath).quiet()
      await Bun.$`git merge --no-ff ${execution.branchRef} -m "merge lifecycle item"`.cwd(repoPath).quiet()

      db.query(`UPDATE work_items SET status = ?, updated_at = ? WHERE id = ?`).run(
        'merged',
        '2026-05-05T00:01:30.000Z',
        '338',
      )
      db.query(`UPDATE work_items SET cleanup_branch_prune_after_at = ?, updated_at = ? WHERE id = ?`).run(
        '2026-05-05T00:03:00.000Z',
        '2026-05-05T00:03:00.000Z',
        '338',
      )

      const firstPass = await runWorkItemPostMergeCleanup({
        db,
        workItemId: '338',
        actorType: 'system',
        actorId: 'cleanup-daemon',
        repoPath,
        branchRetentionTtlSeconds: 60,
        occurredAt: '2026-05-05T01:03:00.000Z',
      })

      expect(firstPass).toEqual({
        status: 'cleanup_pending',
        branchRef: execution.branchRef,
        worktreePath: execution.worktreePath,
        targetRef: 'main',
        branchPruneAfterAt: '2026-05-05T00:03:00.000Z',
        worktreeRemovedAt: '2026-05-05T01:03:00.000Z',
        branchPrunedAt: null,
      })

      const retainedBranch = await Bun.$`git rev-parse --verify ${execution.branchRef}^{commit}`.cwd(repoPath).quiet()
      expect(retainedBranch.exitCode).toBe(0)

      const latestEvents = db
        .query<{ event_kind: string }, [string]>(
          `SELECT event_kind
           FROM work_item_events
           WHERE work_item_id = ?
           ORDER BY occurred_at DESC, created_at DESC
           LIMIT 2`,
        )
        .all('338')
      expect(latestEvents).toEqual([{ event_kind: 'schedule_cleanup' }, { event_kind: 'start_green_execution' }])
    } finally {
      if (db) {
        closePlanDatabase(db)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
