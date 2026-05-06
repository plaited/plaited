import { Database } from 'bun:sqlite'
import { resolve } from 'node:path'

import { makeCli } from '../cli/cli.ts'
import {
  PLAN_COMMAND,
  PLAN_PROJECTION_MODES,
  WORK_ITEM_LIFECYCLE_EXECUTION_STATE_VALUES,
  WORK_ITEM_LIFECYCLE_STATE_VALUES,
} from './plan.constants.ts'
import {
  type PlanCliInput,
  PlanCliInputSchema,
  type PlanCliOutput,
  PlanCliOutputSchema,
} from './plan.projection.schemas.ts'

type ProjectionWorkItemRow = {
  id: string
  title: string
  status: (typeof WORK_ITEM_LIFECYCLE_STATE_VALUES)[number]
}

type ProjectionDetailedWorkItemRow = {
  id: string
  request_id: string
  title: string
  status: (typeof WORK_ITEM_LIFECYCLE_STATE_VALUES)[number]
  spec_path: string | null
  spec_commit_sha: string | null
  execution_branch_ref: string | null
  execution_worktree_path: string | null
  execution_target_ref: string | null
  execution_prepared_at: string | null
  cleanup_branch_prune_after_at: string | null
  cleanup_worktree_removed_at: string | null
  cleanup_branch_pruned_at: string | null
}

type UnresolvedDependencyRow = {
  work_item_id: string
  dependency_id: string
  dependency_status: (typeof WORK_ITEM_LIFECYCLE_STATE_VALUES)[number]
}

type DependencyRow = {
  id: string
  title: string
  status: (typeof WORK_ITEM_LIFECYCLE_STATE_VALUES)[number]
}

type LatestDiscoveryArtifactRow = {
  id: string
  collected_at: string
  updated_at: string
  open_questions: string
}

type GateDecisionRow = {
  id: string
  work_item_id: string
  gate_name: 'formulation' | 'red_approval' | 'frontier_verification' | 'merge_simulation'
  decision: 'approved' | 'rejected'
  reason: string
  spec_commit_sha: string | null
  decided_at: string
  created_at: string
}

type LatestRedDecisionRow = {
  id: string
  work_item_id: string
  gate_name: 'red_approval'
  decision: 'approved' | 'rejected'
  reason: string
  discovery_artifact_id: string | null
  spec_commit_sha: string | null
  decided_at: string
  created_at: string
}

type PassedMergeSimulationCheckRunCountRow = {
  total: number
}

type GateDecisionFailureRow = {
  gate_decision_id: string
  failure_category: string
}

type GateDecisionEvidenceRefRow = {
  gate_decision_id: string
  context_db_path: string
  evidence_cache_row_id: number
}

type ProjectionDecision = {
  id: string
  workItemId: string
  gateName: GateDecisionRow['gate_name']
  decision: GateDecisionRow['decision']
  reason: string
  specCommitSha: string | null
  decidedAt: string
  failureCategories: string[]
  evidenceRefs: Array<{
    contextDbPath: string
    evidenceCacheRowId: number
  }>
}

type WorkItemContext = {
  dependencies: Array<{
    id: string
    title: string
    status: (typeof WORK_ITEM_LIFECYCLE_STATE_VALUES)[number]
    isResolved: boolean
  }>
  unresolvedDependencyCount: number
  openQuestionsCount: number
  redApprovalIsFresh: boolean
  mergeGatePassed: boolean
  latestDecisions: ProjectionDecision[]
  latestByGate: Map<string, ProjectionDecision>
}

const openProjectionDatabase = async (dbPath: string): Promise<Database> => {
  const absoluteDbPath = resolve(dbPath)
  if (!(await Bun.file(absoluteDbPath).exists())) {
    throw new Error(`Plan database does not exist: ${absoluteDbPath}`)
  }

  const db = new Database(absoluteDbPath)
  db.exec('PRAGMA foreign_keys = ON;')
  return db
}

const executionStateSet = new Set<string>(WORK_ITEM_LIFECYCLE_EXECUTION_STATE_VALUES)

const loadLatestDiscoveryArtifact = ({
  db,
  workItemId,
}: {
  db: Database
  workItemId: string
}): LatestDiscoveryArtifactRow | null =>
  db
    .query<LatestDiscoveryArtifactRow, [string]>(
      `SELECT id, collected_at, updated_at, open_questions
       FROM discovery_artifacts
       WHERE work_item_id = ?
       ORDER BY updated_at DESC, collected_at DESC, artifact_version DESC
       LIMIT 1`,
    )
    .get(workItemId) ?? null

const loadDependencies = ({ db, workItemId }: { db: Database; workItemId: string }): DependencyRow[] =>
  db
    .query<DependencyRow, [string]>(
      `SELECT dependency_work_items.id,
              dependency_work_items.title,
              dependency_work_items.status
       FROM work_item_dependencies
       INNER JOIN work_items AS dependency_work_items
         ON dependency_work_items.id = work_item_dependencies.depends_on_work_item_id
       WHERE work_item_dependencies.work_item_id = ?
       ORDER BY dependency_work_items.id ASC`,
    )
    .all(workItemId)

const loadLatestRedDecision = ({ db, workItemId }: { db: Database; workItemId: string }): LatestRedDecisionRow | null =>
  db
    .query<LatestRedDecisionRow, [string]>(
      `SELECT id, work_item_id, gate_name, decision, reason, discovery_artifact_id, spec_commit_sha, decided_at, created_at
       FROM gate_decisions
       WHERE work_item_id = ?
         AND gate_name = 'red_approval'
       ORDER BY decided_at DESC, created_at DESC, id DESC
       LIMIT 1`,
    )
    .get(workItemId) ?? null

const loadDecisionRows = ({
  db,
  workItemId,
  limit,
}: {
  db: Database
  workItemId: string
  limit: number
}): GateDecisionRow[] =>
  db
    .query<GateDecisionRow, [string, number]>(
      `SELECT id, work_item_id, gate_name, decision, reason, spec_commit_sha, decided_at, created_at
       FROM gate_decisions
       WHERE work_item_id = ?
       ORDER BY decided_at DESC, created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(workItemId, limit)

const loadLatestDecisionRowsByGate = ({ db, workItemId }: { db: Database; workItemId: string }): GateDecisionRow[] =>
  db
    .query<GateDecisionRow, [string]>(
      `SELECT id, work_item_id, gate_name, decision, reason, spec_commit_sha, decided_at, created_at
       FROM gate_decisions AS gate_decisions
       WHERE work_item_id = ?
         AND NOT EXISTS (
           SELECT 1
           FROM gate_decisions AS newer_decisions
           WHERE newer_decisions.work_item_id = gate_decisions.work_item_id
             AND newer_decisions.gate_name = gate_decisions.gate_name
             AND (
               newer_decisions.decided_at > gate_decisions.decided_at
               OR (
                 newer_decisions.decided_at = gate_decisions.decided_at
                 AND newer_decisions.created_at > gate_decisions.created_at
               )
               OR (
                 newer_decisions.decided_at = gate_decisions.decided_at
                 AND newer_decisions.created_at = gate_decisions.created_at
                 AND newer_decisions.id > gate_decisions.id
               )
             )
         )
       ORDER BY decided_at DESC, created_at DESC, id DESC`,
    )
    .all(workItemId)

const buildProjectionDecisionDetails = ({
  db,
  decisions,
}: {
  db: Database
  decisions: GateDecisionRow[]
}): ProjectionDecision[] => {
  const decisionIds = decisions.map((decision) => decision.id)
  const failuresByDecisionId = new Map<string, string[]>()
  const evidenceRefsByDecisionId = new Map<string, ProjectionDecision['evidenceRefs']>()

  if (decisionIds.length > 0) {
    const placeholders = decisionIds.map(() => '?').join(', ')
    const failureRows = db
      .query<GateDecisionFailureRow, [...string[]]>(
        `SELECT gate_decision_id, failure_category
         FROM gate_decision_failures
         WHERE gate_decision_id IN (${placeholders})
         ORDER BY gate_decision_id ASC, failure_category ASC`,
      )
      .all(...decisionIds)
    for (const row of failureRows) {
      const existing = failuresByDecisionId.get(row.gate_decision_id) ?? []
      existing.push(row.failure_category)
      failuresByDecisionId.set(row.gate_decision_id, existing)
    }

    const evidenceRefRows = db
      .query<GateDecisionEvidenceRefRow, [...string[]]>(
        `SELECT gate_decision_id, context_db_path, evidence_cache_row_id
         FROM gate_decision_evidence_cache_refs
         WHERE gate_decision_id IN (${placeholders})
         ORDER BY gate_decision_id ASC, context_db_path ASC, evidence_cache_row_id ASC`,
      )
      .all(...decisionIds)
    for (const row of evidenceRefRows) {
      const existing = evidenceRefsByDecisionId.get(row.gate_decision_id) ?? []
      existing.push({
        contextDbPath: row.context_db_path,
        evidenceCacheRowId: row.evidence_cache_row_id,
      })
      evidenceRefsByDecisionId.set(row.gate_decision_id, existing)
    }
  }

  return decisions.map((decision) => ({
    id: decision.id,
    workItemId: decision.work_item_id,
    gateName: decision.gate_name,
    decision: decision.decision,
    reason: decision.reason,
    specCommitSha: decision.spec_commit_sha,
    decidedAt: decision.decided_at,
    failureCategories: failuresByDecisionId.get(decision.id) ?? [],
    evidenceRefs: evidenceRefsByDecisionId.get(decision.id) ?? [],
  }))
}

const loadDecisionDetails = ({
  db,
  workItemId,
  limit,
}: {
  db: Database
  workItemId: string
  limit: number
}): ProjectionDecision[] =>
  buildProjectionDecisionDetails({
    db,
    decisions: loadDecisionRows({ db, workItemId, limit }),
  })

const loadLatestDecisionDetailsByGate = ({
  db,
  workItemId,
}: {
  db: Database
  workItemId: string
}): ProjectionDecision[] =>
  buildProjectionDecisionDetails({
    db,
    decisions: loadLatestDecisionRowsByGate({ db, workItemId }),
  })

const hasPassedMergeSimulationCheckRun = ({
  db,
  workItemId,
  gateDecisionId,
}: {
  db: Database
  workItemId: string
  gateDecisionId: string
}): boolean => {
  const row = db
    .query<PassedMergeSimulationCheckRunCountRow, [string, string]>(
      `SELECT COUNT(*) AS total
       FROM check_runs
       WHERE work_item_id = ?
         AND gate_decision_id = ?
         AND check_type = 'merge_simulation'
         AND status = 'passed'
         AND required_gate = 'frontier_verification'`,
    )
    .get(workItemId, gateDecisionId)

  return (row?.total ?? 0) > 0
}

const loadWorkItemContext = ({
  db,
  workItemId,
  specCommitSha,
}: {
  db: Database
  workItemId: string
  specCommitSha: string | null
}): WorkItemContext => {
  const dependencies = loadDependencies({ db, workItemId }).map((dependency) => ({
    id: dependency.id,
    title: dependency.title,
    status: dependency.status,
    isResolved: dependency.status === 'cleaned',
  }))
  const unresolvedDependencyCount = dependencies.filter((dependency) => !dependency.isResolved).length
  const latestDiscoveryArtifact = loadLatestDiscoveryArtifact({ db, workItemId })
  const openQuestionsCount = latestDiscoveryArtifact ? JSON.parse(latestDiscoveryArtifact.open_questions).length : 0
  const latestRedDecision = loadLatestRedDecision({ db, workItemId })
  const latestDecisions = loadDecisionDetails({ db, workItemId, limit: 20 })
  const latestGateDecisions = loadLatestDecisionDetailsByGate({ db, workItemId })
  const latestByGate = new Map<string, ProjectionDecision>()
  for (const decision of latestGateDecisions) {
    if (!latestByGate.has(decision.gateName)) {
      latestByGate.set(decision.gateName, decision)
    }
  }

  const latestDiscoveryMutationAt = latestDiscoveryArtifact
    ? latestDiscoveryArtifact.updated_at > latestDiscoveryArtifact.collected_at
      ? latestDiscoveryArtifact.updated_at
      : latestDiscoveryArtifact.collected_at
    : null
  const redApprovalIsFresh =
    latestDiscoveryArtifact !== null &&
    latestRedDecision?.decision === 'approved' &&
    latestRedDecision.spec_commit_sha === specCommitSha &&
    latestRedDecision.discovery_artifact_id === latestDiscoveryArtifact.id &&
    (latestDiscoveryMutationAt === null || latestDiscoveryMutationAt <= latestRedDecision.decided_at)
  const latestMergeSimulationDecision = latestByGate.get('merge_simulation')
  const mergeGatePassed =
    latestMergeSimulationDecision?.decision === 'approved' &&
    latestMergeSimulationDecision.specCommitSha === specCommitSha &&
    hasPassedMergeSimulationCheckRun({
      db,
      workItemId,
      gateDecisionId: latestMergeSimulationDecision.id,
    })

  return {
    dependencies,
    unresolvedDependencyCount,
    openQuestionsCount,
    redApprovalIsFresh,
    mergeGatePassed,
    latestDecisions,
    latestByGate,
  }
}

const getNextReadyEvent = ({
  status,
  context,
  cleanupBranchPruneAfterAt,
  nowIso,
}: {
  status: (typeof WORK_ITEM_LIFECYCLE_STATE_VALUES)[number]
  context: WorkItemContext
  cleanupBranchPruneAfterAt: string | null
  nowIso?: string
}): string | null => {
  switch (status) {
    case 'draft':
      return 'submit_discovery'
    case 'discovery_ready':
      return context.openQuestionsCount === 0 ? 'complete_formulation' : null
    case 'formulated':
      return context.unresolvedDependencyCount === 0 ? 'request_red_approval' : null
    case 'red_approved':
      return context.unresolvedDependencyCount === 0 && context.openQuestionsCount === 0 && context.redApprovalIsFresh
        ? 'start_green_execution'
        : null
    case 'green_pending':
      return context.unresolvedDependencyCount === 0 && context.openQuestionsCount === 0 && context.redApprovalIsFresh
        ? 'submit_for_review'
        : null
    case 'review_pending':
      return context.unresolvedDependencyCount === 0 && context.mergeGatePassed ? 'mark_merge_ready' : null
    case 'merge_ready':
      return context.unresolvedDependencyCount === 0 && context.mergeGatePassed ? 'mark_merged' : null
    case 'merged':
      return 'schedule_cleanup'
    case 'cleanup_pending':
      return nowIso !== undefined && cleanupBranchPruneAfterAt !== null && nowIso >= cleanupBranchPruneAfterAt
        ? 'mark_cleaned'
        : null
    default:
      return null
  }
}

const loadItemProjection = ({
  db,
  dbPath,
  workItemId,
}: {
  db: Database
  dbPath: string
  workItemId: string
}): PlanCliOutput => {
  const workItem = db
    .query<ProjectionDetailedWorkItemRow, [string]>(
      `SELECT id,
              request_id,
              title,
              status,
              spec_path,
              spec_commit_sha,
              execution_branch_ref,
              execution_worktree_path,
              execution_target_ref,
              execution_prepared_at,
              cleanup_branch_prune_after_at,
              cleanup_worktree_removed_at,
              cleanup_branch_pruned_at
       FROM work_items
       WHERE id = ?`,
    )
    .get(workItemId)

  if (!workItem) {
    throw new Error(`Work item does not exist: ${workItemId}`)
  }

  const context = loadWorkItemContext({
    db,
    workItemId,
    specCommitSha: workItem.spec_commit_sha,
  })

  const cleanup =
    workItem.cleanup_branch_prune_after_at || workItem.cleanup_worktree_removed_at || workItem.cleanup_branch_pruned_at
      ? {
          branchPruneAfterAt: workItem.cleanup_branch_prune_after_at,
          worktreeRemovedAt: workItem.cleanup_worktree_removed_at,
          branchPrunedAt: workItem.cleanup_branch_pruned_at,
        }
      : null

  return {
    ok: true,
    mode: PLAN_PROJECTION_MODES.item,
    dbPath,
    item: {
      id: workItem.id,
      requestId: workItem.request_id,
      title: workItem.title,
      status: workItem.status,
      specPath: workItem.spec_path,
      specCommitSha: workItem.spec_commit_sha,
      guards: {
        dependenciesResolved: context.unresolvedDependencyCount === 0,
        redApprovalIsFresh: context.redApprovalIsFresh,
        mergeGatePassed: context.mergeGatePassed,
        openQuestionsResolved: context.openQuestionsCount === 0,
      },
      execution:
        workItem.execution_branch_ref && workItem.execution_worktree_path && workItem.execution_target_ref
          ? {
              branchRef: workItem.execution_branch_ref,
              worktreePath: workItem.execution_worktree_path,
              targetRef: workItem.execution_target_ref,
              preparedAt: workItem.execution_prepared_at,
            }
          : null,
      cleanup,
      dependencies: context.dependencies,
      gateStatus: {
        redApproval: context.latestByGate.get('red_approval')
          ? {
              latestDecision: context.latestByGate.get('red_approval')!.decision,
              decidedAt: context.latestByGate.get('red_approval')!.decidedAt,
            }
          : null,
        frontierVerification: context.latestByGate.get('frontier_verification')
          ? {
              latestDecision: context.latestByGate.get('frontier_verification')!.decision,
              decidedAt: context.latestByGate.get('frontier_verification')!.decidedAt,
            }
          : null,
        mergeSimulation: context.latestByGate.get('merge_simulation')
          ? {
              latestDecision: context.latestByGate.get('merge_simulation')!.decision,
              decidedAt: context.latestByGate.get('merge_simulation')!.decidedAt,
            }
          : null,
      },
      latestDecisions: context.latestDecisions.map(({ workItemId: _workItemId, ...decision }) => decision),
    },
  }
}

const loadReadyQueueProjection = ({
  db,
  dbPath,
  nowIso,
}: {
  db: Database
  dbPath: string
  nowIso?: string
}): PlanCliOutput => {
  const workItems = db
    .query<ProjectionDetailedWorkItemRow, []>(
      `SELECT id,
              request_id,
              title,
              status,
              spec_path,
              spec_commit_sha,
              execution_branch_ref,
              execution_worktree_path,
              execution_target_ref,
              execution_prepared_at,
              cleanup_branch_prune_after_at,
              cleanup_worktree_removed_at,
              cleanup_branch_pruned_at
       FROM work_items
       ORDER BY created_at ASC, id ASC`,
    )
    .all()

  const readyItems = workItems
    .map((workItem) => {
      const context = loadWorkItemContext({
        db,
        workItemId: workItem.id,
        specCommitSha: workItem.spec_commit_sha,
      })
      const nextEvent = getNextReadyEvent({
        status: workItem.status,
        context,
        cleanupBranchPruneAfterAt: workItem.cleanup_branch_prune_after_at,
        nowIso,
      })

      if (!nextEvent) {
        return null
      }

      return {
        workItemId: workItem.id,
        title: workItem.title,
        status: workItem.status,
        nextEvent,
      }
    })
    .filter((item) => item !== null)

  return {
    ok: true,
    mode: PLAN_PROJECTION_MODES.readyQueue,
    dbPath,
    readyItems,
  }
}

const loadDecisionAuditProjection = ({
  db,
  dbPath,
  workItemId,
  limit,
}: {
  db: Database
  dbPath: string
  workItemId?: string
  limit: number
}): PlanCliOutput => {
  const decisions =
    workItemId === undefined
      ? db
          .query<GateDecisionRow, [number]>(
            `SELECT id, work_item_id, gate_name, decision, reason, spec_commit_sha, decided_at, created_at
             FROM gate_decisions
             ORDER BY decided_at DESC, created_at DESC, id DESC
             LIMIT ?`,
          )
          .all(limit)
      : db
          .query<GateDecisionRow, [string, number]>(
            `SELECT id, work_item_id, gate_name, decision, reason, spec_commit_sha, decided_at, created_at
             FROM gate_decisions
             WHERE work_item_id = ?
             ORDER BY decided_at DESC, created_at DESC, id DESC
             LIMIT ?`,
          )
          .all(workItemId, limit)

  const decisionIds = decisions.map((decision) => decision.id)
  const failuresByDecisionId = new Map<string, string[]>()
  const evidenceRefsByDecisionId = new Map<string, ProjectionDecision['evidenceRefs']>()

  if (decisionIds.length > 0) {
    const placeholders = decisionIds.map(() => '?').join(', ')
    const failureRows = db
      .query<GateDecisionFailureRow, [...string[]]>(
        `SELECT gate_decision_id, failure_category
         FROM gate_decision_failures
         WHERE gate_decision_id IN (${placeholders})
         ORDER BY gate_decision_id ASC, failure_category ASC`,
      )
      .all(...decisionIds)
    for (const row of failureRows) {
      const existing = failuresByDecisionId.get(row.gate_decision_id) ?? []
      existing.push(row.failure_category)
      failuresByDecisionId.set(row.gate_decision_id, existing)
    }

    const evidenceRefRows = db
      .query<GateDecisionEvidenceRefRow, [...string[]]>(
        `SELECT gate_decision_id, context_db_path, evidence_cache_row_id
         FROM gate_decision_evidence_cache_refs
         WHERE gate_decision_id IN (${placeholders})
         ORDER BY gate_decision_id ASC, context_db_path ASC, evidence_cache_row_id ASC`,
      )
      .all(...decisionIds)
    for (const row of evidenceRefRows) {
      const existing = evidenceRefsByDecisionId.get(row.gate_decision_id) ?? []
      existing.push({
        contextDbPath: row.context_db_path,
        evidenceCacheRowId: row.evidence_cache_row_id,
      })
      evidenceRefsByDecisionId.set(row.gate_decision_id, existing)
    }
  }

  return {
    ok: true,
    mode: PLAN_PROJECTION_MODES.decisionAudit,
    dbPath,
    decisions: decisions.map((decision) => ({
      id: decision.id,
      workItemId: decision.work_item_id,
      gateName: decision.gate_name,
      decision: decision.decision,
      reason: decision.reason,
      specCommitSha: decision.spec_commit_sha,
      decidedAt: decision.decided_at,
      failureCategories: failuresByDecisionId.get(decision.id) ?? [],
      evidenceRefs: evidenceRefsByDecisionId.get(decision.id) ?? [],
    })),
  }
}

const loadBoardProjection = ({ db, dbPath }: { db: Database; dbPath: string }): PlanCliOutput => {
  const workItems = db
    .query<ProjectionWorkItemRow, []>(
      `SELECT id, title, status
       FROM work_items
       ORDER BY created_at ASC, id ASC`,
    )
    .all()

  const unresolvedDependencyRows = db
    .query<UnresolvedDependencyRow, [string]>(
      `SELECT work_item_dependencies.work_item_id,
              dependency_work_items.id AS dependency_id,
              dependency_work_items.status AS dependency_status
       FROM work_item_dependencies
       INNER JOIN work_items AS dependency_work_items
         ON dependency_work_items.id = work_item_dependencies.depends_on_work_item_id
       WHERE dependency_work_items.status <> ?
       ORDER BY work_item_dependencies.work_item_id ASC, dependency_work_items.id ASC`,
    )
    .all('cleaned')

  const unresolvedDependenciesByWorkItem = new Map<string, UnresolvedDependencyRow[]>()
  for (const row of unresolvedDependencyRows) {
    const existing = unresolvedDependenciesByWorkItem.get(row.work_item_id) ?? []
    existing.push(row)
    unresolvedDependenciesByWorkItem.set(row.work_item_id, existing)
  }

  const states = WORK_ITEM_LIFECYCLE_STATE_VALUES.map((state) => {
    const items = workItems
      .filter((workItem) => workItem.status === state)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((workItem) => ({
        id: workItem.id,
        unresolvedDependencyCount: unresolvedDependenciesByWorkItem.get(workItem.id)?.length ?? 0,
      }))

    return {
      state,
      total: items.length,
      items,
    }
  }).filter((bucket) => bucket.total > 0)

  const blockers = workItems
    .filter((workItem) => (unresolvedDependenciesByWorkItem.get(workItem.id)?.length ?? 0) > 0)
    .map((workItem) => ({
      workItemId: workItem.id,
      unresolvedDependencies: (unresolvedDependenciesByWorkItem.get(workItem.id) ?? []).map((row) => ({
        id: row.dependency_id,
        status: row.dependency_status,
      })),
    }))

  const wipItems = workItems
    .filter((workItem) => executionStateSet.has(workItem.status))
    .sort((left, right) => {
      const stateComparison =
        WORK_ITEM_LIFECYCLE_STATE_VALUES.indexOf(left.status) - WORK_ITEM_LIFECYCLE_STATE_VALUES.indexOf(right.status)
      if (stateComparison !== 0) {
        return stateComparison
      }

      return left.id.localeCompare(right.id)
    })
    .map((workItem) => ({
      id: workItem.id,
      status: workItem.status,
    }))

  const wip = {
    total: wipItems.length,
    byState: WORK_ITEM_LIFECYCLE_STATE_VALUES.map((state) => ({
      state,
      total: wipItems.filter((workItem) => workItem.status === state).length,
    })).filter((entry) => entry.total > 0),
    items: wipItems,
  }

  return {
    ok: true,
    mode: PLAN_PROJECTION_MODES.board,
    dbPath,
    states,
    blockers,
    wip,
  }
}

const runPlanProjection = async (input: PlanCliInput): Promise<PlanCliOutput> => {
  const dbPath = resolve(input.dbPath)
  const db = await openProjectionDatabase(dbPath)

  try {
    switch (input.mode) {
      case PLAN_PROJECTION_MODES.board:
        return loadBoardProjection({ db, dbPath })
      case PLAN_PROJECTION_MODES.item:
        return loadItemProjection({ db, dbPath, workItemId: input.workItemId })
      case PLAN_PROJECTION_MODES.readyQueue:
        return loadReadyQueueProjection({ db, dbPath, nowIso: input.nowIso })
      case PLAN_PROJECTION_MODES.decisionAudit:
        return loadDecisionAuditProjection({
          db,
          dbPath,
          workItemId: input.workItemId,
          limit: input.limit,
        })
    }
  } finally {
    db.close(false)
  }
}

export const planCli = makeCli({
  name: PLAN_COMMAND,
  inputSchema: PlanCliInputSchema,
  outputSchema: PlanCliOutputSchema,
  run: runPlanProjection,
})
