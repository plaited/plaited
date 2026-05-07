import { Database } from 'bun:sqlite'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import type { BPEvent, SnapshotMessage } from '../behavioral.ts'
import {
  BEHAVIORAL_FRONTIER_SELECTION_POLICIES,
  BEHAVIORAL_FRONTIER_STRATEGIES,
  BEHAVIORAL_FRONTIER_VERIFY_STATUSES,
} from '../behavioral-frontier/behavioral-frontier.constants.ts'
import { runBehavioralFrontier } from '../behavioral-frontier/behavioral-frontier.ts'
import { makeCli } from '../cli/cli.ts'
import { kebabCase } from '../utils.ts'

export * from './kanban.constants.ts'
export * from './kanban.schemas.ts'

import {
  type KanbanCliInput,
  KanbanCliInputSchema,
  type KanbanCliOutput,
  KanbanCliOutputSchema,
} from './kanban.cli.schemas.ts'
import {
  APPROVABLE_RED_FAILURE_CATEGORY_VALUES,
  CONSECUTIVE_RED_REJECTION_ESCALATION_THRESHOLD,
  type ESCALATION_TRIGGER_ID_VALUES,
  ESCALATION_TRIGGER_IDS,
  FRONTIER_FAILURE_CATEGORIES,
  type FRONTIER_FAILURE_CATEGORY_VALUES,
  KANBAN_COMMAND,
  KANBAN_MODES,
  MERGE_FAILURE_CATEGORIES,
  type MERGE_FAILURE_CATEGORY_VALUES,
  type RED_FAILURE_CATEGORY_VALUES,
  RISKY_IMPACT_ESCALATION_THRESHOLD,
  WORK_ITEM_LIFECYCLE_EVENTS,
  WORK_ITEM_LIFECYCLE_EXECUTION_STATE_VALUES,
  WORK_ITEM_LIFECYCLE_STATE_VALUES,
  WORK_ITEM_LIFECYCLE_STATES,
} from './kanban.constants.ts'

const SCHEMA_SQL_PATH = resolve(import.meta.dir, './assets/schema.sql')
// `src/kanban` is currently greenfield: no persisted kanban DBs are in active use yet.
// By design, we only stamp the baseline schema version and do not implement backward-compat
// migrations yet. The first breaking persisted-schema change after adoption must add
// explicit versioned migration steps.
const KANBAN_SCHEMA_VERSION = 1

let cachedSchemaSql: string | undefined

const nowIso = () => new Date().toISOString()
const approvableRedFailureCategorySet = new Set<string>(APPROVABLE_RED_FAILURE_CATEGORY_VALUES)

export type KanbanActorType = 'agent' | 'user' | 'system'
export type RedFailureCategory = (typeof RED_FAILURE_CATEGORY_VALUES)[number]
export type FrontierFailureCategory = (typeof FRONTIER_FAILURE_CATEGORY_VALUES)[number]
export type MergeFailureCategory = (typeof MERGE_FAILURE_CATEGORY_VALUES)[number]
export type EscalationTriggerId = (typeof ESCALATION_TRIGGER_ID_VALUES)[number]

export type RedGateFailure = {
  category: RedFailureCategory
  checkName: string
  detail: string
}

export type FrontierGateFailure = {
  category: FrontierFailureCategory
  checkName: string
  detail: string
}

export type MergeGateFailure = {
  category: MergeFailureCategory
  checkName: string
  detail: string
}

export type GateDecisionEvidenceRef = {
  contextDbPath: string
  evidenceCacheRowId: number
}

export type EvaluateAndRecordRedApprovalGateInput = {
  db: Database
  decisionId: string
  workItemId: string
  actorType: KanbanActorType
  actorId: string
  reason: string
  discoveryArtifactId: string | null
  failures: RedGateFailure[]
  evidenceRefs: GateDecisionEvidenceRef[]
  decidedAt?: string
}

export type EvaluateAndRecordRedApprovalGateOutput = {
  decision: 'approved' | 'rejected'
  reasons: string[]
}

type WorkItemSpecSnapshot = {
  title?: string
  status?: string
  spec_path: string | null
  spec_commit_sha: string | null
}

type WorkItemExecutionSnapshot = {
  id: string
  title: string
  status: string
  execution_branch_ref: string | null
  execution_worktree_path: string | null
  execution_target_ref: string | null
  cleanup_branch_prune_after_at: string | null
  cleanup_worktree_removed_at: string | null
  cleanup_branch_pruned_at: string | null
}

type LatestRedGateDecisionSnapshot = {
  id: string
  decision: 'approved' | 'rejected'
  discovery_artifact_id: string | null
  discovery_artifact_updated_at_snapshot: string | null
  spec_commit_sha: string | null
  decided_at: string
}

type LatestDiscoveryArtifactSnapshot = {
  id: string
  collected_at: string
  updated_at: string
}

type LatestOpenQuestionsCountRow = {
  total: number
}

type UnresolvedDependencyCountRow = {
  total: number
}

type RedDecisionRow = {
  decision: 'approved' | 'rejected'
}

type ExistingDriftRevocationCountRow = {
  total: number
}

type DiscoveryArtifactOwnershipRow = {
  id: string
  work_item_id: string
  collected_at: string
  updated_at: string
}

type CheckRunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled'

type RequiredCheckRunRow = {
  id: string
  check_name: string
  status: CheckRunStatus
  check_type: 'tests' | 'types' | 'behavioral_frontier' | 'merge_simulation' | 'custom'
  required_gate: 'none' | 'red_approval' | 'frontier_verification'
  gate_decision_id: string | null
  gate_name: 'formulation' | 'red_approval' | 'frontier_verification' | 'merge_simulation' | null
  gate_decision: 'approved' | 'rejected' | null
  gate_decision_spec_commit_sha: string | null
}

type GitCommandResult = {
  stdout: string
  stderr: string
  exitCode: number
}

type GateDecisionName = 'red_approval' | 'frontier_verification' | 'merge_simulation'
type GateDecisionFailure = RedGateFailure | FrontierGateFailure | MergeGateFailure

const formatGitCommand = (args: string[]): string => ['git', ...args].join(' ')

const runGitCommand = async ({
  cwd,
  args,
  allowFailure = false,
}: {
  cwd: string
  args: string[]
  allowFailure?: boolean
}): Promise<GitCommandResult> => {
  const command = formatGitCommand(args)
  const result = await Bun.$`git ${args}`.cwd(cwd).quiet().nothrow()
  const stdout = result.stdout.toString().trim()
  const stderr = result.stderr.toString().trim()

  if (result.exitCode !== 0 && !allowFailure) {
    throw new Error(`${command} failed (${result.exitCode}): ${stderr || stdout || 'unknown error'}`)
  }

  return {
    stdout,
    stderr,
    exitCode: result.exitCode,
  }
}

const ensureParentDirectory = async (dbPath: string) => {
  if (dbPath === ':memory:' || dbPath.startsWith('file:')) {
    return
  }

  await mkdir(dirname(dbPath), { recursive: true })
}

const getSchemaSql = async (): Promise<string> => {
  if (cachedSchemaSql) {
    return cachedSchemaSql
  }

  cachedSchemaSql = await Bun.file(SCHEMA_SQL_PATH).text()
  return cachedSchemaSql
}

const requireWorkItemSpecSnapshot = ({
  db,
  workItemId,
}: {
  db: Database
  workItemId: string
}): WorkItemSpecSnapshot => {
  const workItem = db
    .query<WorkItemSpecSnapshot, [string]>(
      `SELECT spec_path, spec_commit_sha
       FROM work_items
       WHERE id = ?`,
    )
    .get(workItemId)

  if (!workItem) {
    throw new Error(`Work item "${workItemId}" does not exist.`)
  }

  return workItem
}

const requireWorkItemExecutionSnapshot = ({
  db,
  workItemId,
}: {
  db: Database
  workItemId: string
}): WorkItemExecutionSnapshot => {
  const workItem = db
    .query<WorkItemExecutionSnapshot, [string]>(
      `SELECT id, title, status, execution_branch_ref, execution_worktree_path, execution_target_ref
              , cleanup_branch_prune_after_at, cleanup_worktree_removed_at, cleanup_branch_pruned_at
       FROM work_items
       WHERE id = ?`,
    )
    .get(workItemId)

  if (!workItem) {
    throw new Error(`Work item "${workItemId}" does not exist.`)
  }

  return workItem
}

const readLatestRedGateDecision = ({
  db,
  workItemId,
}: {
  db: Database
  workItemId: string
}): LatestRedGateDecisionSnapshot | null => {
  const row = db
    .query<LatestRedGateDecisionSnapshot, [string]>(
      `SELECT id, decision, discovery_artifact_id, discovery_artifact_updated_at_snapshot, spec_commit_sha, decided_at
       FROM gate_decisions
       WHERE work_item_id = ?
         AND gate_name = 'red_approval'
       ORDER BY decided_at DESC, created_at DESC, id DESC
       LIMIT 1`,
    )
    .get(workItemId)

  return row ?? null
}

const hasDriftRevocationForState = ({
  db,
  workItemId,
  staleApprovalDecisionId,
  driftSignature,
}: {
  db: Database
  workItemId: string
  staleApprovalDecisionId: string
  driftSignature: string
}): boolean => {
  const row = db
    .query<ExistingDriftRevocationCountRow, [string, string, string]>(
      `SELECT COUNT(*) AS total
       FROM gate_decisions
       WHERE work_item_id = ?
         AND gate_name = 'red_approval'
         AND decision = 'rejected'
         AND actor_type = 'system'
         AND drift_stale_approval_decision_id = ?
         AND drift_signature = ?`,
    )
    .get(workItemId, staleApprovalDecisionId, driftSignature)

  return (row?.total ?? 0) > 0
}

const readLatestDiscoveryArtifact = ({
  db,
  workItemId,
}: {
  db: Database
  workItemId: string
}): LatestDiscoveryArtifactSnapshot | null => {
  const row = db
    .query<LatestDiscoveryArtifactSnapshot, [string]>(
      `SELECT id, collected_at, updated_at
       FROM discovery_artifacts
       WHERE work_item_id = ?
       ORDER BY updated_at DESC, collected_at DESC, artifact_version DESC
       LIMIT 1`,
    )
    .get(workItemId)

  return row ?? null
}

const readDiscoveryArtifactOwnership = ({
  db,
  discoveryArtifactId,
}: {
  db: Database
  discoveryArtifactId: string
}): DiscoveryArtifactOwnershipRow | null => {
  const row = db
    .query<DiscoveryArtifactOwnershipRow, [string]>(
      `SELECT id, work_item_id, collected_at, updated_at
       FROM discovery_artifacts
       WHERE id = ?`,
    )
    .get(discoveryArtifactId)

  return row ?? null
}

const readLatestOpenQuestionsCount = ({ db, workItemId }: { db: Database; workItemId: string }): number => {
  const row = db
    .query<LatestOpenQuestionsCountRow, [string]>(
      `SELECT json_array_length(open_questions) AS total
       FROM discovery_artifacts
       WHERE work_item_id = ?
       ORDER BY updated_at DESC, collected_at DESC, artifact_version DESC
       LIMIT 1`,
    )
    .get(workItemId)

  return row?.total ?? 0
}

const readConsecutiveRedRejectionCount = ({ db, workItemId }: { db: Database; workItemId: string }): number => {
  const decisions = db
    .query<RedDecisionRow, [string]>(
      `SELECT decision
       FROM gate_decisions
       WHERE work_item_id = ?
         AND gate_name = 'red_approval'
       ORDER BY decided_at DESC, created_at DESC, id DESC`,
    )
    .all(workItemId)

  let count = 0
  for (const decision of decisions) {
    if (decision.decision !== 'rejected') {
      break
    }
    count += 1
  }

  return count
}

const readUnresolvedDependencyCount = ({ db, workItemId }: { db: Database; workItemId: string }): number => {
  const row = db
    .query<UnresolvedDependencyCountRow, [string, string]>(
      `SELECT COUNT(*) AS total
       FROM work_item_dependencies
       INNER JOIN work_items AS dependency_work_items
         ON dependency_work_items.id = work_item_dependencies.depends_on_work_item_id
       WHERE work_item_dependencies.work_item_id = ?
         AND dependency_work_items.status <> ?`,
    )
    .get(workItemId, WORK_ITEM_LIFECYCLE_STATES.cleaned)

  return row?.total ?? 0
}

const evaluateRedApprovalDecision = ({
  workItemSpecSnapshot,
  workItemId,
  discoveryArtifactId,
  discoveryArtifactOwnership,
  latestOpenQuestionsCount,
  failures,
}: {
  workItemSpecSnapshot: WorkItemSpecSnapshot
  workItemId: string
  discoveryArtifactId: string | null
  discoveryArtifactOwnership: DiscoveryArtifactOwnershipRow | null
  latestOpenQuestionsCount: number
  failures: RedGateFailure[]
}): EvaluateAndRecordRedApprovalGateOutput => {
  const reasons: string[] = []

  if (!discoveryArtifactId || !discoveryArtifactOwnership || discoveryArtifactOwnership.work_item_id !== workItemId) {
    reasons.push('Red gate discovery artifact must belong to the same work item as the decision.')
  }

  if (!workItemSpecSnapshot.spec_path || !workItemSpecSnapshot.spec_commit_sha) {
    reasons.push('Red gate requires an updated spec artifact (spec path and commit SHA).')
  }

  if (latestOpenQuestionsCount > 0) {
    reasons.push('Red gate requires latest discovery open questions to be resolved.')
  }

  if (failures.length === 0) {
    reasons.push('Red gate requires at least one targeted failing executable check.')
  }

  const hasDisallowedFailureCategory = failures.some(
    (failure) => !approvableRedFailureCategorySet.has(failure.category),
  )
  if (hasDisallowedFailureCategory) {
    reasons.push('Red gate failure categories must be approvable: expected_behavior_fail|missing_impl.')
  }

  return {
    decision: reasons.length > 0 ? 'rejected' : 'approved',
    reasons,
  }
}

const getLatestDiscoveryMutationAt = ({
  latestDiscoveryArtifact,
}: {
  latestDiscoveryArtifact: LatestDiscoveryArtifactSnapshot | null
}): string | null => {
  if (!latestDiscoveryArtifact) {
    return null
  }

  return latestDiscoveryArtifact.updated_at > latestDiscoveryArtifact.collected_at
    ? latestDiscoveryArtifact.updated_at
    : latestDiscoveryArtifact.collected_at
}

const persistGateDecision = ({
  db,
  decisionId,
  workItemId,
  gateName,
  actorType,
  actorId,
  reason,
  discoveryArtifactId,
  failures,
  evidenceRefs,
  decidedAt,
  decision,
  discoveryArtifactUpdatedAtSnapshot,
  specCommitSha,
  driftStaleApprovalDecisionId,
  driftSignature,
}: {
  db: Database
  decisionId: string
  workItemId: string
  gateName: GateDecisionName
  actorType: KanbanActorType
  actorId: string
  reason: string
  discoveryArtifactId: string | null
  failures: GateDecisionFailure[]
  evidenceRefs: GateDecisionEvidenceRef[]
  decidedAt: string
  decision: 'approved' | 'rejected'
  discoveryArtifactUpdatedAtSnapshot: string | null
  specCommitSha: string | null
  driftStaleApprovalDecisionId: string | null
  driftSignature: string | null
}): void => {
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
  const insertEvidenceRef = db.query(
    `INSERT INTO gate_decision_evidence_cache_refs (
      gate_decision_id,
      context_db_path,
      evidence_cache_row_id
    ) VALUES (?, ?, ?)`,
  )
  const insertFailure = db.query(
    `INSERT INTO gate_decision_failures (
      gate_decision_id,
      failure_sequence,
      failure_category,
      check_name,
      detail
    ) VALUES (?, ?, ?, ?, ?)`,
  )

  const transaction = db.transaction(() => {
    insertDecision.run(
      decisionId,
      workItemId,
      gateName,
      decision,
      actorType,
      actorId,
      reason,
      discoveryArtifactId,
      discoveryArtifactUpdatedAtSnapshot,
      specCommitSha,
      driftStaleApprovalDecisionId,
      driftSignature,
      decidedAt,
      nowIso(),
    )

    for (const evidenceRef of evidenceRefs) {
      insertEvidenceRef.run(decisionId, evidenceRef.contextDbPath, evidenceRef.evidenceCacheRowId)
    }

    for (const [failureIndex, failure] of failures.entries()) {
      insertFailure.run(decisionId, failureIndex + 1, failure.category, failure.checkName, failure.detail)
    }
  })

  transaction()
}

export const openKanbanDatabase = async ({ dbPath }: { dbPath: string }): Promise<Database> => {
  await ensureParentDirectory(dbPath)
  const db = new Database(dbPath, { create: true })
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(await getSchemaSql())
  db.query('INSERT OR IGNORE INTO kanban_migrations (version, applied_at) VALUES (?, ?)').run(
    KANBAN_SCHEMA_VERSION,
    nowIso(),
  )
  return db
}

export const closeKanbanDatabase = (db: Database): void => {
  db.close(false)
}

const toExecutionNamePart = ({ value, fallback }: { value: string; fallback: string }): string => {
  const slug = kebabCase(value)
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug.length > 0 ? slug : fallback
}

const addSecondsToIso = ({ iso, seconds }: { iso: string; seconds: number }): string =>
  new Date(Date.parse(iso) + seconds * 1000).toISOString()

export type StartWorkItemExecutionInput = {
  db: Database
  workItemId: string
  actorType: KanbanActorType
  actorId: string
  repoPath: string
  targetRef: string
  occurredAt?: string
}

export type StartWorkItemExecutionOutput = {
  branchRef: string
  worktreePath: string
  targetRef: string
}

export const startWorkItemExecution = async ({
  db,
  workItemId,
  actorType,
  actorId,
  repoPath,
  targetRef,
  occurredAt = nowIso(),
}: StartWorkItemExecutionInput): Promise<StartWorkItemExecutionOutput> => {
  const workItem = requireWorkItemExecutionSnapshot({ db, workItemId })
  const unresolvedDependencyCount = readUnresolvedDependencyCount({ db, workItemId })
  const latestRedGateDecision = readLatestRedGateDecision({ db, workItemId })
  const latestDiscoveryArtifact = readLatestDiscoveryArtifact({ db, workItemId })
  const latestDiscoveryMutationAt = getLatestDiscoveryMutationAt({ latestDiscoveryArtifact })
  const workItemSpecSnapshot = requireWorkItemSpecSnapshot({ db, workItemId })

  if (workItem.status !== WORK_ITEM_LIFECYCLE_STATES.red_approved) {
    throw new Error(
      `Work item "${workItemId}" must be in "${WORK_ITEM_LIFECYCLE_STATES.red_approved}" to start execution (received "${workItem.status}").`,
    )
  }

  if (unresolvedDependencyCount > 0) {
    throw new Error(
      `Work item "${workItemId}" cannot start green execution until guard "dependencies_resolved" passes (${unresolvedDependencyCount} unresolved dependenc${unresolvedDependencyCount === 1 ? 'y' : 'ies'}).`,
    )
  }

  const latestOpenQuestionsCount = readLatestOpenQuestionsCount({ db, workItemId })
  if (latestOpenQuestionsCount > 0) {
    throw new Error(
      `Work item "${workItemId}" cannot start green execution until guard "open_questions_resolved" passes (${latestOpenQuestionsCount} open question${latestOpenQuestionsCount === 1 ? '' : 's'}).`,
    )
  }

  const redApprovalIsFresh =
    latestDiscoveryArtifact !== null &&
    latestRedGateDecision?.decision === 'approved' &&
    latestRedGateDecision.spec_commit_sha === workItemSpecSnapshot.spec_commit_sha &&
    latestRedGateDecision.discovery_artifact_id === latestDiscoveryArtifact.id &&
    (!latestDiscoveryMutationAt || latestDiscoveryMutationAt <= latestRedGateDecision.decided_at)

  if (!redApprovalIsFresh) {
    throw new Error(
      `Work item "${workItemId}" cannot start green execution until guard "red_approval_is_fresh" passes.`,
    )
  }

  if (workItem.execution_branch_ref || workItem.execution_worktree_path || workItem.execution_target_ref) {
    throw new Error(`Work item "${workItemId}" already has an execution environment.`)
  }

  const safeWorkItemId = toExecutionNamePart({ value: workItemId, fallback: 'work-item' })
  const slug = toExecutionNamePart({ value: workItem.title, fallback: 'work-item' })
  const executionName = `${safeWorkItemId}-${slug}`
  const branchRef = `item/${executionName}`
  const worktreesRoot = resolve(repoPath, '.worktrees')
  const worktreePath = resolve(worktreesRoot, executionName)
  const relativeWorktreePath = relative(worktreesRoot, worktreePath)

  if (
    relativeWorktreePath === '' ||
    relativeWorktreePath === '.' ||
    relativeWorktreePath.startsWith('..') ||
    relativeWorktreePath.includes('/../') ||
    relativeWorktreePath.includes('\\..\\')
  ) {
    throw new Error(
      `Work item "${workItemId}" resolved to an invalid execution worktree path outside "${worktreesRoot}".`,
    )
  }

  db.transaction(() => {
    db.query(
      `UPDATE work_items
       SET status = ?,
           execution_branch_ref = ?,
           execution_worktree_path = ?,
           execution_target_ref = ?,
           execution_prepared_at = ?,
           updated_at = ?
       WHERE id = ?`,
    ).run(
      WORK_ITEM_LIFECYCLE_STATES.green_pending,
      branchRef,
      worktreePath,
      targetRef,
      occurredAt,
      nowIso(),
      workItemId,
    )
  })()

  try {
    await mkdir(worktreesRoot, { recursive: true })
    await runGitCommand({
      cwd: repoPath,
      args: ['worktree', 'add', '-b', branchRef, worktreePath, targetRef],
    })
  } catch (error: unknown) {
    db.query(
      `UPDATE work_items
       SET status = ?,
           execution_branch_ref = NULL,
           execution_worktree_path = NULL,
           execution_target_ref = NULL,
           execution_prepared_at = NULL,
           updated_at = ?
       WHERE id = ?`,
    ).run(workItem.status, nowIso(), workItemId)
    throw error
  }

  db.transaction(() => {
    db.query(
      `INSERT INTO work_item_events (
        id,
        work_item_id,
        event_kind,
        payload_json,
        occurred_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      crypto.randomUUID(),
      workItemId,
      WORK_ITEM_LIFECYCLE_EVENTS.start_green_execution,
      JSON.stringify({
        actorType,
        actorId,
        branchRef,
        worktreePath,
        targetRef,
      }),
      occurredAt,
      nowIso(),
    )
  })()

  return {
    branchRef,
    worktreePath,
    targetRef,
  }
}

export type RunWorkItemPostMergeCleanupInput = {
  db: Database
  workItemId: string
  actorType: KanbanActorType
  actorId: string
  repoPath: string
  branchRetentionTtlSeconds?: number
  occurredAt?: string
}

export type RunWorkItemPostMergeCleanupOutput = {
  status: typeof WORK_ITEM_LIFECYCLE_STATES.cleanup_pending | typeof WORK_ITEM_LIFECYCLE_STATES.cleaned
  branchRef: string
  worktreePath: string
  targetRef: string
  branchPruneAfterAt: string
  worktreeRemovedAt: string | null
  branchPrunedAt: string | null
}

export const runWorkItemPostMergeCleanup = async ({
  db,
  workItemId,
  actorType,
  actorId,
  repoPath,
  branchRetentionTtlSeconds = 86400,
  occurredAt = nowIso(),
}: RunWorkItemPostMergeCleanupInput): Promise<RunWorkItemPostMergeCleanupOutput> => {
  const workItem = requireWorkItemExecutionSnapshot({ db, workItemId })

  if (
    workItem.status !== WORK_ITEM_LIFECYCLE_STATES.merged &&
    workItem.status !== WORK_ITEM_LIFECYCLE_STATES.cleanup_pending
  ) {
    throw new Error(
      `Work item "${workItemId}" must be in "${WORK_ITEM_LIFECYCLE_STATES.merged}" or "${WORK_ITEM_LIFECYCLE_STATES.cleanup_pending}" to run cleanup (received "${workItem.status}").`,
    )
  }

  if (!workItem.execution_branch_ref || !workItem.execution_worktree_path || !workItem.execution_target_ref) {
    throw new Error(`Work item "${workItemId}" does not have a persisted execution environment.`)
  }

  const branchRef = workItem.execution_branch_ref
  const worktreePath = workItem.execution_worktree_path
  const targetRef = workItem.execution_target_ref
  const branchPruneAfterAt =
    workItem.cleanup_branch_prune_after_at ?? addSecondsToIso({ iso: occurredAt, seconds: branchRetentionTtlSeconds })

  let worktreeRemovedAt = workItem.cleanup_worktree_removed_at
  if (!worktreeRemovedAt) {
    const worktreeGitFileExists = await Bun.file(join(worktreePath, '.git')).exists()
    if (worktreeGitFileExists) {
      await runGitCommand({
        cwd: repoPath,
        args: ['worktree', 'remove', '--force', worktreePath],
      })
    }
    worktreeRemovedAt = occurredAt
  }

  let branchPrunedAt = workItem.cleanup_branch_pruned_at
  let nextStatus: RunWorkItemPostMergeCleanupOutput['status'] = WORK_ITEM_LIFECYCLE_STATES.cleanup_pending

  if (
    workItem.status === WORK_ITEM_LIFECYCLE_STATES.cleanup_pending &&
    !branchPrunedAt &&
    occurredAt >= branchPruneAfterAt
  ) {
    const branchExistsResult = await runGitCommand({
      cwd: repoPath,
      args: ['rev-parse', '--verify', `${branchRef}^{commit}`],
      allowFailure: true,
    })

    if (branchExistsResult.exitCode === 0) {
      const deleteBranchResult = await runGitCommand({
        cwd: repoPath,
        args: ['branch', '-d', branchRef],
        allowFailure: true,
      })

      if (deleteBranchResult.exitCode === 0) {
        branchPrunedAt = occurredAt
        nextStatus = WORK_ITEM_LIFECYCLE_STATES.cleaned
      }
    } else {
      branchPrunedAt = occurredAt
      nextStatus = WORK_ITEM_LIFECYCLE_STATES.cleaned
    }
  }

  db.transaction(() => {
    db.query(
      `UPDATE work_items
       SET status = ?,
           cleanup_branch_prune_after_at = ?,
           cleanup_worktree_removed_at = ?,
           cleanup_branch_pruned_at = ?,
           updated_at = ?
       WHERE id = ?`,
    ).run(nextStatus, branchPruneAfterAt, worktreeRemovedAt, branchPrunedAt, nowIso(), workItemId)

    if (workItem.status !== WORK_ITEM_LIFECYCLE_STATES.cleanup_pending) {
      db.query(
        `INSERT INTO work_item_events (
          id,
          work_item_id,
          event_kind,
          payload_json,
          occurred_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        crypto.randomUUID(),
        workItemId,
        WORK_ITEM_LIFECYCLE_EVENTS.schedule_cleanup,
        JSON.stringify({
          actorType,
          actorId,
          branchRef,
          worktreePath,
          targetRef,
          branchPruneAfterAt,
          worktreeRemovedAt,
        }),
        occurredAt,
        nowIso(),
      )
    }

    if (nextStatus === WORK_ITEM_LIFECYCLE_STATES.cleaned && workItem.cleanup_branch_pruned_at === null) {
      db.query(
        `INSERT INTO work_item_events (
          id,
          work_item_id,
          event_kind,
          payload_json,
          occurred_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        crypto.randomUUID(),
        workItemId,
        WORK_ITEM_LIFECYCLE_EVENTS.mark_cleaned,
        JSON.stringify({
          actorType,
          actorId,
          branchRef,
          worktreePath,
          targetRef,
          branchPruneAfterAt,
          worktreeRemovedAt,
          branchPrunedAt,
        }),
        occurredAt,
        nowIso(),
      )
    }
  })()

  return {
    status: nextStatus,
    branchRef,
    worktreePath,
    targetRef,
    branchPruneAfterAt,
    worktreeRemovedAt,
    branchPrunedAt,
  }
}

export const evaluateAndRecordRedApprovalGate = ({
  db,
  decisionId,
  workItemId,
  actorType,
  actorId,
  reason,
  discoveryArtifactId,
  failures,
  evidenceRefs,
  decidedAt = nowIso(),
}: EvaluateAndRecordRedApprovalGateInput): EvaluateAndRecordRedApprovalGateOutput => {
  const workItemSpecSnapshot = requireWorkItemSpecSnapshot({ db, workItemId })
  const discoveryArtifactOwnership =
    discoveryArtifactId === null ? null : readDiscoveryArtifactOwnership({ db, discoveryArtifactId })
  const ownedDiscoveryArtifactId =
    discoveryArtifactOwnership && discoveryArtifactOwnership.work_item_id === workItemId
      ? discoveryArtifactOwnership.id
      : null
  const evaluation = evaluateRedApprovalDecision({
    workItemSpecSnapshot,
    workItemId,
    discoveryArtifactId,
    discoveryArtifactOwnership,
    latestOpenQuestionsCount: readLatestOpenQuestionsCount({ db, workItemId }),
    failures,
  })

  persistGateDecision({
    db,
    decisionId,
    workItemId,
    gateName: 'red_approval',
    actorType,
    actorId,
    reason,
    discoveryArtifactId: ownedDiscoveryArtifactId,
    failures,
    evidenceRefs,
    decidedAt,
    decision: evaluation.decision,
    discoveryArtifactUpdatedAtSnapshot: discoveryArtifactOwnership?.updated_at ?? null,
    specCommitSha: workItemSpecSnapshot.spec_commit_sha,
    driftStaleApprovalDecisionId: null,
    driftSignature: null,
  })

  return evaluation
}

const FRONTIER_VERIFICATION_CHECK_NAME = 'behavioral-frontier verify'
const FRONTIER_DISCOVERY_PRECONDITION_CHECK_NAME =
  'behavioral-frontier verify precondition:discovery-artifact-ownership'
const FRONTIER_SPEC_PRECONDITION_CHECK_NAME = 'behavioral-frontier verify precondition:spec-metadata'

export type EvaluateAndRecordFrontierVerificationGateInput = {
  db: Database
  decisionId: string
  workItemId: string
  actorType: KanbanActorType
  actorId: string
  reason: string
  discoveryArtifactId: string | null
  evidenceRefs: GateDecisionEvidenceRef[]
  snapshotMessages?: SnapshotMessage[]
  triggers?: BPEvent[]
  maxDepth?: number
  cwd?: string
  decidedAt?: string
}

export type EvaluateAndRecordFrontierVerificationGateOutput = {
  decision: 'approved' | 'rejected'
  verifyStatus:
    | typeof BEHAVIORAL_FRONTIER_VERIFY_STATUSES.verified
    | typeof BEHAVIORAL_FRONTIER_VERIFY_STATUSES.failed
    | typeof BEHAVIORAL_FRONTIER_VERIFY_STATUSES.truncated
  failureCategories: FrontierFailureCategory[]
  checkRunId: string
  escalationHints: {
    dependencyDeadlockCount: number
  }
}

const dedupeFailureCategories = ({ failures }: { failures: FrontierGateFailure[] }): FrontierFailureCategory[] => [
  ...new Set(failures.map((failure) => failure.category)),
]

const MERGE_SIMULATION_CHECK_NAME = 'git merge --no-commit --no-ff'
const MERGE_SIMULATION_REQUIRED_CHECKS_CHECK_NAME = 'git merge --no-commit --no-ff precondition:required-checks'
const MERGE_SIMULATION_FRONTIER_CHECK_REQUIRED_CHECK_NAME =
  'git merge --no-commit --no-ff precondition:frontier-verification-check'
const MERGE_SIMULATION_SOURCE_REF_CHECK_NAME = 'git rev-parse source ref'
const MERGE_SIMULATION_TARGET_REF_CHECK_NAME = 'git rev-parse target ref'

export type EvaluateAndRecordMergeSimulationGateInput = {
  db: Database
  decisionId: string
  workItemId: string
  actorType: KanbanActorType
  actorId: string
  reason: string
  repoPath: string
  sourceRef: string
  targetRef: string
  requiredCheckRunIds: string[]
  simulationWorktreePath?: string
  evidenceRefs?: GateDecisionEvidenceRef[]
  decidedAt?: string
}

export type EvaluateAndRecordMergeSimulationGateOutput = {
  decision: 'approved' | 'rejected'
  failureCategories: MergeFailureCategory[]
  checkRunId: string
  commitRefs: {
    sourceHeadSha: string | null
    targetHeadSha: string | null
  }
}

const dedupeMergeFailureCategories = ({ failures }: { failures: MergeGateFailure[] }): MergeFailureCategory[] => [
  ...new Set(failures.map((failure) => failure.category)),
]

export const evaluateAndRecordFrontierVerificationGate = async ({
  db,
  decisionId,
  workItemId,
  actorType,
  actorId,
  reason,
  discoveryArtifactId,
  evidenceRefs,
  snapshotMessages,
  triggers,
  maxDepth,
  cwd,
  decidedAt = nowIso(),
}: EvaluateAndRecordFrontierVerificationGateInput): Promise<EvaluateAndRecordFrontierVerificationGateOutput> => {
  const workItemSpecSnapshot = requireWorkItemSpecSnapshot({ db, workItemId })
  const discoveryArtifactOwnership =
    discoveryArtifactId === null ? null : readDiscoveryArtifactOwnership({ db, discoveryArtifactId })
  const ownedDiscoveryArtifactId =
    discoveryArtifactOwnership && discoveryArtifactOwnership.work_item_id === workItemId
      ? discoveryArtifactOwnership.id
      : null

  const failures: FrontierGateFailure[] = []
  const findings: unknown[] = []
  let report: Record<string, unknown> | null = null
  let verifyStatus:
    | typeof BEHAVIORAL_FRONTIER_VERIFY_STATUSES.verified
    | typeof BEHAVIORAL_FRONTIER_VERIFY_STATUSES.failed
    | typeof BEHAVIORAL_FRONTIER_VERIFY_STATUSES.truncated

  if (!discoveryArtifactId || !discoveryArtifactOwnership || discoveryArtifactOwnership.work_item_id !== workItemId) {
    failures.push({
      category: FRONTIER_FAILURE_CATEGORIES.frontier_execution_error,
      checkName: FRONTIER_DISCOVERY_PRECONDITION_CHECK_NAME,
      detail: 'Frontier verification requires a discovery artifact owned by the same work item.',
    })
  }

  if (!workItemSpecSnapshot.spec_path || !workItemSpecSnapshot.spec_commit_sha) {
    failures.push({
      category: FRONTIER_FAILURE_CATEGORIES.frontier_execution_error,
      checkName: FRONTIER_SPEC_PRECONDITION_CHECK_NAME,
      detail: 'Frontier verification requires spec_path and spec_commit_sha on the work item.',
    })
  }

  if (failures.length === 0) {
    try {
      const verification = await runBehavioralFrontier({
        mode: 'verify',
        specPath: workItemSpecSnapshot.spec_path!,
        ...(cwd === undefined ? {} : { cwd }),
        ...(snapshotMessages === undefined ? {} : { snapshotMessages }),
        ...(triggers === undefined ? {} : { triggers }),
        ...(maxDepth === undefined ? {} : { maxDepth }),
        strategy: BEHAVIORAL_FRONTIER_STRATEGIES.bfs,
        selectionPolicy: BEHAVIORAL_FRONTIER_SELECTION_POLICIES.scheduler,
      })

      if (verification.mode !== 'verify') {
        throw new Error(`Expected behavioral-frontier verify output but received "${verification.mode}".`)
      }

      verifyStatus = verification.status
      report = verification.report
      findings.push(...verification.findings)

      if (verification.status === BEHAVIORAL_FRONTIER_VERIFY_STATUSES.failed) {
        failures.push({
          category: FRONTIER_FAILURE_CATEGORIES.frontier_deadlock_detected,
          checkName: FRONTIER_VERIFICATION_CHECK_NAME,
          detail: `Behavioral frontier verification found ${verification.findings.length} deadlock trace(s).`,
        })
      }

      if (verification.status === BEHAVIORAL_FRONTIER_VERIFY_STATUSES.truncated) {
        failures.push({
          category: FRONTIER_FAILURE_CATEGORIES.frontier_truncated,
          checkName: FRONTIER_VERIFICATION_CHECK_NAME,
          detail: 'Behavioral frontier verification reached maxDepth before exploration completed.',
        })
      }
    } catch (error: unknown) {
      verifyStatus = BEHAVIORAL_FRONTIER_VERIFY_STATUSES.failed
      failures.push({
        category: FRONTIER_FAILURE_CATEGORIES.frontier_execution_error,
        checkName: FRONTIER_VERIFICATION_CHECK_NAME,
        detail:
          error instanceof Error
            ? `Behavioral frontier verification execution failed: ${error.message}`
            : `Behavioral frontier verification execution failed: ${String(error)}`,
      })
    }
  } else {
    verifyStatus = BEHAVIORAL_FRONTIER_VERIFY_STATUSES.failed
  }

  const decision: 'approved' | 'rejected' = failures.length === 0 ? 'approved' : 'rejected'

  persistGateDecision({
    db,
    decisionId,
    workItemId,
    gateName: 'frontier_verification',
    actorType,
    actorId,
    reason,
    discoveryArtifactId: ownedDiscoveryArtifactId,
    failures,
    evidenceRefs,
    decidedAt,
    decision,
    discoveryArtifactUpdatedAtSnapshot: ownedDiscoveryArtifactId
      ? (discoveryArtifactOwnership?.updated_at ?? null)
      : null,
    specCommitSha: workItemSpecSnapshot.spec_commit_sha,
    driftStaleApprovalDecisionId: null,
    driftSignature: null,
  })

  const checkRunId = crypto.randomUUID()
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
    checkRunId,
    workItemId,
    decisionId,
    FRONTIER_VERIFICATION_CHECK_NAME,
    'behavioral_frontier',
    decision === 'approved' ? 'passed' : 'failed',
    'red_approval',
    decidedAt,
    decidedAt,
    nowIso(),
    nowIso(),
  )

  db.query(
    `INSERT INTO work_item_events (
      id,
      work_item_id,
      event_kind,
      payload_json,
      occurred_at,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    crypto.randomUUID(),
    workItemId,
    'frontier_verification_recorded',
    JSON.stringify({
      decisionId,
      checkRunId,
      status: verifyStatus,
      report,
      findings,
      failureCategories: dedupeFailureCategories({ failures }),
    }),
    decidedAt,
    nowIso(),
  )

  return {
    decision,
    verifyStatus,
    failureCategories: dedupeFailureCategories({ failures }),
    checkRunId,
    escalationHints: {
      dependencyDeadlockCount: verifyStatus === BEHAVIORAL_FRONTIER_VERIFY_STATUSES.failed ? findings.length : 0,
    },
  }
}

export const evaluateAndRecordMergeSimulationGate = async ({
  db,
  decisionId,
  workItemId,
  actorType,
  actorId,
  reason,
  repoPath,
  sourceRef,
  targetRef,
  requiredCheckRunIds,
  simulationWorktreePath,
  evidenceRefs = [],
  decidedAt = nowIso(),
}: EvaluateAndRecordMergeSimulationGateInput): Promise<EvaluateAndRecordMergeSimulationGateOutput> => {
  const workItemSpecSnapshot = requireWorkItemSpecSnapshot({ db, workItemId })
  const failures: MergeGateFailure[] = []
  const uniqueRequiredCheckRunIds = [...new Set(requiredCheckRunIds)]
  let sourceHeadSha: string | null = null
  let targetHeadSha: string | null = null

  const requiredCheckRowsById = new Map<string, RequiredCheckRunRow>()
  if (uniqueRequiredCheckRunIds.length > 0) {
    const placeholders = uniqueRequiredCheckRunIds.map(() => '?').join(', ')
    const requiredCheckRows = db
      .query<RequiredCheckRunRow, [string, ...string[]]>(
        `SELECT check_runs.id,
                check_runs.check_name,
                check_runs.status,
                check_runs.check_type,
                check_runs.required_gate,
                check_runs.gate_decision_id,
                gate_decisions.gate_name,
                gate_decisions.decision AS gate_decision,
                gate_decisions.spec_commit_sha AS gate_decision_spec_commit_sha
         FROM check_runs
         LEFT JOIN gate_decisions
           ON gate_decisions.id = check_runs.gate_decision_id
         WHERE check_runs.work_item_id = ?
           AND check_runs.id IN (${placeholders})`,
      )
      .all(workItemId, ...uniqueRequiredCheckRunIds)

    for (const row of requiredCheckRows) {
      requiredCheckRowsById.set(row.id, row)
    }
  } else {
    failures.push({
      category: MERGE_FAILURE_CATEGORIES.required_checks_missing,
      checkName: MERGE_SIMULATION_REQUIRED_CHECKS_CHECK_NAME,
      detail: 'Merge simulation requires at least one required check run id.',
    })
  }

  let hasFrontierVerificationCheckEvidence = false
  const requiredChecks = uniqueRequiredCheckRunIds.map((checkRunId) => {
    const checkRow = requiredCheckRowsById.get(checkRunId)
    if (!checkRow) {
      failures.push({
        category: MERGE_FAILURE_CATEGORIES.required_checks_missing,
        checkName: `required-check:${checkRunId}`,
        detail: `Required check "${checkRunId}" does not exist for work item "${workItemId}".`,
      })
      return {
        id: checkRunId,
        status: 'missing' as const,
      }
    }

    const isApprovedFrontierVerificationCheck =
      checkRow.check_type === 'behavioral_frontier' &&
      checkRow.gate_name === 'frontier_verification' &&
      checkRow.gate_decision === 'approved'
    const isCurrentSpecFrontierVerificationCheck =
      isApprovedFrontierVerificationCheck &&
      checkRow.gate_decision_spec_commit_sha === workItemSpecSnapshot.spec_commit_sha
    const isMergeEligibleCheck =
      checkRow.required_gate === 'frontier_verification' || isCurrentSpecFrontierVerificationCheck

    if (isCurrentSpecFrontierVerificationCheck && checkRow.status === 'passed') {
      hasFrontierVerificationCheckEvidence = true
    }

    if (checkRow.status !== 'passed') {
      failures.push({
        category: MERGE_FAILURE_CATEGORIES.required_checks_failed,
        checkName: `required-check:${checkRunId}`,
        detail: `Required check "${checkRunId}" has status "${checkRow.status}" (expected "passed").`,
      })
    } else if (
      isApprovedFrontierVerificationCheck &&
      checkRow.gate_decision_spec_commit_sha !== workItemSpecSnapshot.spec_commit_sha
    ) {
      failures.push({
        category: MERGE_FAILURE_CATEGORIES.required_checks_failed,
        checkName: `required-check:${checkRunId}`,
        detail: `Required check "${checkRunId}" is linked to frontier_verification decision "${checkRow.gate_decision_id}" for stale spec_commit_sha "${checkRow.gate_decision_spec_commit_sha ?? 'null'}" (current "${workItemSpecSnapshot.spec_commit_sha ?? 'null'}").`,
      })
    } else if (!isMergeEligibleCheck) {
      failures.push({
        category: MERGE_FAILURE_CATEGORIES.required_checks_failed,
        checkName: `required-check:${checkRunId}`,
        detail: `Required check "${checkRunId}" is not merge-eligible (required_gate="${checkRow.required_gate}").`,
      })
    }

    return {
      id: checkRunId,
      status: checkRow.status,
    }
  })

  if (uniqueRequiredCheckRunIds.length > 0 && !hasFrontierVerificationCheckEvidence) {
    failures.push({
      category: MERGE_FAILURE_CATEGORIES.required_checks_missing,
      checkName: MERGE_SIMULATION_FRONTIER_CHECK_REQUIRED_CHECK_NAME,
      detail:
        'Merge simulation requires a passed behavioral_frontier check linked to an approved frontier_verification decision.',
    })
  }

  if (failures.length === 0) {
    const sourceHeadResult = await runGitCommand({
      cwd: repoPath,
      args: ['rev-parse', '--verify', `${sourceRef}^{commit}`],
      allowFailure: true,
    })
    if (sourceHeadResult.exitCode !== 0 || !sourceHeadResult.stdout) {
      failures.push({
        category: MERGE_FAILURE_CATEGORIES.merge_simulation_execution_error,
        checkName: MERGE_SIMULATION_SOURCE_REF_CHECK_NAME,
        detail: `Unable to resolve source ref "${sourceRef}" to a commit.`,
      })
    } else {
      sourceHeadSha = sourceHeadResult.stdout
    }

    const targetHeadResult = await runGitCommand({
      cwd: repoPath,
      args: ['rev-parse', '--verify', `${targetRef}^{commit}`],
      allowFailure: true,
    })
    if (targetHeadResult.exitCode !== 0 || !targetHeadResult.stdout) {
      failures.push({
        category: MERGE_FAILURE_CATEGORIES.merge_simulation_execution_error,
        checkName: MERGE_SIMULATION_TARGET_REF_CHECK_NAME,
        detail: `Unable to resolve target ref "${targetRef}" to a commit.`,
      })
    } else {
      targetHeadSha = targetHeadResult.stdout
    }
  }

  if (failures.length === 0) {
    const resolvedSimulationWorktreePath =
      simulationWorktreePath ?? (await mkdtemp(join(tmpdir(), 'plaited-kanban-merge-sim-')))
    const removeSimulationWorktreePathOnExit = simulationWorktreePath === undefined
    let worktreeAdded = false
    const mergeCommandArgs = ['merge', '--no-commit', '--no-ff', sourceHeadSha!]
    const worktreeAddArgs = ['worktree', 'add', '--detach', resolvedSimulationWorktreePath, targetHeadSha!]

    try {
      const worktreeAddResult = await runGitCommand({
        cwd: repoPath,
        args: worktreeAddArgs,
        allowFailure: true,
      })
      if (worktreeAddResult.exitCode === 0) {
        worktreeAdded = true

        const mergeResult = await runGitCommand({
          cwd: resolvedSimulationWorktreePath,
          args: mergeCommandArgs,
          allowFailure: true,
        })

        if (mergeResult.exitCode !== 0) {
          const mergedOutput = [mergeResult.stderr, mergeResult.stdout].filter(Boolean).join(' ')
          failures.push({
            category: /CONFLICT/.test(mergedOutput)
              ? MERGE_FAILURE_CATEGORIES.merge_conflict_detected
              : MERGE_FAILURE_CATEGORIES.merge_simulation_execution_error,
            checkName: formatGitCommand(mergeCommandArgs),
            detail: mergedOutput || 'Merge simulation command failed.',
          })
        }
      } else {
        const mergedOutput = [worktreeAddResult.stderr, worktreeAddResult.stdout].filter(Boolean).join(' ')
        failures.push({
          category: MERGE_FAILURE_CATEGORIES.merge_simulation_execution_error,
          checkName: formatGitCommand(worktreeAddArgs),
          detail: mergedOutput || 'Merge simulation worktree setup failed.',
        })
      }
    } catch (error: unknown) {
      failures.push({
        category: MERGE_FAILURE_CATEGORIES.merge_simulation_execution_error,
        checkName: 'git worktree setup',
        detail:
          error instanceof Error
            ? `Merge simulation setup failed: ${error.message}`
            : `Merge simulation setup failed: ${String(error)}`,
      })
    } finally {
      if (worktreeAdded) {
        await runGitCommand({
          cwd: resolvedSimulationWorktreePath,
          args: ['merge', '--abort'],
          allowFailure: true,
        })
        await runGitCommand({
          cwd: repoPath,
          args: ['worktree', 'remove', '--force', resolvedSimulationWorktreePath],
          allowFailure: true,
        })
      }
      if (removeSimulationWorktreePathOnExit) {
        await rm(resolvedSimulationWorktreePath, { recursive: true, force: true })
      }
    }
  }

  const decision: 'approved' | 'rejected' = failures.length > 0 ? 'rejected' : 'approved'
  const checkRunId = crypto.randomUUID()
  const mergeCommand = `${MERGE_SIMULATION_CHECK_NAME} ${sourceHeadSha ?? sourceRef}`

  persistGateDecision({
    db,
    decisionId,
    workItemId,
    gateName: 'merge_simulation',
    actorType,
    actorId,
    reason,
    discoveryArtifactId: null,
    failures,
    evidenceRefs,
    decidedAt,
    decision,
    discoveryArtifactUpdatedAtSnapshot: null,
    specCommitSha: workItemSpecSnapshot.spec_commit_sha,
    driftStaleApprovalDecisionId: null,
    driftSignature: null,
  })

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
    checkRunId,
    workItemId,
    decisionId,
    mergeCommand,
    'merge_simulation',
    decision === 'approved' ? 'passed' : 'failed',
    'frontier_verification',
    decidedAt,
    decidedAt,
    nowIso(),
    nowIso(),
  )

  db.query(
    `INSERT INTO work_item_events (
      id,
      work_item_id,
      event_kind,
      payload_json,
      occurred_at,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    crypto.randomUUID(),
    workItemId,
    'merge_simulation_recorded',
    JSON.stringify({
      decisionId,
      checkRunId,
      targetRef,
      sourceRef,
      decision,
      requiredChecks,
      commitRefs: {
        sourceHeadSha,
        targetHeadSha,
      },
      command: mergeCommand,
      failureCategories: dedupeMergeFailureCategories({ failures }),
      simulatedAt: decidedAt,
    }),
    decidedAt,
    nowIso(),
  )

  return {
    decision,
    failureCategories: dedupeMergeFailureCategories({ failures }),
    checkRunId,
    commitRefs: {
      sourceHeadSha,
      targetHeadSha,
    },
  }
}

export type RevokeStaleRedApprovalOnDriftInput = {
  db: Database
  decisionId: string
  workItemId: string
  actorType: KanbanActorType
  actorId: string
  decidedAt?: string
}

export type RevokeStaleRedApprovalOnDriftOutput = {
  revoked: boolean
  reason: string
}

export const revokeStaleRedApprovalOnDrift = ({
  db,
  decisionId,
  workItemId,
  actorType,
  actorId,
  decidedAt = nowIso(),
}: RevokeStaleRedApprovalOnDriftInput): RevokeStaleRedApprovalOnDriftOutput => {
  const latestRedGateDecision = readLatestRedGateDecision({ db, workItemId })
  if (!latestRedGateDecision || latestRedGateDecision.decision !== 'approved') {
    return {
      revoked: false,
      reason: 'No approved red decision exists for this work item.',
    }
  }
  const latestApprovedRedDecision = latestRedGateDecision

  const latestDiscoveryArtifact = readLatestDiscoveryArtifact({ db, workItemId })
  const latestDiscoveryMutationAt = getLatestDiscoveryMutationAt({ latestDiscoveryArtifact })
  const workItemSpecSnapshot = requireWorkItemSpecSnapshot({ db, workItemId })
  const driftReasons: string[] = []

  if (latestDiscoveryArtifact && latestApprovedRedDecision.discovery_artifact_id !== latestDiscoveryArtifact.id) {
    driftReasons.push(
      `discovery artifact drift: approved=${latestApprovedRedDecision.discovery_artifact_id ?? 'null'} latest=${latestDiscoveryArtifact.id}`,
    )
  }

  if (latestDiscoveryMutationAt && latestDiscoveryMutationAt > latestApprovedRedDecision.decided_at) {
    driftReasons.push(
      `discovery mutation drift: latest_mutation=${latestDiscoveryMutationAt} approved_at=${latestApprovedRedDecision.decided_at}`,
    )
  }

  if (latestApprovedRedDecision.spec_commit_sha !== workItemSpecSnapshot.spec_commit_sha) {
    driftReasons.push(
      `spec_commit_sha drift: approved=${latestApprovedRedDecision.spec_commit_sha ?? 'null'} latest=${workItemSpecSnapshot.spec_commit_sha ?? 'null'}`,
    )
  }

  if (driftReasons.length === 0) {
    return {
      revoked: false,
      reason: 'No discovery/spec drift detected.',
    }
  }

  const driftSignature = JSON.stringify({
    staleApprovalDecisionId: latestApprovedRedDecision.id,
    approvedDiscoveryArtifactId: latestApprovedRedDecision.discovery_artifact_id,
    approvedDiscoveryUpdatedAtSnapshot: latestApprovedRedDecision.discovery_artifact_updated_at_snapshot,
    approvedSpecCommitSha: latestApprovedRedDecision.spec_commit_sha,
    approvedAt: latestApprovedRedDecision.decided_at,
    latestDiscoveryArtifactId: latestDiscoveryArtifact?.id ?? null,
    latestDiscoveryCollectedAt: latestDiscoveryArtifact?.collected_at ?? null,
    latestDiscoveryUpdatedAt: latestDiscoveryArtifact?.updated_at ?? null,
    latestDiscoveryMutationAt,
    latestSpecCommitSha: workItemSpecSnapshot.spec_commit_sha ?? null,
    driftReasons,
  })
  if (
    hasDriftRevocationForState({
      db,
      workItemId,
      staleApprovalDecisionId: latestApprovedRedDecision.id,
      driftSignature,
    })
  ) {
    return {
      revoked: false,
      reason: 'Red approval already revoked for the same drift state.',
    }
  }

  persistGateDecision({
    db,
    decisionId,
    workItemId,
    gateName: 'red_approval',
    actorType,
    actorId,
    reason: `Auto-revoked stale red approval due to ${driftReasons.join('; ')}`,
    discoveryArtifactId: latestDiscoveryArtifact?.id ?? latestApprovedRedDecision.discovery_artifact_id,
    failures: [],
    evidenceRefs: [],
    decidedAt,
    decision: 'rejected',
    discoveryArtifactUpdatedAtSnapshot: latestDiscoveryArtifact?.updated_at ?? null,
    specCommitSha: workItemSpecSnapshot.spec_commit_sha,
    driftStaleApprovalDecisionId: latestApprovedRedDecision.id,
    driftSignature,
  })

  return {
    revoked: true,
    reason: driftReasons.join('; '),
  }
}

export type EvaluateAndRecordEscalationDecisionInput = {
  db: Database
  workItemId: string
  evaluationContext: 'formulation' | 'red_approval' | 'frontier_verification' | 'merge_simulation'
  dependencyDeadlockCount: number
  riskyImpactScore: number
  actorType: KanbanActorType
  actorId: string
  occurredAt?: string
}

export type EvaluateAndRecordEscalationDecisionOutput = {
  triggered: boolean
  triggers: EscalationTriggerId[]
  targetAuthority: 'agent' | 'user'
}

export const evaluateAndRecordEscalationDecision = ({
  db,
  workItemId,
  evaluationContext,
  dependencyDeadlockCount,
  riskyImpactScore,
  actorType,
  actorId,
  occurredAt = nowIso(),
}: EvaluateAndRecordEscalationDecisionInput): EvaluateAndRecordEscalationDecisionOutput => {
  const openQuestionsCount = readLatestOpenQuestionsCount({ db, workItemId })
  const consecutiveRedRejectionCount = readConsecutiveRedRejectionCount({ db, workItemId })
  const triggers: EscalationTriggerId[] = []

  if (evaluationContext === 'formulation' && openQuestionsCount > 0) {
    triggers.push(ESCALATION_TRIGGER_IDS.open_questions_unresolved)
  }
  if (dependencyDeadlockCount > 0) {
    triggers.push(ESCALATION_TRIGGER_IDS.dependency_deadlock_detected)
  }
  if (consecutiveRedRejectionCount >= CONSECUTIVE_RED_REJECTION_ESCALATION_THRESHOLD) {
    triggers.push(ESCALATION_TRIGGER_IDS.consecutive_red_rejections)
  }
  if (riskyImpactScore >= RISKY_IMPACT_ESCALATION_THRESHOLD) {
    triggers.push(ESCALATION_TRIGGER_IDS.risky_impact_threshold_exceeded)
  }

  const hasAmbiguousDependencyState =
    triggers.includes(ESCALATION_TRIGGER_IDS.open_questions_unresolved) &&
    triggers.includes(ESCALATION_TRIGGER_IDS.dependency_deadlock_detected)
  const targetAuthority: 'agent' | 'user' =
    riskyImpactScore >= RISKY_IMPACT_ESCALATION_THRESHOLD || hasAmbiguousDependencyState ? 'user' : 'agent'

  if (triggers.length > 0) {
    db.query(
      `INSERT INTO work_item_events (
        id,
        work_item_id,
        event_kind,
        payload_json,
        occurred_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      crypto.randomUUID(),
      workItemId,
      'escalation_decision_recorded',
      JSON.stringify({
        actorType,
        actorId,
        targetAuthority,
        triggers,
      }),
      occurredAt,
      nowIso(),
    )
  }

  return {
    triggered: triggers.length > 0,
    triggers,
    targetAuthority,
  }
}

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
    throw new Error(`Kanban database does not exist: ${absoluteDbPath}`)
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
}): KanbanCliOutput => {
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
    mode: KANBAN_MODES.item,
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
}): KanbanCliOutput => {
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
    mode: KANBAN_MODES.readyQueue,
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
}): KanbanCliOutput => {
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
    mode: KANBAN_MODES.decisionAudit,
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

const loadBoardProjection = ({ db, dbPath }: { db: Database; dbPath: string }): KanbanCliOutput => {
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
    mode: KANBAN_MODES.board,
    dbPath,
    states,
    blockers,
    wip,
  }
}

const runKanbanRead = async (input: KanbanCliInput): Promise<KanbanCliOutput> => {
  const dbPath = resolve(input.dbPath)
  const db = await openProjectionDatabase(dbPath)

  try {
    switch (input.mode) {
      case KANBAN_MODES.board:
        return loadBoardProjection({ db, dbPath })
      case KANBAN_MODES.item:
        return loadItemProjection({ db, dbPath, workItemId: input.workItemId })
      case KANBAN_MODES.readyQueue:
        return loadReadyQueueProjection({ db, dbPath, nowIso: input.nowIso })
      case KANBAN_MODES.decisionAudit:
        return loadDecisionAuditProjection({
          db,
          dbPath,
          workItemId: input.workItemId,
          limit: input.limit,
        })
      default:
        throw new Error(`Mode "${input.mode}" is not a read projection mode.`)
    }
  } finally {
    db.close(false)
  }
}

const runKanbanWrite = async (input: KanbanCliInput): Promise<KanbanCliOutput> => {
  const dbPath = resolve(input.dbPath)
  const db = await openKanbanDatabase({ dbPath })

  try {
    switch (input.mode) {
      case KANBAN_MODES.initDb:
        return {
          ok: true,
          mode: KANBAN_MODES.initDb,
          dbPath,
        }
      case KANBAN_MODES.recordRedApproval:
        return {
          ok: true,
          mode: KANBAN_MODES.recordRedApproval,
          dbPath,
          ...evaluateAndRecordRedApprovalGate({ db, ...input }),
        }
      case KANBAN_MODES.revokeStaleRedApproval:
        return {
          ok: true,
          mode: KANBAN_MODES.revokeStaleRedApproval,
          dbPath,
          ...revokeStaleRedApprovalOnDrift({ db, ...input }),
        }
      case KANBAN_MODES.recordFrontierVerification:
        return {
          ok: true,
          mode: KANBAN_MODES.recordFrontierVerification,
          dbPath,
          ...(await evaluateAndRecordFrontierVerificationGate({
            db,
            ...input,
            snapshotMessages: input.snapshotMessages as SnapshotMessage[] | undefined,
            triggers: input.triggers as BPEvent[] | undefined,
          })),
        }
      case KANBAN_MODES.recordMergeSimulation:
        return {
          ok: true,
          mode: KANBAN_MODES.recordMergeSimulation,
          dbPath,
          ...(await evaluateAndRecordMergeSimulationGate({ db, ...input })),
        }
      case KANBAN_MODES.recordEscalation:
        return {
          ok: true,
          mode: KANBAN_MODES.recordEscalation,
          dbPath,
          ...evaluateAndRecordEscalationDecision({ db, ...input }),
        }
      case KANBAN_MODES.startExecution:
        return {
          ok: true,
          mode: KANBAN_MODES.startExecution,
          dbPath,
          ...(await startWorkItemExecution({ db, ...input })),
        }
      case KANBAN_MODES.runPostMergeCleanup:
        return {
          ok: true,
          mode: KANBAN_MODES.runPostMergeCleanup,
          dbPath,
          ...(await runWorkItemPostMergeCleanup({ db, ...input })),
        }
      default:
        throw new Error(`Mode "${input.mode}" is not a write mode.`)
    }
  } finally {
    closeKanbanDatabase(db)
  }
}

const runKanbanCommand = async (input: KanbanCliInput): Promise<KanbanCliOutput> => {
  switch (input.mode) {
    case KANBAN_MODES.board:
    case KANBAN_MODES.item:
    case KANBAN_MODES.readyQueue:
    case KANBAN_MODES.decisionAudit:
      return runKanbanRead(input)
    default:
      return runKanbanWrite(input)
  }
}

export const kanbanCli = makeCli({
  name: KANBAN_COMMAND,
  inputSchema: KanbanCliInputSchema,
  outputSchema: KanbanCliOutputSchema,
  run: runKanbanCommand,
})
