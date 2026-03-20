import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

import { behavioral } from '../../behavioral/behavioral.ts'
import { createBehavioralActorRuntime, createManagedTeamRuntime, createTeamHub } from '../runtime.ts'

const TEMP_DIR = join(import.meta.dir, 'fixtures/team-hub-test')
const MEMORY_DIR = join(TEMP_DIR, '.memory')

beforeAll(async () => {
  await Bun.write(join(TEMP_DIR, '.gitkeep'), '')
})

afterAll(() => {
  rmSync(TEMP_DIR, { recursive: true, force: true })
})

describe('createTeamHub', () => {
  test('persists a local attempt DAG and exposes leaves, frontier, and lineage queries', async () => {
    const timestamps = [
      new Date('2026-03-19T12:00:00.000Z'),
      new Date('2026-03-19T12:01:00.000Z'),
      new Date('2026-03-19T12:02:00.000Z'),
      new Date('2026-03-19T12:03:00.000Z'),
    ]
    const hub = createTeamHub({
      teamId: 'team-runtime',
      memoryPath: MEMORY_DIR,
      now: () => timestamps.shift() ?? new Date('2026-03-19T12:04:00.000Z'),
    })

    await hub.recordAttempt({
      id: 'attempt-1',
      teamId: 'team-runtime',
      worktreePath: '/tmp/team-runtime/attempt-1',
      branch: 'team-runtime/attempt-1',
      commit: '1111111',
      status: 'succeeded',
    })
    await hub.recordAttempt({
      id: 'attempt-2',
      teamId: 'team-runtime',
      parentAttemptId: 'attempt-1',
      worktreePath: '/tmp/team-runtime/attempt-2',
      branch: 'team-runtime/attempt-2',
      commit: '2222222',
      status: 'failed',
    })
    await hub.recordAttempt({
      id: 'attempt-3',
      teamId: 'team-runtime',
      parentAttemptId: 'attempt-1',
      worktreePath: '/tmp/team-runtime/attempt-3',
      branch: 'team-runtime/attempt-3',
      status: 'succeeded',
    })
    await hub.recordAttempt({
      id: 'attempt-4',
      teamId: 'team-runtime',
      parentAttemptId: 'attempt-2',
      worktreePath: '/tmp/team-runtime/attempt-4',
      branch: 'team-runtime/attempt-4',
      status: 'pending',
    })

    expect(hub.listAttempts().map((attempt) => attempt.id)).toEqual([
      'attempt-1',
      'attempt-2',
      'attempt-3',
      'attempt-4',
    ])
    expect(hub.getLeaves().map((attempt) => attempt.id)).toEqual(['attempt-3', 'attempt-4'])
    expect(hub.getFrontier().map((attempt) => attempt.id)).toEqual(['attempt-3', 'attempt-4'])
    expect(hub.getLineage('attempt-4').map((attempt) => attempt.id)).toEqual(['attempt-1', 'attempt-2', 'attempt-4'])
    expect(hub.listPromotionCandidates().map((candidate) => candidate.attemptId)).toEqual(['attempt-3'])
    expect(hub.getPromotionCandidate('attempt-3')).toMatchObject({
      attemptId: 'attempt-3',
      isLeaf: true,
      depth: 1,
      succeededDescendantIds: [],
    })

    const graph = JSON.parse(await Bun.file(join(MEMORY_DIR, 'teams', 'team-runtime', 'graph.json')).text())
    expect(graph.teamId).toBe('team-runtime')
    expect(graph.attempts).toHaveLength(4)
    expect(await Bun.file(join(MEMORY_DIR, 'teams', 'team-runtime', 'attempts', 'attempt-4.json')).exists()).toBe(true)
  })

  test('lets PM persist an explicit winner selection over promotion candidates', async () => {
    const timestamps = [
      new Date('2026-03-19T12:10:00.000Z'),
      new Date('2026-03-19T12:11:00.000Z'),
      new Date('2026-03-19T12:12:00.000Z'),
      new Date('2026-03-19T12:13:00.000Z'),
    ]
    const hub = createTeamHub({
      teamId: 'team-selection',
      memoryPath: MEMORY_DIR,
      now: () => timestamps.shift() ?? new Date('2026-03-19T12:14:00.000Z'),
    })

    await hub.recordAttempt({
      id: 'attempt-root',
      teamId: 'team-selection',
      worktreePath: '/tmp/team-selection/root',
      branch: 'team-selection/root',
      commit: 'aaaaaaa',
      status: 'succeeded',
      metadata: { score: 0.4 },
    })
    await hub.recordAttempt({
      id: 'attempt-child-failed',
      teamId: 'team-selection',
      parentAttemptId: 'attempt-root',
      worktreePath: '/tmp/team-selection/child-failed',
      branch: 'team-selection/child-failed',
      status: 'failed',
      metadata: { score: 0.2 },
    })
    await hub.recordAttempt({
      id: 'attempt-child-winning',
      teamId: 'team-selection',
      parentAttemptId: 'attempt-root',
      worktreePath: '/tmp/team-selection/child-winning',
      branch: 'team-selection/child-winning',
      commit: 'bbbbbbb',
      status: 'succeeded',
      metadata: { score: 0.9, hypothesis: 'best' },
    })

    expect(hub.listPromotionCandidates().map((candidate) => candidate.attemptId)).toEqual(['attempt-child-winning'])
    expect(hub.getPromotionCandidate('attempt-child-winning')).toMatchObject({
      attemptId: 'attempt-child-winning',
      lineage: [{ id: 'attempt-root' }, { id: 'attempt-child-winning' }],
      attempt: {
        metadata: {
          score: 0.9,
          hypothesis: 'best',
        },
      },
    })

    const selection = await hub.selectPromotionCandidate({
      pmId: 'pm-sovereign',
      selectedAttemptId: 'attempt-child-winning',
      rationale: 'Highest score among explicit succeeded branch heads.',
      metadata: {
        scoreDimension: 'quality',
      },
    })

    expect(selection).toMatchObject({
      teamId: 'team-selection',
      pmId: 'pm-sovereign',
      selectedAttemptId: 'attempt-child-winning',
      selectedLineageAttemptIds: ['attempt-root', 'attempt-child-winning'],
      candidateAttemptIds: ['attempt-child-winning'],
      rationale: 'Highest score among explicit succeeded branch heads.',
    })
    expect(hub.getLatestWinnerSelection()).toEqual(selection)
    expect(hub.listWinnerSelections()).toEqual([selection])

    const selectionHistory = JSON.parse(
      await Bun.file(join(MEMORY_DIR, 'teams', 'team-selection', 'winner-selections.json')).text(),
    )
    expect(selectionHistory.teamId).toBe('team-selection')
    expect(selectionHistory.selections).toHaveLength(1)
    expect(selectionHistory.selections[0]).toMatchObject({
      selectedAttemptId: 'attempt-child-winning',
      candidateAttemptIds: ['attempt-child-winning'],
    })
  })

  test('restores persisted attempts and keeps the hub attached to managed teams', async () => {
    const timestamps = [new Date('2026-03-19T13:00:00.000Z'), new Date('2026-03-19T13:01:00.000Z')]
    const initialHub = createTeamHub({
      teamId: 'team-managed',
      memoryPath: MEMORY_DIR,
      now: () => timestamps.shift() ?? new Date('2026-03-19T13:02:00.000Z'),
    })

    await initialHub.recordAttempt({
      id: 'attempt-root',
      teamId: 'team-managed',
      worktreePath: '/tmp/team-managed/root',
      commit: 'aaaaaaa',
      status: 'succeeded',
    })
    await initialHub.recordAttempt({
      id: 'attempt-child',
      teamId: 'team-managed',
      parentAttemptId: 'attempt-root',
      worktreePath: '/tmp/team-managed/child',
      status: 'succeeded',
      metadata: { score: 0.7 },
    })
    await initialHub.selectPromotionCandidate({
      pmId: 'pm:actor-managed',
      selectedAttemptId: 'attempt-child',
      rationale: 'Succeeded child supersedes the root attempt.',
    })

    const restoredHub = createTeamHub({
      teamId: 'team-managed',
      memoryPath: MEMORY_DIR,
    })
    const restored = await restoredHub.load()

    expect(restored.attempts.map((attempt) => attempt.id)).toEqual(['attempt-root', 'attempt-child'])
    expect(restoredHub.getFrontier().map((attempt) => attempt.id)).toEqual(['attempt-child'])
    expect(restoredHub.listPromotionCandidates().map((candidate) => candidate.attemptId)).toEqual(['attempt-child'])
    expect(restoredHub.getLatestWinnerSelection()).toMatchObject({
      pmId: 'pm:actor-managed',
      selectedAttemptId: 'attempt-child',
      selectedLineageAttemptIds: ['attempt-root', 'attempt-child'],
    })

    const runtime = behavioral<{ direct_task: { taskId: string } }>()
    const actor = createBehavioralActorRuntime<{ type: 'direct_task'; detail: { taskId: string } }>({
      kind: 'behavioral_actor',
      id: 'actor-managed',
      object: {
        kind: 'mss_object',
        id: 'object-managed',
        contentType: 'agent',
        structure: 'object',
        mechanics: ['track'],
        boundary: 'ask',
        scale: 'S2',
      },
      trigger: runtime.trigger,
      subscribe: runtime.useFeedback,
      destroy: () => {},
    })

    const managed = createManagedTeamRuntime({
      actor,
      teamId: 'team-managed',
      hub: restoredHub,
    })

    expect(managed.hub).toBe(restoredHub)
    expect(managed.team.hub).toBe(restoredHub)

    managed.destroy()
  })
})
