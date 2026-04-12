import { describe, expect, test } from 'bun:test'
import { bSync, bThread } from 'plaited/behavioral'
import * as z from 'zod'
import { exploreFrontiers } from '../behavioral.frontier.ts'

const onType = (type: string) => ({
  type,
  sourceSchema: z.enum(['trigger', 'request', 'emit']),
  detailSchema: z.unknown(),
})

const createDeadlockReachableThreads = () => ({
  chooseA: bThread([bSync({ request: { type: 'A' } })]),
  chooseB: bThread([bSync({ request: { type: 'B' } })]),
  deadlockAfterA: bThread([bSync({ waitFor: onType('A') }), bSync({ block: onType('B') })]),
})

describe('exploreFrontiers', () => {
  test('bfs and dfs both find a reachable deadlock and report metadata', () => {
    const bfsResult = exploreFrontiers({
      threads: createDeadlockReachableThreads(),
      strategy: 'bfs',
    })
    const dfsResult = exploreFrontiers({
      threads: createDeadlockReachableThreads(),
      strategy: 'dfs',
    })

    expect(bfsResult.findings).toContainEqual(
      expect.objectContaining({
        code: 'deadlock',
        history: [{ type: 'A', source: 'request' }],
        status: 'deadlock',
      }),
    )
    expect(dfsResult.findings).toContainEqual(
      expect.objectContaining({
        code: 'deadlock',
        history: [{ type: 'A', source: 'request' }],
        status: 'deadlock',
        enabled: [],
        summary: { candidateCount: 1, enabledCount: 0 },
      }),
    )
    expect(bfsResult.report.strategy).toBe('bfs')
    expect(dfsResult.report.strategy).toBe('dfs')
    expect(bfsResult.report.visitedCount).toBe(bfsResult.visitedHistories.length)
    expect(dfsResult.report.visitedCount).toBe(dfsResult.visitedHistories.length)
    expect(bfsResult.report.findingCount).toBe(bfsResult.findings.length)
    expect(dfsResult.report.findingCount).toBe(dfsResult.findings.length)
    expect(bfsResult.report.truncated).toBe(false)
    expect(dfsResult.report.truncated).toBe(false)
  })

  test('branches one successor per enabled event', () => {
    const result = exploreFrontiers({
      threads: {
        chooseA: bThread([bSync({ request: { type: 'A' } })]),
        chooseB: bThread([bSync({ request: { type: 'B' } })]),
      },
      strategy: 'bfs',
      maxDepth: 1,
    })

    expect(result.visitedHistories).toContainEqual([])
    expect(result.visitedHistories).toContainEqual([{ type: 'A', source: 'request' }])
    expect(result.visitedHistories).toContainEqual([{ type: 'B', source: 'request' }])
    expect(result.visitedHistories).toHaveLength(3)
    expect(result.report).toEqual({
      strategy: 'bfs',
      visitedCount: 3,
      findingCount: 0,
      truncated: true,
      maxDepth: 1,
    })
  })

  test('maxDepth marks truncated when a ready branch is cut off', () => {
    const result = exploreFrontiers({
      threads: createDeadlockReachableThreads(),
      strategy: 'bfs',
      maxDepth: 0,
    })

    expect(result.visitedHistories).toEqual([[]])
    expect(result.findings).toEqual([])
    expect(result.report).toEqual({
      strategy: 'bfs',
      visitedCount: 1,
      findingCount: 0,
      truncated: true,
      maxDepth: 0,
    })
  })

  test('maxDepth does not mark truncated for naturally terminal deadlock exploration', () => {
    const result = exploreFrontiers({
      threads: {
        blockedA: bThread([bSync({ request: { type: 'A' }, block: onType('A') })]),
      },
      strategy: 'bfs',
      maxDepth: 0,
    })

    expect(result.visitedHistories).toEqual([[]])
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]).toEqual(
      expect.objectContaining({
        code: 'deadlock',
        history: [],
        status: 'deadlock',
        candidates: [
          expect.objectContaining({
            priority: 1,
            type: 'A',
            source: 'request',
          }),
        ],
        enabled: [],
        summary: { candidateCount: 1, enabledCount: 0 },
      }),
    )
    expect(result.findings[0]!.candidates[0]!.thread.startsWith('bt_')).toBe(true)
    expect(result.report).toEqual({
      strategy: 'bfs',
      visitedCount: 1,
      findingCount: 1,
      truncated: false,
      maxDepth: 0,
    })
  })

  test('deadlock findings include reconstructed frontier data', () => {
    const result = exploreFrontiers({
      threads: createDeadlockReachableThreads(),
      strategy: 'bfs',
    })

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: 'deadlock',
        history: [{ type: 'A', source: 'request' }],
        status: 'deadlock',
        candidates: [expect.objectContaining({ priority: 2, type: 'B', source: 'request' })],
        enabled: [],
        summary: { candidateCount: 1, enabledCount: 0 },
      }),
    )
  })

  test('idle branches terminate without findings', () => {
    const result = exploreFrontiers({
      threads: {
        watcher: bThread([bSync({ waitFor: onType('ping') })]),
      },
      strategy: 'dfs',
      includeFrontierSummaries: true,
    })

    expect(result.visitedHistories).toEqual([[]])
    expect(result.findings).toEqual([])
    expect(result.frontierSummaries).toEqual([{ history: [], status: 'idle' }])
    expect(result.report).toEqual({
      strategy: 'dfs',
      visitedCount: 1,
      findingCount: 0,
      truncated: false,
    })
  })
})
