import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { KANBAN_COMMAND, KANBAN_MODES, WORK_ITEM_LIFECYCLE_STATES } from '../kanban.constants.ts'

const CLI_PACKAGE_ROOT = resolve(import.meta.dir, '../../../')

const tempPaths: string[] = []

const trackTempPath = (path: string): string => {
  tempPaths.push(path)
  return path
}

const runKanbanCommand = async (input: unknown) =>
  Bun.$`bun ./bin/plaited.ts kanban ${JSON.stringify(input)}`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()

const runRawKanbanCommand = async (rawInput: string) =>
  Bun.$`bun ./bin/plaited.ts kanban ${rawInput}`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()

const parseOutput = <T>(result: Awaited<ReturnType<typeof runKanbanCommand>>): T => {
  expect(result.exitCode).toBe(0)
  return JSON.parse(result.stdout.toString().trim()) as T
}

const makeDbPath = async (): Promise<string> => {
  const tempDir = trackTempPath(await mkdtemp(join(tmpdir(), 'plaited-kanban-cli-')))
  return join(tempDir, 'kanban.sqlite')
}

const createWorkItem = async ({
  dbPath,
  workItemId,
  title,
  status,
  createdAt,
}: {
  dbPath: string
  workItemId: string
  title: string
  status: (typeof WORK_ITEM_LIFECYCLE_STATES)[keyof typeof WORK_ITEM_LIFECYCLE_STATES]
  createdAt: string
}) =>
  runKanbanCommand({
    mode: KANBAN_MODES.createWorkItem,
    dbPath,
    requestId: 'req-ledger-1',
    requestSummary: 'simplify kanban ledger',
    workItemId,
    title,
    actorType: 'agent',
    actorId: 'analyst',
    status,
    createdAt,
  })

afterEach(async () => {
  while (tempPaths.length > 0) {
    const path = tempPaths.pop()
    if (path) {
      await rm(path, { recursive: true, force: true })
    }
  }
})

describe('kanban CLI', () => {
  test('schema exposes simplified ledger modes and omits old policy surfaces', async () => {
    const manifestResult = await Bun.$`bun ./bin/plaited.ts --schema`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()

    expect(manifestResult.exitCode).toBe(0)
    const manifest = JSON.parse(manifestResult.stdout.toString().trim()) as { commands: string[] }
    expect(manifest.commands).toContain(KANBAN_COMMAND)

    const inputSchemaResult = await Bun.$`bun ./bin/plaited.ts kanban --schema input`
      .cwd(CLI_PACKAGE_ROOT)
      .quiet()
      .nothrow()

    expect(inputSchemaResult.exitCode).toBe(0)
    const inputSchema = JSON.parse(inputSchemaResult.stdout.toString().trim()) as {
      description?: string
      oneOf?: Array<{ properties?: { mode?: { const?: string } } }>
      anyOf?: Array<{ properties?: { mode?: { const?: string } } }>
    }
    expect(inputSchema.description).toContain('durable ledger CLI')

    const branches = inputSchema.oneOf ?? inputSchema.anyOf ?? []
    const modes = branches.map((branch) => branch.properties?.mode?.const).filter((value) => value !== undefined)
    expect(modes).toEqual([
      KANBAN_MODES.board,
      KANBAN_MODES.item,
      KANBAN_MODES.readyQueue,
      KANBAN_MODES.decisionAudit,
      KANBAN_MODES.initDb,
      KANBAN_MODES.createWorkItem,
      KANBAN_MODES.updateWorkItem,
      KANBAN_MODES.addDependency,
      KANBAN_MODES.recordDiscovery,
      KANBAN_MODES.recordDecision,
      KANBAN_MODES.recordEvent,
    ])

    const schemaText = JSON.stringify(inputSchema)
    expect(schemaText.includes('record-red-approval')).toBeFalse()
    expect(schemaText.includes('revoke-stale-red-approval')).toBeFalse()
    expect(schemaText.includes('record-escalation')).toBeFalse()
    expect(schemaText.includes('frontier')).toBeFalse()
    expect(schemaText.includes('merge_simulation')).toBeFalse()
    expect(schemaText.includes('worktree')).toBeFalse()
  })

  test('create-work-item mode records a request-backed work item through the CLI boundary', async () => {
    const dbPath = await makeDbPath()

    const output = parseOutput<{ mode: string; workItem: { id: string; status: string } }>(
      await runKanbanCommand({
        mode: KANBAN_MODES.createWorkItem,
        dbPath,
        requestId: 'req-ledger-1',
        requestSummary: 'simplify kanban ledger',
        workItemId: 'item-ledger-1',
        title: 'Create generic kanban writes',
        actorType: 'agent',
        actorId: 'analyst',
        status: WORK_ITEM_LIFECYCLE_STATES.formulated,
        createdAt: '2026-05-05T00:00:00.000Z',
      }),
    )

    expect(output.mode).toBe(KANBAN_MODES.createWorkItem)
    expect(output.workItem).toEqual({ id: 'item-ledger-1', status: WORK_ITEM_LIFECYCLE_STATES.formulated })
  })

  test('generic ledger writes are projected by board, item, ready-queue, and decision-audit modes', async () => {
    const dbPath = await makeDbPath()

    parseOutput(
      await createWorkItem({
        dbPath,
        workItemId: 'dep-cleaned',
        title: 'Completed dependency',
        status: WORK_ITEM_LIFECYCLE_STATES.cleaned,
        createdAt: '2026-05-05T00:00:00.000Z',
      }),
    )
    parseOutput(
      await createWorkItem({
        dbPath,
        workItemId: 'dep-active',
        title: 'Active dependency',
        status: WORK_ITEM_LIFECYCLE_STATES.green_pending,
        createdAt: '2026-05-05T00:00:01.000Z',
      }),
    )
    parseOutput(
      await createWorkItem({
        dbPath,
        workItemId: 'item-ledger',
        title: 'Generic ledger item',
        status: WORK_ITEM_LIFECYCLE_STATES.formulated,
        createdAt: '2026-05-05T00:00:02.000Z',
      }),
    )
    parseOutput(
      await createWorkItem({
        dbPath,
        workItemId: 'item-with-blocker',
        title: 'Item with unresolved dependency',
        status: WORK_ITEM_LIFECYCLE_STATES.red_approved,
        createdAt: '2026-05-05T00:00:03.000Z',
      }),
    )
    parseOutput(
      await createWorkItem({
        dbPath,
        workItemId: 'blocked-status',
        title: 'Blocked status item',
        status: WORK_ITEM_LIFECYCLE_STATES.blocked,
        createdAt: '2026-05-05T00:00:04.000Z',
      }),
    )
    parseOutput(
      await createWorkItem({
        dbPath,
        workItemId: 'review-no-merge',
        title: 'Review item without merge policy facts',
        status: WORK_ITEM_LIFECYCLE_STATES.review_pending,
        createdAt: '2026-05-05T00:00:05.000Z',
      }),
    )

    parseOutput(
      await runKanbanCommand({
        mode: KANBAN_MODES.updateWorkItem,
        dbPath,
        workItemId: 'item-ledger',
        status: WORK_ITEM_LIFECYCLE_STATES.review_pending,
        specPath: 'specs/item-ledger.json',
        specCommitSha: 'sha-item-ledger',
        updatedAt: '2026-05-05T00:10:00.000Z',
      }),
    )
    parseOutput(
      await runKanbanCommand({
        mode: KANBAN_MODES.addDependency,
        dbPath,
        workItemId: 'item-ledger',
        dependsOnWorkItemId: 'dep-cleaned',
        createdAt: '2026-05-05T00:11:00.000Z',
      }),
    )
    parseOutput(
      await runKanbanCommand({
        mode: KANBAN_MODES.addDependency,
        dbPath,
        workItemId: 'item-with-blocker',
        dependsOnWorkItemId: 'dep-active',
        createdAt: '2026-05-05T00:12:00.000Z',
      }),
    )
    parseOutput(
      await runKanbanCommand({
        mode: KANBAN_MODES.recordDiscovery,
        dbPath,
        discoveryId: 'disc-item-ledger-1',
        workItemId: 'item-ledger',
        artifactVersion: 1,
        rules: [{ id: 'rule-1', text: 'record facts only' }],
        examples: [{ id: 'example-1', text: 'generic writes' }],
        openQuestions: [],
        outOfScope: [{ id: 'scope-1', text: 'workflow policy' }],
        collectedAt: '2026-05-05T00:13:00.000Z',
        staleAfterAt: '2026-05-06T00:13:00.000Z',
      }),
    )
    parseOutput(
      await runKanbanCommand({
        mode: KANBAN_MODES.recordDecision,
        dbPath,
        decisionId: 'decision-ledger-1',
        workItemId: 'item-ledger',
        decisionKind: 'analyst_handoff',
        decision: 'approved',
        actorType: 'agent',
        actorId: 'analyst',
        reason: 'facts are ready for the next actor',
        evidenceRefs: [{ contextDbPath: '.plaited/context.sqlite', evidenceCacheRowId: 7 }],
        decidedAt: '2026-05-05T00:14:00.000Z',
      }),
    )
    parseOutput(
      await runKanbanCommand({
        mode: KANBAN_MODES.recordEvent,
        dbPath,
        eventId: 'event-ledger-1',
        workItemId: 'item-ledger',
        eventKind: 'status_observed',
        payload: { source: 'test' },
        occurredAt: '2026-05-05T00:15:00.000Z',
      }),
    )

    const board = parseOutput<{
      states: Array<{ state: string; total: number; items: Array<{ id: string; unresolvedDependencyCount: number }> }>
      blockers: Array<{ workItemId: string; unresolvedDependencies: Array<{ id: string; status: string }> }>
    }>(await runKanbanCommand({ mode: KANBAN_MODES.board, dbPath }))
    expect(board.states).toContainEqual({
      state: WORK_ITEM_LIFECYCLE_STATES.review_pending,
      items: [
        { id: 'item-ledger', unresolvedDependencyCount: 0 },
        { id: 'review-no-merge', unresolvedDependencyCount: 0 },
      ],
      total: 2,
    })
    expect(board.blockers).toEqual([
      {
        workItemId: 'item-with-blocker',
        unresolvedDependencies: [{ id: 'dep-active', status: WORK_ITEM_LIFECYCLE_STATES.green_pending }],
      },
    ])

    const item = parseOutput<{
      item: Record<string, unknown> & {
        dependencies: Array<{ id: string; title: string; status: string; isResolved: boolean }>
        latestDiscovery: { id: string; openQuestions: unknown[] }
        latestDecisions: Array<{ decisionKind: string; evidenceRefs: Array<{ evidenceCacheRowId: number }> }>
        events: Array<{ id: string; eventKind: string; payload: { source: string }; occurredAt: string }>
      }
    }>(await runKanbanCommand({ mode: KANBAN_MODES.item, dbPath, workItemId: 'item-ledger' }))
    expect(item.item.dependencies).toEqual([
      {
        id: 'dep-cleaned',
        title: 'Completed dependency',
        status: WORK_ITEM_LIFECYCLE_STATES.cleaned,
        isResolved: true,
      },
    ])
    expect(item.item.latestDiscovery.id).toBe('disc-item-ledger-1')
    expect(item.item.latestDiscovery.openQuestions).toEqual([])
    expect(item.item.latestDecisions[0]).toMatchObject({
      decisionKind: 'analyst_handoff',
      evidenceRefs: [{ contextDbPath: '.plaited/context.sqlite', evidenceCacheRowId: 7 }],
    })
    expect(item.item.events).toEqual([
      {
        id: 'event-ledger-1',
        eventKind: 'status_observed',
        payload: { source: 'test' },
        occurredAt: '2026-05-05T00:15:00.000Z',
      },
    ])
    expect('guards' in item.item).toBeFalse()
    expect('execution' in item.item).toBeFalse()
    expect('cleanup' in item.item).toBeFalse()
    expect('gateStatus' in item.item).toBeFalse()

    const readyQueue = parseOutput<{ readyItems: Array<Record<string, unknown> & { workItemId: string }> }>(
      await runKanbanCommand({ mode: KANBAN_MODES.readyQueue, dbPath }),
    )
    expect(readyQueue.readyItems.map((readyItem) => readyItem.workItemId)).toEqual([
      'dep-active',
      'item-ledger',
      'item-with-blocker',
      'review-no-merge',
    ])
    expect(readyQueue.readyItems.some((readyItem) => 'nextEvent' in readyItem)).toBeFalse()

    const audit = parseOutput<{
      decisions: Array<{
        id: string
        workItemId: string
        decisionKind: string
        decision: string
        actorType: string
        actorId: string
        reason: string
        decidedAt: string
        evidenceRefs: Array<{ contextDbPath: string; evidenceCacheRowId: number }>
      }>
    }>(await runKanbanCommand({ mode: KANBAN_MODES.decisionAudit, dbPath, workItemId: 'item-ledger', limit: 10 }))
    expect(audit.decisions).toEqual([
      {
        id: 'decision-ledger-1',
        workItemId: 'item-ledger',
        decisionKind: 'analyst_handoff',
        decision: 'approved',
        actorType: 'agent',
        actorId: 'analyst',
        reason: 'facts are ready for the next actor',
        decidedAt: '2026-05-05T00:14:00.000Z',
        evidenceRefs: [{ contextDbPath: '.plaited/context.sqlite', evidenceCacheRowId: 7 }],
      },
    ])
  })

  test('create-work-item preserves existing request metadata when adding another item', async () => {
    const dbPath = await makeDbPath()

    parseOutput(
      await runKanbanCommand({
        mode: KANBAN_MODES.createWorkItem,
        dbPath,
        requestId: 'req-preserve',
        requestSummary: 'original request summary',
        workItemId: 'item-one',
        title: 'First item',
        actorType: 'agent',
        actorId: 'analyst',
        createdAt: '2026-05-05T00:00:00.000Z',
      }),
    )
    parseOutput(
      await runKanbanCommand({
        mode: KANBAN_MODES.createWorkItem,
        dbPath,
        requestId: 'req-preserve',
        requestSummary: 'different summary that should not overwrite',
        workItemId: 'item-two',
        title: 'Second item',
        actorType: 'agent',
        actorId: 'coder',
        createdAt: '2026-05-05T00:01:00.000Z',
      }),
    )

    const db = new Database(dbPath)
    try {
      const request = db
        .query<{ summary: string; requested_by_actor_id: string; updated_at: string }, [string]>(
          `SELECT summary, requested_by_actor_id, updated_at
           FROM requests
           WHERE id = ?`,
        )
        .get('req-preserve')
      expect(request).toEqual({
        summary: 'original request summary',
        requested_by_actor_id: 'analyst',
        updated_at: '2026-05-05T00:00:00.000Z',
      })
    } finally {
      db.close(false)
    }
  })

  test('init-db fails loudly when an existing database has the old policy-heavy schema', async () => {
    const dbPath = await makeDbPath()
    const db = new Database(dbPath, { create: true })
    try {
      db.run(`
        CREATE TABLE kanban_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
        INSERT INTO kanban_migrations (version, applied_at) VALUES (1, '2026-05-05T00:00:00.000Z');
        CREATE TABLE gate_decisions (id TEXT PRIMARY KEY);
      `)
    } finally {
      db.close(false)
    }

    const result = await runKanbanCommand({
      mode: KANBAN_MODES.initDb,
      dbPath,
    })

    expect(result.exitCode).toBe(1)
    expect(result.stderr.toString()).toContain('unsupported kanban schema')
    expect(result.stderr.toString()).toContain('gate_decisions')
  })

  test('write modes surface schema, missing-row, foreign-key, and duplicate-id failures', async () => {
    const dbPath = await makeDbPath()

    const invalidJsonResult = await runRawKanbanCommand('{')
    expect(invalidJsonResult.exitCode).toBe(2)
    expect(invalidJsonResult.stderr.toString()).toContain('Invalid JSON input')

    const invalidSchemaResult = await runKanbanCommand({
      mode: KANBAN_MODES.createWorkItem,
      dbPath,
      requestId: 'req-invalid',
      requestSummary: 'invalid status',
      workItemId: 'item-invalid',
      title: 'Invalid status item',
      actorType: 'agent',
      actorId: 'analyst',
      status: 'not_a_status',
    })
    expect(invalidSchemaResult.exitCode).toBe(2)
    expect(invalidSchemaResult.stderr.toString()).toContain('"status"')

    const missingUpdateResult = await runKanbanCommand({
      mode: KANBAN_MODES.updateWorkItem,
      dbPath,
      workItemId: 'missing-item',
      status: WORK_ITEM_LIFECYCLE_STATES.review_pending,
    })
    expect(missingUpdateResult.exitCode).toBe(1)
    expect(missingUpdateResult.stderr.toString()).toContain('Work item does not exist: missing-item')

    parseOutput(
      await createWorkItem({
        dbPath,
        workItemId: 'item-failure-base',
        title: 'Failure base item',
        status: WORK_ITEM_LIFECYCLE_STATES.formulated,
        createdAt: '2026-05-05T00:00:00.000Z',
      }),
    )
    parseOutput(
      await createWorkItem({
        dbPath,
        workItemId: 'item-failure-dep',
        title: 'Failure dependency item',
        status: WORK_ITEM_LIFECYCLE_STATES.cleaned,
        createdAt: '2026-05-05T00:00:01.000Z',
      }),
    )

    const missingDependencyResult = await runKanbanCommand({
      mode: KANBAN_MODES.addDependency,
      dbPath,
      workItemId: 'item-failure-base',
      dependsOnWorkItemId: 'missing-dependency',
    })
    expect(missingDependencyResult.exitCode).toBe(1)
    expect(missingDependencyResult.stderr.toString()).toContain('FOREIGN KEY constraint failed')

    parseOutput(
      await runKanbanCommand({
        mode: KANBAN_MODES.addDependency,
        dbPath,
        workItemId: 'item-failure-base',
        dependsOnWorkItemId: 'item-failure-dep',
      }),
    )
    const duplicateDependencyResult = await runKanbanCommand({
      mode: KANBAN_MODES.addDependency,
      dbPath,
      workItemId: 'item-failure-base',
      dependsOnWorkItemId: 'item-failure-dep',
    })
    expect(duplicateDependencyResult.exitCode).toBe(1)
    expect(duplicateDependencyResult.stderr.toString()).toContain('UNIQUE constraint failed')

    const decisionInput = {
      mode: KANBAN_MODES.recordDecision,
      dbPath,
      decisionId: 'decision-duplicate',
      workItemId: 'item-failure-base',
      decisionKind: 'manual_check',
      decision: 'approved',
      actorType: 'agent',
      actorId: 'analyst',
      reason: 'first decision wins',
      evidenceRefs: [],
    }
    parseOutput(await runKanbanCommand(decisionInput))
    const duplicateDecisionResult = await runKanbanCommand(decisionInput)
    expect(duplicateDecisionResult.exitCode).toBe(1)
    expect(duplicateDecisionResult.stderr.toString()).toContain('UNIQUE constraint failed')

    const eventInput = {
      mode: KANBAN_MODES.recordEvent,
      dbPath,
      eventId: 'event-duplicate',
      workItemId: 'item-failure-base',
      eventKind: 'manual_event',
      payload: {},
    }
    parseOutput(await runKanbanCommand(eventInput))
    const duplicateEventResult = await runKanbanCommand(eventInput)
    expect(duplicateEventResult.exitCode).toBe(1)
    expect(duplicateEventResult.stderr.toString()).toContain('UNIQUE constraint failed')
  })
})
