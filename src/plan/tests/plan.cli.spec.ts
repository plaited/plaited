import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { closePlanDatabase, openPlanDatabase } from '../plan.ts'

const CLI_PACKAGE_ROOT = resolve(import.meta.dir, '../../../')

const tempPaths: string[] = []

const trackTempPath = (path: string): string => {
  tempPaths.push(path)
  return path
}

const runPlanCommand = async (input: unknown) =>
  Bun.$`bun ./bin/plaited.ts plan ${JSON.stringify(input)}`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()

const seedProjectionFixture = async (): Promise<string> => {
  const tempDir = trackTempPath(await mkdtemp(join(tmpdir(), 'plaited-plan-cli-')))
  const dbPath = join(tempDir, 'plan.sqlite')
  const db = await openPlanDatabase({ dbPath })

  try {
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
      'req-plan-cli',
      'projection request',
      'new',
      'user',
      'user-plan-cli',
      '2026-05-05T00:00:00.000Z',
      '2026-05-05T00:00:00.000Z',
    )

    const insertWorkItem = db.query(
      `INSERT INTO work_items (
        id,
        request_id,
        title,
        status,
        spec_path,
        spec_commit_sha,
        execution_branch_ref,
        execution_worktree_path,
        execution_target_ref,
        execution_prepared_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )

    insertWorkItem.run(
      'formulated-1',
      'req-plan-cli',
      'Formulated item',
      'formulated',
      'specs/formulated-1.json',
      'sha-formulated-1',
      null,
      null,
      null,
      null,
      '2026-05-05T00:00:00.000Z',
      '2026-05-05T00:00:00.000Z',
    )
    insertWorkItem.run(
      'formulated-blocked-1',
      'req-plan-cli',
      'Formulated item with unresolved dependency',
      'formulated',
      'specs/formulated-blocked-1.json',
      'sha-formulated-blocked-1',
      null,
      null,
      null,
      null,
      '2026-05-05T00:00:00.500Z',
      '2026-05-05T00:00:00.500Z',
    )
    insertWorkItem.run(
      'ready-1',
      'req-plan-cli',
      'Ready item',
      'red_approved',
      'specs/ready-1.json',
      'sha-ready-1',
      null,
      null,
      null,
      null,
      '2026-05-05T00:00:01.000Z',
      '2026-05-05T00:00:01.000Z',
    )
    insertWorkItem.run(
      'dep-blocked',
      'req-plan-cli',
      'Blocking dependency',
      'green_pending',
      'specs/dep-blocked.json',
      'sha-dep-blocked',
      null,
      null,
      null,
      null,
      '2026-05-05T00:00:02.000Z',
      '2026-05-05T00:00:02.000Z',
    )
    insertWorkItem.run(
      'blocked-1',
      'req-plan-cli',
      'Blocked item',
      'red_approved',
      'specs/blocked-1.json',
      'sha-blocked-1',
      null,
      null,
      null,
      null,
      '2026-05-05T00:00:03.000Z',
      '2026-05-05T00:00:03.000Z',
    )
    insertWorkItem.run(
      'dep-cleaned',
      'req-plan-cli',
      'Completed dependency',
      'cleaned',
      'specs/dep-cleaned.json',
      'sha-dep-cleaned',
      null,
      null,
      null,
      null,
      '2026-05-05T00:00:04.000Z',
      '2026-05-05T00:00:04.000Z',
    )
    insertWorkItem.run(
      'wip-1',
      'req-plan-cli',
      'Green pending item',
      'green_pending',
      'specs/wip-1.json',
      'sha-wip-1',
      'item/wip-1-green-pending-item',
      '/tmp/plaited/.worktrees/wip-1-green-pending-item',
      'main',
      '2026-05-05T00:10:00.000Z',
      '2026-05-05T00:00:05.000Z',
      '2026-05-05T00:10:00.000Z',
    )
    insertWorkItem.run(
      'merged-1',
      'req-plan-cli',
      'Merged item',
      'merged',
      'specs/merged-1.json',
      'sha-merged-1',
      'item/merged-1-merged-item',
      '/tmp/plaited/.worktrees/merged-1-merged-item',
      'main',
      '2026-05-05T00:12:00.000Z',
      '2026-05-05T00:00:06.000Z',
      '2026-05-05T00:12:00.000Z',
    )
    insertWorkItem.run(
      'cleanup-pending-future-1',
      'req-plan-cli',
      'Cleanup pending future item',
      'cleanup_pending',
      'specs/cleanup-pending-future-1.json',
      'sha-cleanup-pending-future-1',
      'item/cleanup-pending-future-1-cleanup-pending-item',
      '/tmp/plaited/.worktrees/cleanup-pending-future-1-cleanup-pending-item',
      'main',
      '2026-05-05T00:13:00.000Z',
      '2026-05-05T00:00:07.000Z',
      '2026-05-05T00:13:00.000Z',
    )
    insertWorkItem.run(
      'cleanup-pending-elapsed-1',
      'req-plan-cli',
      'Cleanup pending elapsed item',
      'cleanup_pending',
      'specs/cleanup-pending-elapsed-1.json',
      'sha-cleanup-pending-elapsed-1',
      'item/cleanup-pending-elapsed-1-cleanup-pending-item',
      '/tmp/plaited/.worktrees/cleanup-pending-elapsed-1-cleanup-pending-item',
      'main',
      '2026-05-05T00:14:00.000Z',
      '2026-05-05T00:00:08.000Z',
      '2026-05-05T00:14:00.000Z',
    )
    insertWorkItem.run(
      'stale-red-1',
      'req-plan-cli',
      'Stale red approval item',
      'red_approved',
      'specs/stale-red-1.json',
      'sha-stale-red-1',
      null,
      null,
      null,
      null,
      '2026-05-05T00:00:09.000Z',
      '2026-05-05T00:00:09.000Z',
    )
    insertWorkItem.run(
      'revoked-red-1',
      'req-plan-cli',
      'Revoked red approval item',
      'red_approved',
      'specs/revoked-red-1.json',
      'sha-revoked-red-1',
      null,
      null,
      null,
      null,
      '2026-05-05T00:00:09.500Z',
      '2026-05-05T00:00:09.500Z',
    )
    insertWorkItem.run(
      'missing-artifact-red-1',
      'req-plan-cli',
      'Missing artifact red approval item',
      'red_approved',
      'specs/missing-artifact-red-1.json',
      'sha-missing-artifact-red-1',
      null,
      null,
      null,
      null,
      '2026-05-05T00:00:09.750Z',
      '2026-05-05T00:00:09.750Z',
    )

    db.query(
      `UPDATE work_items
       SET cleanup_branch_prune_after_at = ?, cleanup_worktree_removed_at = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      '2026-05-05T02:00:00.000Z',
      '2026-05-05T00:13:00.000Z',
      '2026-05-05T00:13:00.000Z',
      'cleanup-pending-future-1',
    )
    db.query(
      `UPDATE work_items
       SET cleanup_branch_prune_after_at = ?, cleanup_worktree_removed_at = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      '2026-05-05T00:30:00.000Z',
      '2026-05-05T00:14:00.000Z',
      '2026-05-05T00:14:00.000Z',
      'cleanup-pending-elapsed-1',
    )

    db.query(
      `INSERT INTO work_item_dependencies (
        work_item_id,
        depends_on_work_item_id,
        created_at
      ) VALUES (?, ?, ?)`,
    ).run('blocked-1', 'dep-blocked', '2026-05-05T00:05:00.000Z')
    db.query(
      `INSERT INTO work_item_dependencies (
        work_item_id,
        depends_on_work_item_id,
        created_at
      ) VALUES (?, ?, ?)`,
    ).run('formulated-blocked-1', 'dep-blocked', '2026-05-05T00:05:30.000Z')
    db.query(
      `INSERT INTO work_item_dependencies (
        work_item_id,
        depends_on_work_item_id,
        created_at
      ) VALUES (?, ?, ?)`,
    ).run('wip-1', 'dep-cleaned', '2026-05-05T00:06:00.000Z')

    const insertDiscoveryArtifact = db.query(
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

    insertDiscoveryArtifact.run(
      'disc-ready-1',
      'ready-1',
      1,
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      '2026-05-05T00:18:00.000Z',
      '2026-05-06T00:18:00.000Z',
      '2026-05-05T00:18:00.000Z',
      '2026-05-05T00:19:30.000Z',
    )
    insertDiscoveryArtifact.run(
      'disc-ready-1-newer-version',
      'ready-1',
      2,
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([{ id: 'ready-1-q1', text: 'Superseded by later update on v1 artifact' }]),
      JSON.stringify([]),
      '2026-05-05T00:19:00.000Z',
      '2026-05-06T00:19:00.000Z',
      '2026-05-05T00:19:00.000Z',
      '2026-05-05T00:19:00.000Z',
    )
    insertDiscoveryArtifact.run(
      'disc-blocked-1',
      'blocked-1',
      1,
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      '2026-05-05T00:19:00.000Z',
      '2026-05-06T00:19:00.000Z',
      '2026-05-05T00:19:00.000Z',
      '2026-05-05T00:19:00.000Z',
    )
    insertDiscoveryArtifact.run(
      'disc-wip-1',
      'wip-1',
      1,
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      '2026-05-05T00:21:00.000Z',
      '2026-05-06T00:21:00.000Z',
      '2026-05-05T00:21:00.000Z',
      '2026-05-05T00:21:00.000Z',
    )
    insertDiscoveryArtifact.run(
      'disc-stale-red-1-approved',
      'stale-red-1',
      1,
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      '2026-05-05T00:20:00.000Z',
      '2026-05-06T00:20:00.000Z',
      '2026-05-05T00:20:00.000Z',
      '2026-05-05T00:20:00.000Z',
    )
    insertDiscoveryArtifact.run(
      'disc-stale-red-1-latest',
      'stale-red-1',
      2,
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      '2026-05-05T00:25:00.000Z',
      '2026-05-06T00:25:00.000Z',
      '2026-05-05T00:25:00.000Z',
      '2026-05-05T00:25:00.000Z',
    )

    const insertDecision = db.query(
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
    )

    insertDecision.run(
      'gate-red-ready-1',
      'ready-1',
      'red_approval',
      'approved',
      'agent',
      'gpt-5.5',
      'ready for implementation',
      'disc-ready-1',
      '2026-05-05T00:19:30.000Z',
      'sha-ready-1',
      null,
      null,
      '2026-05-05T00:20:00.000Z',
      '2026-05-05T00:20:00.000Z',
    )
    insertDecision.run(
      'gate-red-blocked-1',
      'blocked-1',
      'red_approval',
      'approved',
      'agent',
      'gpt-5.5',
      'dependency still pending',
      'disc-blocked-1',
      '2026-05-05T00:19:00.000Z',
      'sha-blocked-1',
      null,
      null,
      '2026-05-05T00:21:00.000Z',
      '2026-05-05T00:21:00.000Z',
    )
    insertDecision.run(
      'gate-red-wip-1',
      'wip-1',
      'red_approval',
      'approved',
      'agent',
      'gpt-5.5',
      'tests demonstrate missing behavior',
      'disc-wip-1',
      '2026-05-05T00:21:00.000Z',
      'sha-wip-1',
      null,
      null,
      '2026-05-05T00:22:00.000Z',
      '2026-05-05T00:22:00.000Z',
    )
    insertDecision.run(
      'gate-red-stale-red-1',
      'stale-red-1',
      'red_approval',
      'approved',
      'agent',
      'gpt-5.5',
      'red approval predates latest discovery artifact',
      'disc-stale-red-1-approved',
      '2026-05-05T00:20:00.000Z',
      'sha-stale-red-1',
      null,
      null,
      '2026-05-05T00:30:00.000Z',
      '2026-05-05T00:30:00.000Z',
    )
    insertDecision.run(
      'gate-red-revoked-red-1-approved',
      'revoked-red-1',
      'red_approval',
      'approved',
      'agent',
      'gpt-5.5',
      'red approval granted before later revocation',
      null,
      null,
      'sha-revoked-red-1',
      null,
      null,
      '2026-05-05T00:31:00.000Z',
      '2026-05-05T00:31:00.000Z',
    )
    insertDecision.run(
      'gate-red-revoked-red-1-rejected',
      'revoked-red-1',
      'red_approval',
      'rejected',
      'system',
      'gate-engine',
      'Auto-revoked stale red approval after drift.',
      null,
      null,
      'sha-revoked-red-1',
      'gate-red-revoked-red-1-approved',
      '{"kind":"drift"}',
      '2026-05-05T00:32:00.000Z',
      '2026-05-05T00:32:00.000Z',
    )
    insertDecision.run(
      'gate-red-missing-artifact-red-1',
      'missing-artifact-red-1',
      'red_approval',
      'approved',
      'agent',
      'gpt-5.5',
      'legacy approval without a discovery artifact link',
      null,
      null,
      'sha-missing-artifact-red-1',
      null,
      null,
      '2026-05-05T00:33:00.000Z',
      '2026-05-05T00:33:00.000Z',
    )

    db.query(
      `INSERT INTO gate_decision_evidence_cache_refs (
        gate_decision_id,
        context_db_path,
        evidence_cache_row_id
      ) VALUES (?, ?, ?)`,
    ).run('gate-red-wip-1', '/tmp/context.sqlite', 7)
    db.query(
      `INSERT INTO gate_decision_failures (
        gate_decision_id,
        failure_category,
        check_name,
        detail
      ) VALUES (?, ?, ?, ?)`,
    ).run(
      'gate-red-wip-1',
      'expected_behavior_fail',
      'bun test src/plan/tests/plan.cli.spec.ts',
      'failing regression proves the behavior gap',
    )
  } finally {
    closePlanDatabase(db)
  }

  return dbPath
}

const seedStaleMergeProjectionFixture = async (): Promise<string> => {
  const tempDir = trackTempPath(await mkdtemp(join(tmpdir(), 'plaited-plan-cli-')))
  const dbPath = join(tempDir, 'plan.sqlite')
  const db = await openPlanDatabase({ dbPath })

  try {
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
      'req-stale-merge-cli',
      'stale merge projection request',
      'new',
      'user',
      'user-stale-merge-cli',
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
      'review-stale-merge-1',
      'req-stale-merge-cli',
      'Review item with stale merge simulation',
      'review_pending',
      'specs/review-stale-merge-1.json',
      'new-spec-sha',
      '2026-05-05T00:00:00.000Z',
      '2026-05-05T00:10:00.000Z',
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
      'review-missing-merge-evidence-1',
      'req-stale-merge-cli',
      'Review item missing merge simulation evidence',
      'review_pending',
      'specs/review-missing-merge-evidence-1.json',
      'current-spec-sha',
      '2026-05-05T00:00:00.000Z',
      '2026-05-05T00:10:00.000Z',
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
      'review-overflow-merge-1',
      'req-stale-merge-cli',
      'Review item with overflowed merge simulation audit history',
      'review_pending',
      'specs/review-overflow-merge-1.json',
      'current-spec-sha',
      '2026-05-05T00:00:00.000Z',
      '2026-05-05T00:10:00.000Z',
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
      'gate-merge-stale-cli-1',
      'review-stale-merge-1',
      'merge_simulation',
      'approved',
      'agent',
      'gpt-5.5',
      'merge simulation passed for a previous spec revision',
      'old-spec-sha',
      '2026-05-05T00:05:00.000Z',
      '2026-05-05T00:05:00.000Z',
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
      'gate-merge-missing-evidence-cli-1',
      'review-missing-merge-evidence-1',
      'merge_simulation',
      'approved',
      'agent',
      'gpt-5.5',
      'merge simulation decision lacks a persisted check run',
      'current-spec-sha',
      '2026-05-05T00:05:00.000Z',
      '2026-05-05T00:05:00.000Z',
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
      'gate-merge-overflow-cli-1',
      'review-overflow-merge-1',
      'merge_simulation',
      'approved',
      'agent',
      'gpt-5.5',
      'merge simulation remains valid despite later unrelated decisions',
      'current-spec-sha',
      '2026-05-05T00:05:00.000Z',
      '2026-05-05T00:05:00.000Z',
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
      'check-merge-overflow-cli-1',
      'review-overflow-merge-1',
      'gate-merge-overflow-cli-1',
      'merge simulation replay',
      'merge_simulation',
      'passed',
      'frontier_verification',
      '2026-05-05T00:05:30.000Z',
      '2026-05-05T00:05:45.000Z',
      '2026-05-05T00:05:45.000Z',
      '2026-05-05T00:05:45.000Z',
    )

    const insertOverflowDecision = db.query(
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
    )
    for (let index = 0; index < 21; index += 1) {
      const minute = `${index + 6}`.padStart(2, '0')
      insertOverflowDecision.run(
        `gate-overflow-${index + 1}`,
        'review-overflow-merge-1',
        index % 2 === 0 ? 'red_approval' : 'frontier_verification',
        index % 3 === 0 ? 'rejected' : 'approved',
        'agent',
        'gpt-5.5',
        `newer non-merge decision ${index + 1}`,
        'current-spec-sha',
        `2026-05-05T00:${minute}:00.000Z`,
        `2026-05-05T00:${minute}:00.000Z`,
      )
    }
  } finally {
    closePlanDatabase(db)
  }

  return dbPath
}

afterEach(async () => {
  while (tempPaths.length > 0) {
    const path = tempPaths.pop()
    if (path) {
      await rm(path, { recursive: true, force: true })
    }
  }
})

describe('plan CLI', () => {
  test('plaited --schema includes plan and plan --schema input exposes projection modes', async () => {
    const manifestResult = await Bun.$`bun ./bin/plaited.ts --schema`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()

    expect(manifestResult.exitCode).toBe(0)
    const manifest = JSON.parse(manifestResult.stdout.toString().trim()) as { commands: string[] }
    expect(manifest.commands).toContain('plan')

    const inputSchemaResult = await Bun.$`bun ./bin/plaited.ts plan --schema input`
      .cwd(CLI_PACKAGE_ROOT)
      .quiet()
      .nothrow()

    expect(inputSchemaResult.exitCode).toBe(0)
    const inputSchema = JSON.parse(inputSchemaResult.stdout.toString().trim()) as {
      description?: string
      oneOf?: Array<{ properties?: { mode?: { const?: string }; nowIso?: { type?: string; pattern?: string } } }>
      anyOf?: Array<{ properties?: { mode?: { const?: string }; nowIso?: { type?: string; pattern?: string } } }>
    }
    expect(inputSchema.description).toContain('agent-facing projection')

    const branches = inputSchema.oneOf ?? inputSchema.anyOf ?? []
    const modes = branches.map((branch) => branch.properties?.mode?.const).filter((value) => value !== undefined)
    expect(modes).toEqual(['board', 'item', 'ready-queue', 'decision-audit'])

    const readyQueueBranch = branches.find((branch) => branch.properties?.mode?.const === 'ready-queue')
    expect(readyQueueBranch?.properties?.nowIso?.type).toBe('string')
    expect(readyQueueBranch?.properties?.nowIso?.pattern).toBe('^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$')
  })

  test('board mode projects items by state plus blockers and WIP summary', async () => {
    const dbPath = await seedProjectionFixture()

    const result = await runPlanCommand({
      mode: 'board',
      dbPath,
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim()) as {
      mode: string
      dbPath: string
      states: Array<{
        state: string
        total: number
        items: Array<{ id: string; unresolvedDependencyCount: number }>
      }>
      blockers: Array<{
        workItemId: string
        unresolvedDependencies: Array<{ id: string; status: string }>
      }>
      wip: {
        total: number
        byState: Array<{ state: string; total: number }>
        items: Array<{ id: string; status: string }>
      }
    }

    expect(output.mode).toBe('board')
    expect(output.dbPath).toBe(resolve(dbPath))
    expect(output.states).toContainEqual({
      state: 'formulated',
      total: 2,
      items: [
        { id: 'formulated-1', unresolvedDependencyCount: 0 },
        { id: 'formulated-blocked-1', unresolvedDependencyCount: 1 },
      ],
    })
    expect(output.states).toContainEqual({
      state: 'red_approved',
      total: 5,
      items: [
        { id: 'blocked-1', unresolvedDependencyCount: 1 },
        { id: 'missing-artifact-red-1', unresolvedDependencyCount: 0 },
        { id: 'ready-1', unresolvedDependencyCount: 0 },
        { id: 'revoked-red-1', unresolvedDependencyCount: 0 },
        { id: 'stale-red-1', unresolvedDependencyCount: 0 },
      ],
    })
    expect(output.blockers).toEqual([
      {
        workItemId: 'formulated-blocked-1',
        unresolvedDependencies: [{ id: 'dep-blocked', status: 'green_pending' }],
      },
      {
        workItemId: 'blocked-1',
        unresolvedDependencies: [{ id: 'dep-blocked', status: 'green_pending' }],
      },
    ])
    expect(output.wip).toEqual({
      total: 10,
      byState: [
        { state: 'red_approved', total: 5 },
        { state: 'green_pending', total: 2 },
        { state: 'merged', total: 1 },
        { state: 'cleanup_pending', total: 2 },
      ],
      items: [
        { id: 'blocked-1', status: 'red_approved' },
        { id: 'missing-artifact-red-1', status: 'red_approved' },
        { id: 'ready-1', status: 'red_approved' },
        { id: 'revoked-red-1', status: 'red_approved' },
        { id: 'stale-red-1', status: 'red_approved' },
        { id: 'dep-blocked', status: 'green_pending' },
        { id: 'wip-1', status: 'green_pending' },
        { id: 'merged-1', status: 'merged' },
        { id: 'cleanup-pending-elapsed-1', status: 'cleanup_pending' },
        { id: 'cleanup-pending-future-1', status: 'cleanup_pending' },
      ],
    })
  })

  test('item mode projects state, dependencies, gate status, and execution environment', async () => {
    const dbPath = await seedProjectionFixture()

    const result = await runPlanCommand({
      mode: 'item',
      dbPath,
      workItemId: 'wip-1',
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim()) as {
      mode: string
      dbPath: string
      item: {
        id: string
        requestId: string
        title: string
        status: string
        specPath: string | null
        specCommitSha: string | null
        guards: {
          dependenciesResolved: boolean
          redApprovalIsFresh: boolean
          mergeGatePassed: boolean
          openQuestionsResolved: boolean
        }
        execution: {
          branchRef: string
          worktreePath: string
          targetRef: string
          preparedAt: string | null
        } | null
        cleanup: {
          branchPruneAfterAt: string | null
          worktreeRemovedAt: string | null
          branchPrunedAt: string | null
        } | null
        dependencies: Array<{
          id: string
          title: string
          status: string
          isResolved: boolean
        }>
        gateStatus: {
          redApproval: { latestDecision: string; decidedAt: string } | null
          frontierVerification: { latestDecision: string; decidedAt: string } | null
          mergeSimulation: { latestDecision: string; decidedAt: string } | null
        }
        latestDecisions: Array<{
          id: string
          gateName: string
          decision: string
          reason: string
          specCommitSha: string | null
          decidedAt: string
          failureCategories: string[]
          evidenceRefs: Array<{ contextDbPath: string; evidenceCacheRowId: number }>
        }>
      }
    }

    expect(output.mode).toBe('item')
    expect(output.dbPath).toBe(resolve(dbPath))
    expect(output.item).toEqual({
      id: 'wip-1',
      requestId: 'req-plan-cli',
      title: 'Green pending item',
      status: 'green_pending',
      specPath: 'specs/wip-1.json',
      specCommitSha: 'sha-wip-1',
      guards: {
        dependenciesResolved: true,
        redApprovalIsFresh: true,
        mergeGatePassed: false,
        openQuestionsResolved: true,
      },
      execution: {
        branchRef: 'item/wip-1-green-pending-item',
        worktreePath: '/tmp/plaited/.worktrees/wip-1-green-pending-item',
        targetRef: 'main',
        preparedAt: '2026-05-05T00:10:00.000Z',
      },
      cleanup: null,
      dependencies: [
        {
          id: 'dep-cleaned',
          title: 'Completed dependency',
          status: 'cleaned',
          isResolved: true,
        },
      ],
      gateStatus: {
        redApproval: {
          latestDecision: 'approved',
          decidedAt: '2026-05-05T00:22:00.000Z',
        },
        frontierVerification: null,
        mergeSimulation: null,
      },
      latestDecisions: [
        {
          id: 'gate-red-wip-1',
          gateName: 'red_approval',
          decision: 'approved',
          reason: 'tests demonstrate missing behavior',
          specCommitSha: 'sha-wip-1',
          decidedAt: '2026-05-05T00:22:00.000Z',
          failureCategories: ['expected_behavior_fail'],
          evidenceRefs: [{ contextDbPath: '/tmp/context.sqlite', evidenceCacheRowId: 7 }],
        },
      ],
    })
  })

  test('ready-queue mode projects deterministic next actionable items', async () => {
    const dbPath = await seedProjectionFixture()

    const result = await runPlanCommand({
      mode: 'ready-queue',
      dbPath,
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim()) as {
      mode: string
      dbPath: string
      readyItems: Array<{
        workItemId: string
        title: string
        status: string
        nextEvent: string
      }>
    }

    expect(output.mode).toBe('ready-queue')
    expect(output.dbPath).toBe(resolve(dbPath))
    expect(output.readyItems.some((item) => item.nextEvent === 'mark_cleaned')).toBeFalse()
    expect(output.readyItems).toEqual([
      {
        workItemId: 'formulated-1',
        title: 'Formulated item',
        status: 'formulated',
        nextEvent: 'request_red_approval',
      },
      {
        workItemId: 'ready-1',
        title: 'Ready item',
        status: 'red_approved',
        nextEvent: 'start_green_execution',
      },
      {
        workItemId: 'wip-1',
        title: 'Green pending item',
        status: 'green_pending',
        nextEvent: 'submit_for_review',
      },
      {
        workItemId: 'merged-1',
        title: 'Merged item',
        status: 'merged',
        nextEvent: 'schedule_cleanup',
      },
    ])
    expect(output.readyItems.some((item) => item.workItemId === 'formulated-blocked-1')).toBeFalse()
  })

  test('projection treats an older artifact version updated after a newer version as the current discovery artifact', async () => {
    const dbPath = await seedProjectionFixture()

    const readyQueueResult = await runPlanCommand({
      mode: 'ready-queue',
      dbPath,
    })

    expect(readyQueueResult.exitCode).toBe(0)
    const readyQueueOutput = JSON.parse(readyQueueResult.stdout.toString().trim()) as {
      readyItems: Array<{
        workItemId: string
        title: string
        status: string
        nextEvent: string
      }>
    }
    expect(readyQueueOutput.readyItems).toContainEqual({
      workItemId: 'ready-1',
      title: 'Ready item',
      status: 'red_approved',
      nextEvent: 'start_green_execution',
    })

    const itemResult = await runPlanCommand({
      mode: 'item',
      dbPath,
      workItemId: 'ready-1',
    })

    expect(itemResult.exitCode).toBe(0)
    const itemOutput = JSON.parse(itemResult.stdout.toString().trim()) as {
      item: {
        guards: {
          dependenciesResolved: boolean
          redApprovalIsFresh: boolean
          mergeGatePassed: boolean
          openQuestionsResolved: boolean
        }
      }
    }
    expect(itemOutput.item.guards).toEqual({
      dependenciesResolved: true,
      redApprovalIsFresh: true,
      mergeGatePassed: false,
      openQuestionsResolved: true,
    })
  })

  test('ready-queue omits execution states that lack required gate provenance', async () => {
    const dbPath = await seedProjectionFixture()
    const db = await openPlanDatabase({ dbPath })

    try {
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
        'merge-ready-without-gate-1',
        'req-plan-cli',
        'Merge ready without gate provenance',
        'merge_ready',
        'specs/merge-ready-without-gate-1.json',
        'sha-merge-ready-without-gate-1',
        '2026-05-05T00:00:09.500Z',
        '2026-05-05T00:00:09.500Z',
      )
    } finally {
      closePlanDatabase(db)
    }

    const result = await runPlanCommand({
      mode: 'ready-queue',
      dbPath,
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim()) as {
      readyItems: Array<{
        workItemId: string
        nextEvent: string
      }>
    }

    expect(
      output.readyItems.some((item) => item.workItemId === 'dep-blocked' && item.nextEvent === 'submit_for_review'),
    ).toBeFalse()
    expect(
      output.readyItems.some(
        (item) => item.workItemId === 'merge-ready-without-gate-1' && item.nextEvent === 'mark_merged',
      ),
    ).toBeFalse()
  })

  test('ready-queue includes cleanup completion only when nowIso reaches prune deadline', async () => {
    const dbPath = await seedProjectionFixture()

    const result = await runPlanCommand({
      mode: 'ready-queue',
      dbPath,
      nowIso: '2026-05-05T00:30:00.000Z',
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim()) as {
      readyItems: Array<{
        workItemId: string
        title: string
        status: string
        nextEvent: string
      }>
    }

    expect(output.readyItems).toContainEqual({
      workItemId: 'cleanup-pending-elapsed-1',
      title: 'Cleanup pending elapsed item',
      status: 'cleanup_pending',
      nextEvent: 'mark_cleaned',
    })
    expect(output.readyItems).not.toContainEqual({
      workItemId: 'cleanup-pending-future-1',
      title: 'Cleanup pending future item',
      status: 'cleanup_pending',
      nextEvent: 'mark_cleaned',
    })
  })

  test('ready-queue rejects malformed nowIso values', async () => {
    const dbPath = await seedProjectionFixture()

    const result = await runPlanCommand({
      mode: 'ready-queue',
      dbPath,
      nowIso: 'zzz',
    })

    expect(result.exitCode).toBe(2)
    const stderr = result.stderr.toString()
    expect(stderr).toContain('nowIso')
  })

  test('ready-queue omits red approvals when discovery artifact identity has drifted', async () => {
    const dbPath = await seedProjectionFixture()

    const readyQueueResult = await runPlanCommand({
      mode: 'ready-queue',
      dbPath,
    })

    expect(readyQueueResult.exitCode).toBe(0)
    const readyQueueOutput = JSON.parse(readyQueueResult.stdout.toString().trim()) as {
      readyItems: Array<{
        workItemId: string
        nextEvent: string
      }>
    }
    expect(readyQueueOutput.readyItems).not.toContainEqual({
      workItemId: 'stale-red-1',
      nextEvent: 'start_green_execution',
    })

    const itemResult = await runPlanCommand({
      mode: 'item',
      dbPath,
      workItemId: 'stale-red-1',
    })

    expect(itemResult.exitCode).toBe(0)
    const itemOutput = JSON.parse(itemResult.stdout.toString().trim()) as {
      item: {
        guards: {
          redApprovalIsFresh: boolean
        }
      }
    }
    expect(itemOutput.item.guards.redApprovalIsFresh).toBeFalse()
  })

  test('ready-queue omits red approvals when no current discovery artifact exists', async () => {
    const dbPath = await seedProjectionFixture()

    const readyQueueResult = await runPlanCommand({
      mode: 'ready-queue',
      dbPath,
    })

    expect(readyQueueResult.exitCode).toBe(0)
    const readyQueueOutput = JSON.parse(readyQueueResult.stdout.toString().trim()) as {
      readyItems: Array<{
        workItemId: string
        nextEvent: string
      }>
    }
    expect(readyQueueOutput.readyItems).not.toContainEqual({
      workItemId: 'missing-artifact-red-1',
      nextEvent: 'start_green_execution',
    })

    const itemResult = await runPlanCommand({
      mode: 'item',
      dbPath,
      workItemId: 'missing-artifact-red-1',
    })

    expect(itemResult.exitCode).toBe(0)
    const itemOutput = JSON.parse(itemResult.stdout.toString().trim()) as {
      item: {
        guards: {
          redApprovalIsFresh: boolean
        }
      }
    }
    expect(itemOutput.item.guards.redApprovalIsFresh).toBeFalse()
  })

  test('ready-queue omits formulated items when dependencies are unresolved', async () => {
    const dbPath = await seedProjectionFixture()

    const readyQueueResult = await runPlanCommand({
      mode: 'ready-queue',
      dbPath,
    })

    expect(readyQueueResult.exitCode).toBe(0)
    const readyQueueOutput = JSON.parse(readyQueueResult.stdout.toString().trim()) as {
      readyItems: Array<{
        workItemId: string
        title: string
        status: string
        nextEvent: string
      }>
    }
    expect(readyQueueOutput.readyItems).not.toContainEqual({
      workItemId: 'formulated-blocked-1',
      title: 'Formulated item with unresolved dependency',
      status: 'formulated',
      nextEvent: 'request_red_approval',
    })

    const itemResult = await runPlanCommand({
      mode: 'item',
      dbPath,
      workItemId: 'formulated-blocked-1',
    })

    expect(itemResult.exitCode).toBe(0)
    const itemOutput = JSON.parse(itemResult.stdout.toString().trim()) as {
      item: {
        guards: {
          dependenciesResolved: boolean
        }
      }
    }
    expect(itemOutput.item.guards.dependenciesResolved).toBeFalse()
  })

  test('ready-queue omits red approvals when a later red rejection revokes the approval', async () => {
    const dbPath = await seedProjectionFixture()

    const readyQueueResult = await runPlanCommand({
      mode: 'ready-queue',
      dbPath,
    })

    expect(readyQueueResult.exitCode).toBe(0)
    const readyQueueOutput = JSON.parse(readyQueueResult.stdout.toString().trim()) as {
      readyItems: Array<{
        workItemId: string
        nextEvent: string
      }>
    }
    expect(readyQueueOutput.readyItems.some((item) => item.workItemId === 'revoked-red-1')).toBeFalse()

    const itemResult = await runPlanCommand({
      mode: 'item',
      dbPath,
      workItemId: 'revoked-red-1',
    })

    expect(itemResult.exitCode).toBe(0)
    const itemOutput = JSON.parse(itemResult.stdout.toString().trim()) as {
      item: {
        guards: {
          redApprovalIsFresh: boolean
        }
        gateStatus: {
          redApproval: {
            latestDecision: string
          } | null
        }
      }
    }
    expect(itemOutput.item.guards.redApprovalIsFresh).toBeFalse()
    expect(itemOutput.item.gateStatus.redApproval?.latestDecision).toBe('rejected')
  })

  test('ready-queue omits review items when latest merge simulation is for a stale spec', async () => {
    const dbPath = await seedStaleMergeProjectionFixture()

    const readyQueueResult = await runPlanCommand({
      mode: 'ready-queue',
      dbPath,
    })

    expect(readyQueueResult.exitCode).toBe(0)
    const readyQueueOutput = JSON.parse(readyQueueResult.stdout.toString().trim()) as {
      readyItems: Array<{
        workItemId: string
        nextEvent: string
      }>
    }
    expect(readyQueueOutput.readyItems).not.toContainEqual({
      workItemId: 'review-stale-merge-1',
      nextEvent: 'mark_merge_ready',
    })

    const itemResult = await runPlanCommand({
      mode: 'item',
      dbPath,
      workItemId: 'review-stale-merge-1',
    })

    expect(itemResult.exitCode).toBe(0)
    const itemOutput = JSON.parse(itemResult.stdout.toString().trim()) as {
      item: {
        guards: {
          mergeGatePassed: boolean
        }
      }
    }
    expect(itemOutput.item.guards.mergeGatePassed).toBeFalse()
  })

  test('ready-queue omits review items when merge simulation check evidence is missing', async () => {
    const dbPath = await seedStaleMergeProjectionFixture()

    const readyQueueResult = await runPlanCommand({
      mode: 'ready-queue',
      dbPath,
    })

    expect(readyQueueResult.exitCode).toBe(0)
    const readyQueueOutput = JSON.parse(readyQueueResult.stdout.toString().trim()) as {
      readyItems: Array<{
        workItemId: string
        nextEvent: string
      }>
    }
    expect(readyQueueOutput.readyItems).not.toContainEqual({
      workItemId: 'review-missing-merge-evidence-1',
      nextEvent: 'mark_merge_ready',
    })

    const itemResult = await runPlanCommand({
      mode: 'item',
      dbPath,
      workItemId: 'review-missing-merge-evidence-1',
    })

    expect(itemResult.exitCode).toBe(0)
    const itemOutput = JSON.parse(itemResult.stdout.toString().trim()) as {
      item: {
        guards: {
          mergeGatePassed: boolean
        }
      }
    }
    expect(itemOutput.item.guards.mergeGatePassed).toBeFalse()
  })

  test('ready-queue keeps merge simulation gate state when newer non-merge decisions overflow audit history', async () => {
    const dbPath = await seedStaleMergeProjectionFixture()

    const readyQueueResult = await runPlanCommand({
      mode: 'ready-queue',
      dbPath,
    })

    expect(readyQueueResult.exitCode).toBe(0)
    const readyQueueOutput = JSON.parse(readyQueueResult.stdout.toString().trim()) as {
      readyItems: Array<{
        workItemId: string
        nextEvent: string
      }>
    }
    expect(
      readyQueueOutput.readyItems.some(
        (item) => item.workItemId === 'review-overflow-merge-1' && item.nextEvent === 'mark_merge_ready',
      ),
    ).toBeTrue()

    const itemResult = await runPlanCommand({
      mode: 'item',
      dbPath,
      workItemId: 'review-overflow-merge-1',
    })

    expect(itemResult.exitCode).toBe(0)
    const itemOutput = JSON.parse(itemResult.stdout.toString().trim()) as {
      item: {
        guards: {
          mergeGatePassed: boolean
        }
        gateStatus: {
          mergeSimulation: {
            latestDecision: string
          } | null
        }
        latestDecisions: Array<{
          id: string
        }>
      }
    }

    expect(itemOutput.item.guards.mergeGatePassed).toBeTrue()
    expect(itemOutput.item.gateStatus.mergeSimulation).not.toBeNull()
    expect(itemOutput.item.gateStatus.mergeSimulation?.latestDecision).toBe('approved')
    expect(itemOutput.item.latestDecisions).toHaveLength(20)
    expect(itemOutput.item.latestDecisions.some((decision) => decision.id === 'gate-merge-overflow-cli-1')).toBeFalse()
  })

  test('decision-audit mode projects gate decisions with evidence references and failures', async () => {
    const dbPath = await seedProjectionFixture()

    const result = await runPlanCommand({
      mode: 'decision-audit',
      dbPath,
      workItemId: 'wip-1',
      limit: 10,
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim()) as {
      mode: string
      dbPath: string
      decisions: Array<{
        id: string
        workItemId: string
        gateName: string
        decision: string
        reason: string
        specCommitSha: string | null
        decidedAt: string
        failureCategories: string[]
        evidenceRefs: Array<{ contextDbPath: string; evidenceCacheRowId: number }>
      }>
    }

    expect(output.mode).toBe('decision-audit')
    expect(output.dbPath).toBe(resolve(dbPath))
    expect(output.decisions).toEqual([
      {
        id: 'gate-red-wip-1',
        workItemId: 'wip-1',
        gateName: 'red_approval',
        decision: 'approved',
        reason: 'tests demonstrate missing behavior',
        specCommitSha: 'sha-wip-1',
        decidedAt: '2026-05-05T00:22:00.000Z',
        failureCategories: ['expected_behavior_fail'],
        evidenceRefs: [{ contextDbPath: '/tmp/context.sqlite', evidenceCacheRowId: 7 }],
      },
    ])
  })

  test('plan --schema output exposes all projection result modes', async () => {
    const outputSchemaResult = await Bun.$`bun ./bin/plaited.ts plan --schema output`
      .cwd(CLI_PACKAGE_ROOT)
      .quiet()
      .nothrow()

    expect(outputSchemaResult.exitCode).toBe(0)
    const outputSchema = JSON.parse(outputSchemaResult.stdout.toString().trim()) as {
      description?: string
      oneOf?: Array<{ properties?: { mode?: { const?: string } } }>
      anyOf?: Array<{ properties?: { mode?: { const?: string } } }>
    }
    expect(outputSchema.description).toContain('agent-facing projection')

    const branches = outputSchema.oneOf ?? outputSchema.anyOf ?? []
    const modes = branches.map((branch) => branch.properties?.mode?.const).filter((value) => value !== undefined)
    expect(modes).toEqual(['board', 'item', 'ready-queue', 'decision-audit'])
  })
})
