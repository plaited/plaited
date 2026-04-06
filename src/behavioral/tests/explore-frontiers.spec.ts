import { describe, expect, test } from 'bun:test'
import { bSyncReplaySafe, bThreadReplaySafe } from 'plaited/behavioral'
import { exploreFrontiers } from '../explore-frontiers.ts'

const createDeadlockReachableThreads = () => ({
  chooseA: bThreadReplaySafe([bSyncReplaySafe({ request: { type: 'A' } })]),
  chooseB: bThreadReplaySafe([bSyncReplaySafe({ request: { type: 'B' } })]),
  deadlockAfterA: bThreadReplaySafe([bSyncReplaySafe({ waitFor: 'A' }), bSyncReplaySafe({ block: 'B' })]),
})

describe('exploreFrontiers', () => {
  test('bfs and dfs both find a reachable deadlock', () => {
    const bfsResult = exploreFrontiers({
      threads: createDeadlockReachableThreads(),
      strategy: 'bfs',
    })
    const dfsResult = exploreFrontiers({
      threads: createDeadlockReachableThreads(),
      strategy: 'dfs',
    })

    expect(bfsResult.findings).toContainEqual({
      code: 'deadlock',
      history: [{ type: 'A' }],
    })
    expect(dfsResult.findings).toContainEqual({
      code: 'deadlock',
      history: [{ type: 'A' }],
    })
  })

  test('branches one successor per enabled event', () => {
    const result = exploreFrontiers({
      threads: {
        chooseA: bThreadReplaySafe([bSyncReplaySafe({ request: { type: 'A' } })]),
        chooseB: bThreadReplaySafe([bSyncReplaySafe({ request: { type: 'B' } })]),
      },
      strategy: 'bfs',
      maxDepth: 1,
    })

    expect(result.visitedHistories).toContainEqual([])
    expect(result.visitedHistories).toContainEqual([{ type: 'A' }])
    expect(result.visitedHistories).toContainEqual([{ type: 'B' }])
    expect(result.visitedHistories).toHaveLength(3)
  })

  test('maxDepth truncates exploration', () => {
    const result = exploreFrontiers({
      threads: createDeadlockReachableThreads(),
      strategy: 'bfs',
      maxDepth: 0,
    })

    expect(result.visitedHistories).toEqual([[]])
    expect(result.findings).toEqual([])
  })

  test('idle branches terminate without findings', () => {
    const result = exploreFrontiers({
      threads: {
        watcher: bThreadReplaySafe([bSyncReplaySafe({ waitFor: 'ping' })]),
      },
      strategy: 'dfs',
      includeFrontierSummaries: true,
    })

    expect(result.visitedHistories).toEqual([[]])
    expect(result.findings).toEqual([])
    expect(result.frontierSummaries).toEqual([{ history: [], status: 'idle' }])
  })
})
