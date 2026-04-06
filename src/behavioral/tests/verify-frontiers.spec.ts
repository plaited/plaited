import { describe, expect, test } from 'bun:test'
import { bSyncReplaySafe, bThreadReplaySafe } from 'plaited/behavioral'
import { exploreFrontiers } from '../explore-frontiers.ts'
import { verifyFrontiers } from '../verify-frontiers.ts'

const createDeadlockReachableThreads = () => ({
  chooseA: bThreadReplaySafe([bSyncReplaySafe({ request: { type: 'A' } })]),
  chooseB: bThreadReplaySafe([bSyncReplaySafe({ request: { type: 'B' } })]),
  deadlockAfterA: bThreadReplaySafe([bSyncReplaySafe({ waitFor: 'A' }), bSyncReplaySafe({ block: 'B' })]),
})

describe('verifyFrontiers', () => {
  test('returns failed when a reachable deadlock is found', () => {
    const result = verifyFrontiers({
      threads: createDeadlockReachableThreads(),
      strategy: 'bfs',
    })

    expect(result.status).toBe('failed')
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: 'deadlock',
        history: [{ type: 'A' }],
      }),
    )
    expect(result.report.findingCount).toBe(result.findings.length)
    expect(result.report.truncated).toBe(false)
  })

  test('returns truncated when exploration is cut off with no findings', () => {
    const result = verifyFrontiers({
      threads: {
        producer: bThreadReplaySafe([bSyncReplaySafe({ request: { type: 'tick' } })], true),
      },
      strategy: 'dfs',
      maxDepth: 1,
    })

    expect(result.status).toBe('truncated')
    expect(result.findings).toEqual([])
    expect(result.report).toEqual({
      strategy: 'dfs',
      visitedCount: 2,
      findingCount: 0,
      truncated: true,
      maxDepth: 1,
    })
  })

  test('returns verified when exploration completes with no findings', () => {
    const result = verifyFrontiers({
      threads: {
        watcher: bThreadReplaySafe([bSyncReplaySafe({ waitFor: 'ping' })]),
      },
      strategy: 'bfs',
    })

    expect(result.status).toBe('verified')
    expect(result.findings).toEqual([])
    expect(result.report).toEqual({
      strategy: 'bfs',
      visitedCount: 1,
      findingCount: 0,
      truncated: false,
    })
  })

  test('preserves underlying report and findings payloads from the explorer', () => {
    const args = {
      threads: createDeadlockReachableThreads(),
      strategy: 'dfs' as const,
      includeFrontierSummaries: true,
    }

    const explorerResult = exploreFrontiers(args)
    const result = verifyFrontiers(args)

    expect(result.report).toEqual(explorerResult.report)
    expect(result.findings).toEqual(explorerResult.findings)
  })
})
