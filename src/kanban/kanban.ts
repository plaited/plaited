import { Database } from 'bun:sqlite'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { makeCli } from '../cli/cli.ts'

export * from './kanban.constants.ts'
export * from './kanban.schemas.ts'

import {
  KANBAN_COMMAND,
  KANBAN_MODES,
  KANBAN_READY_STATUS_VALUES,
  WORK_ITEM_LIFECYCLE_STATE_VALUES,
  WORK_ITEM_LIFECYCLE_STATES,
} from './kanban.constants.ts'
import {
  type KanbanCliInput,
  KanbanCliInputSchema,
  type KanbanCliOutput,
  KanbanCliOutputSchema,
} from './kanban.schemas.ts'

const SCHEMA_SQL_PATH = resolve(import.meta.dir, './assets/schema.sql')
// Version 1 was the policy-heavy greenfield schema on this branch. The durable
// ledger schema is intentionally incompatible and rejects v1-shaped databases.
const KANBAN_SCHEMA_VERSION = 2

let cachedSchemaSql: string | undefined

type WorkItemLifecycleState = (typeof WORK_ITEM_LIFECYCLE_STATE_VALUES)[number]

type ProjectionWorkItemRow = {
  id: string
  title: string
  status: WorkItemLifecycleState
}

type ProjectionDetailedWorkItemRow = {
  id: string
  request_id: string
  parent_work_item_id: string | null
  title: string
  status: WorkItemLifecycleState
  spec_path: string | null
  spec_commit_sha: string | null
}

type UnresolvedDependencyRow = {
  work_item_id: string
  dependency_id: string
  dependency_status: WorkItemLifecycleState
}

type DependencyRow = {
  id: string
  title: string
  status: WorkItemLifecycleState
}

type DiscoveryArtifactRow = {
  id: string
  artifact_version: number
  rules: string
  examples: string
  open_questions: string
  out_of_scope: string
  collected_at: string
  stale_after_at: string
}

type DecisionRow = {
  id: string
  work_item_id: string
  decision_kind: string
  decision: 'approved' | 'rejected'
  actor_type: 'agent' | 'user' | 'system'
  actor_id: string
  reason: string
  decided_at: string
  created_at: string
}

type DecisionEvidenceRefRow = {
  decision_id: string
  context_db_path: string
  evidence_cache_row_id: number
}

type EventRow = {
  id: string
  event_kind: string
  payload_json: string
  occurred_at: string
}

type ProjectionDecision = {
  id: string
  workItemId: string
  decisionKind: string
  decision: 'approved' | 'rejected'
  actorType: 'agent' | 'user' | 'system'
  actorId: string
  reason: string
  decidedAt: string
  evidenceRefs: Array<{
    contextDbPath: string
    evidenceCacheRowId: number
  }>
}

const nowIso = () => new Date().toISOString()
const oldSchemaTableNames = [
  'gate_decisions',
  'gate_decision_evidence_cache_refs',
  'gate_decision_failures',
  'check_runs',
] as const
const oldWorkItemColumnNames = [
  'execution_branch_ref',
  'execution_worktree_path',
  'execution_target_ref',
  'execution_prepared_at',
  'cleanup_branch_prune_after_at',
  'cleanup_worktree_removed_at',
  'cleanup_branch_pruned_at',
] as const

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

const assertSupportedSchema = ({ db, dbPath }: { db: Database; dbPath: string }): void => {
  const existingTables = db
    .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => row.name)
  const existingTableSet = new Set(existingTables)
  const oldArtifacts: string[] = oldSchemaTableNames.filter((tableName) => existingTableSet.has(tableName))

  if (existingTableSet.has('work_items')) {
    const oldColumns = db
      .query<{ name: string }, []>("PRAGMA table_info('work_items')")
      .all()
      .map((row) => row.name)
      .filter((columnName) => oldWorkItemColumnNames.includes(columnName as (typeof oldWorkItemColumnNames)[number]))
    oldArtifacts.push(...oldColumns.map((columnName) => `work_items.${columnName}`))
  }

  if (oldArtifacts.length > 0) {
    throw new Error(
      `unsupported kanban schema at ${dbPath}: found old policy-heavy artifacts ${oldArtifacts.join(', ')}. ` +
        'Reset this database or migrate it outside kanban before using the durable ledger CLI.',
    )
  }
}

const openKanbanDatabase = async ({ dbPath }: { dbPath: string }): Promise<Database> => {
  await ensureParentDirectory(dbPath)
  const db = new Database(dbPath, { create: true })
  db.run('PRAGMA foreign_keys = ON;')
  assertSupportedSchema({ db, dbPath })
  db.run(await getSchemaSql())
  db.query('INSERT OR IGNORE INTO kanban_migrations (version, applied_at) VALUES (?, ?)').run(
    KANBAN_SCHEMA_VERSION,
    nowIso(),
  )
  return db
}

const closeKanbanDatabase = (db: Database): void => {
  db.close(false)
}

const openProjectionDatabase = async (dbPath: string): Promise<Database> => {
  const absoluteDbPath = resolve(dbPath)
  if (!(await Bun.file(absoluteDbPath).exists())) {
    throw new Error(`Kanban database does not exist: ${absoluteDbPath}`)
  }

  const db = new Database(absoluteDbPath)
  db.run('PRAGMA foreign_keys = ON;')
  assertSupportedSchema({ db, dbPath: absoluteDbPath })
  return db
}

const readWorkItemSummary = ({ db, workItemId }: { db: Database; workItemId: string }) => {
  const workItem = db
    .query<{ id: string; status: WorkItemLifecycleState }, [string]>(
      `SELECT id, status
       FROM work_items
       WHERE id = ?`,
    )
    .get(workItemId)

  if (!workItem) {
    throw new Error(`Work item does not exist: ${workItemId}`)
  }

  return {
    id: workItem.id,
    status: workItem.status,
  }
}

const createWorkItem = ({
  db,
  input,
}: {
  db: Database
  input: Extract<KanbanCliInput, { mode: typeof KANBAN_MODES.createWorkItem }>
}) => {
  const createdAt = input.createdAt ?? nowIso()
  const insertRequest = db.query(
    `INSERT INTO requests (
      id,
      summary,
      status,
      requested_by_actor_type,
      requested_by_actor_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING`,
  )
  const insertWorkItem = db.query(
    `INSERT INTO work_items (
      id,
      request_id,
      parent_work_item_id,
      title,
      status,
      spec_path,
      spec_commit_sha,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  db.transaction(() => {
    insertRequest.run(
      input.requestId,
      input.requestSummary,
      'new',
      input.actorType,
      input.actorId,
      createdAt,
      createdAt,
    )
    insertWorkItem.run(
      input.workItemId,
      input.requestId,
      input.parentWorkItemId ?? null,
      input.title,
      input.status,
      input.specPath ?? null,
      input.specCommitSha ?? null,
      createdAt,
      createdAt,
    )
  })()

  return readWorkItemSummary({ db, workItemId: input.workItemId })
}

const updateWorkItem = ({
  db,
  input,
}: {
  db: Database
  input: Extract<KanbanCliInput, { mode: typeof KANBAN_MODES.updateWorkItem }>
}) => {
  const updates: string[] = []
  const values: Array<string | null> = []

  if (input.parentWorkItemId !== undefined) {
    updates.push('parent_work_item_id = ?')
    values.push(input.parentWorkItemId)
  }
  if (input.title !== undefined) {
    updates.push('title = ?')
    values.push(input.title)
  }
  if (input.status !== undefined) {
    updates.push('status = ?')
    values.push(input.status)
  }
  if (input.specPath !== undefined) {
    updates.push('spec_path = ?')
    values.push(input.specPath)
  }
  if (input.specCommitSha !== undefined) {
    updates.push('spec_commit_sha = ?')
    values.push(input.specCommitSha)
  }

  updates.push('updated_at = ?')
  values.push(input.updatedAt ?? nowIso(), input.workItemId)

  db.query(`UPDATE work_items SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  return readWorkItemSummary({ db, workItemId: input.workItemId })
}

const addDependency = ({
  db,
  input,
}: {
  db: Database
  input: Extract<KanbanCliInput, { mode: typeof KANBAN_MODES.addDependency }>
}) => {
  db.query(
    `INSERT INTO work_item_dependencies (
      work_item_id,
      depends_on_work_item_id,
      created_at
    ) VALUES (?, ?, ?)`,
  ).run(input.workItemId, input.dependsOnWorkItemId, input.createdAt ?? nowIso())

  return {
    workItemId: input.workItemId,
    dependsOnWorkItemId: input.dependsOnWorkItemId,
  }
}

const recordDiscovery = ({
  db,
  input,
}: {
  db: Database
  input: Extract<KanbanCliInput, { mode: typeof KANBAN_MODES.recordDiscovery }>
}) => {
  const createdAt = nowIso()
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
    input.discoveryId,
    input.workItemId,
    input.artifactVersion,
    JSON.stringify(input.rules),
    JSON.stringify(input.examples),
    JSON.stringify(input.openQuestions),
    JSON.stringify(input.outOfScope),
    input.collectedAt,
    input.staleAfterAt,
    createdAt,
    createdAt,
  )

  return {
    id: input.discoveryId,
    workItemId: input.workItemId,
    artifactVersion: input.artifactVersion,
  }
}

const buildDecisionDetails = ({ db, decisions }: { db: Database; decisions: DecisionRow[] }): ProjectionDecision[] => {
  const decisionIds = decisions.map((decision) => decision.id)
  const evidenceRefsByDecisionId = new Map<string, ProjectionDecision['evidenceRefs']>()

  if (decisionIds.length > 0) {
    const placeholders = decisionIds.map(() => '?').join(', ')
    const evidenceRefRows = db
      .query<DecisionEvidenceRefRow, [...string[]]>(
        `SELECT decision_id, context_db_path, evidence_cache_row_id
         FROM decision_evidence_cache_refs
         WHERE decision_id IN (${placeholders})
         ORDER BY decision_id ASC, context_db_path ASC, evidence_cache_row_id ASC`,
      )
      .all(...decisionIds)

    for (const row of evidenceRefRows) {
      const existing = evidenceRefsByDecisionId.get(row.decision_id) ?? []
      existing.push({
        contextDbPath: row.context_db_path,
        evidenceCacheRowId: row.evidence_cache_row_id,
      })
      evidenceRefsByDecisionId.set(row.decision_id, existing)
    }
  }

  return decisions.map((decision) => ({
    id: decision.id,
    workItemId: decision.work_item_id,
    decisionKind: decision.decision_kind,
    decision: decision.decision,
    actorType: decision.actor_type,
    actorId: decision.actor_id,
    reason: decision.reason,
    decidedAt: decision.decided_at,
    evidenceRefs: evidenceRefsByDecisionId.get(decision.id) ?? [],
  }))
}

const recordDecision = ({
  db,
  input,
}: {
  db: Database
  input: Extract<KanbanCliInput, { mode: typeof KANBAN_MODES.recordDecision }>
}): ProjectionDecision => {
  const decidedAt = input.decidedAt ?? nowIso()
  const insertDecision = db.query(
    `INSERT INTO decisions (
      id,
      work_item_id,
      decision_kind,
      decision,
      actor_type,
      actor_id,
      reason,
      decided_at,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertEvidenceRef = db.query(
    `INSERT INTO decision_evidence_cache_refs (
      decision_id,
      context_db_path,
      evidence_cache_row_id
    ) VALUES (?, ?, ?)`,
  )

  db.transaction(() => {
    insertDecision.run(
      input.decisionId,
      input.workItemId,
      input.decisionKind,
      input.decision,
      input.actorType,
      input.actorId,
      input.reason,
      decidedAt,
      nowIso(),
    )

    for (const evidenceRef of input.evidenceRefs) {
      insertEvidenceRef.run(input.decisionId, evidenceRef.contextDbPath, evidenceRef.evidenceCacheRowId)
    }
  })()

  const decision = db
    .query<DecisionRow, [string]>(
      `SELECT id, work_item_id, decision_kind, decision, actor_type, actor_id, reason, decided_at, created_at
       FROM decisions
       WHERE id = ?`,
    )
    .get(input.decisionId)

  if (!decision) {
    throw new Error(`Decision does not exist after insert: ${input.decisionId}`)
  }

  return buildDecisionDetails({ db, decisions: [decision] })[0]!
}

const recordEvent = ({
  db,
  input,
}: {
  db: Database
  input: Extract<KanbanCliInput, { mode: typeof KANBAN_MODES.recordEvent }>
}) => {
  const eventId = input.eventId ?? crypto.randomUUID()
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
    eventId,
    input.workItemId,
    input.eventKind,
    JSON.stringify(input.payload),
    input.occurredAt ?? nowIso(),
    nowIso(),
  )

  return {
    id: eventId,
    workItemId: input.workItemId,
    eventKind: input.eventKind,
  }
}

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

const loadLatestDiscoveryArtifact = ({ db, workItemId }: { db: Database; workItemId: string }) => {
  const row =
    db
      .query<DiscoveryArtifactRow, [string]>(
        `SELECT id, artifact_version, rules, examples, open_questions, out_of_scope, collected_at, stale_after_at
         FROM discovery_artifacts
         WHERE work_item_id = ?
         ORDER BY updated_at DESC, collected_at DESC, artifact_version DESC
         LIMIT 1`,
      )
      .get(workItemId) ?? null

  if (!row) {
    return null
  }

  return {
    id: row.id,
    artifactVersion: row.artifact_version,
    rules: JSON.parse(row.rules),
    examples: JSON.parse(row.examples),
    openQuestions: JSON.parse(row.open_questions),
    outOfScope: JSON.parse(row.out_of_scope),
    collectedAt: row.collected_at,
    staleAfterAt: row.stale_after_at,
  }
}

const loadDecisionRows = ({
  db,
  workItemId,
  limit,
}: {
  db: Database
  workItemId: string
  limit: number
}): DecisionRow[] =>
  db
    .query<DecisionRow, [string, number]>(
      `SELECT id, work_item_id, decision_kind, decision, actor_type, actor_id, reason, decided_at, created_at
       FROM decisions
       WHERE work_item_id = ?
       ORDER BY decided_at DESC, created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(workItemId, limit)

const loadEventRows = ({ db, workItemId, limit }: { db: Database; workItemId: string; limit: number }): EventRow[] =>
  db
    .query<EventRow, [string, number]>(
      `SELECT id, event_kind, payload_json, occurred_at
       FROM work_item_events
       WHERE work_item_id = ?
       ORDER BY occurred_at DESC, created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(workItemId, limit)

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
              parent_work_item_id,
              title,
              status,
              spec_path,
              spec_commit_sha
       FROM work_items
       WHERE id = ?`,
    )
    .get(workItemId)

  if (!workItem) {
    throw new Error(`Work item does not exist: ${workItemId}`)
  }

  const dependencies = loadDependencies({ db, workItemId }).map((dependency) => ({
    id: dependency.id,
    title: dependency.title,
    status: dependency.status,
    isResolved: dependency.status === WORK_ITEM_LIFECYCLE_STATES.cleaned,
  }))

  return {
    ok: true,
    mode: KANBAN_MODES.item,
    dbPath,
    item: {
      id: workItem.id,
      requestId: workItem.request_id,
      parentWorkItemId: workItem.parent_work_item_id,
      title: workItem.title,
      status: workItem.status,
      specPath: workItem.spec_path,
      specCommitSha: workItem.spec_commit_sha,
      dependencies,
      latestDiscovery: loadLatestDiscoveryArtifact({ db, workItemId }),
      latestDecisions: buildDecisionDetails({
        db,
        decisions: loadDecisionRows({ db, workItemId, limit: 20 }),
      }),
      events: loadEventRows({ db, workItemId, limit: 20 }).map((event) => ({
        id: event.id,
        eventKind: event.event_kind,
        payload: JSON.parse(event.payload_json),
        occurredAt: event.occurred_at,
      })),
    },
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
    .all(WORK_ITEM_LIFECYCLE_STATES.cleaned)

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

  return {
    ok: true,
    mode: KANBAN_MODES.board,
    dbPath,
    states,
    blockers,
  }
}

const loadReadyQueueProjection = ({ db, dbPath }: { db: Database; dbPath: string }): KanbanCliOutput => {
  const readyStatusSet = new Set<string>(KANBAN_READY_STATUS_VALUES)
  const readyItems = db
    .query<ProjectionWorkItemRow, []>(
      `SELECT id, title, status
       FROM work_items
       ORDER BY created_at ASC, id ASC`,
    )
    .all()
    .filter((workItem) => readyStatusSet.has(workItem.status))
    .map((workItem) => ({
      workItemId: workItem.id,
      title: workItem.title,
      status: workItem.status,
    }))

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
          .query<DecisionRow, [number]>(
            `SELECT id, work_item_id, decision_kind, decision, actor_type, actor_id, reason, decided_at, created_at
             FROM decisions
             ORDER BY decided_at DESC, created_at DESC, id DESC
             LIMIT ?`,
          )
          .all(limit)
      : loadDecisionRows({ db, workItemId, limit })

  return {
    ok: true,
    mode: KANBAN_MODES.decisionAudit,
    dbPath,
    decisions: buildDecisionDetails({ db, decisions }),
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
        return loadReadyQueueProjection({ db, dbPath })
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
    closeKanbanDatabase(db)
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
      case KANBAN_MODES.createWorkItem:
        return {
          ok: true,
          mode: KANBAN_MODES.createWorkItem,
          dbPath,
          workItem: createWorkItem({ db, input }),
        }
      case KANBAN_MODES.updateWorkItem:
        return {
          ok: true,
          mode: KANBAN_MODES.updateWorkItem,
          dbPath,
          workItem: updateWorkItem({ db, input }),
        }
      case KANBAN_MODES.addDependency:
        return {
          ok: true,
          mode: KANBAN_MODES.addDependency,
          dbPath,
          dependency: addDependency({ db, input }),
        }
      case KANBAN_MODES.recordDiscovery:
        return {
          ok: true,
          mode: KANBAN_MODES.recordDiscovery,
          dbPath,
          discovery: recordDiscovery({ db, input }),
        }
      case KANBAN_MODES.recordDecision:
        return {
          ok: true,
          mode: KANBAN_MODES.recordDecision,
          dbPath,
          decision: recordDecision({ db, input }),
        }
      case KANBAN_MODES.recordEvent:
        return {
          ok: true,
          mode: KANBAN_MODES.recordEvent,
          dbPath,
          event: recordEvent({ db, input }),
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

/**
 * CLI adapter for the durable kanban ledger command.
 */
export const kanbanCli = makeCli({
  name: KANBAN_COMMAND,
  inputSchema: KanbanCliInputSchema,
  outputSchema: KanbanCliOutputSchema,
  run: runKanbanCommand,
})
