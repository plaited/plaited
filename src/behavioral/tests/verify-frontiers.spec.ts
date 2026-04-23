import { describe, expect, test } from 'bun:test'
import { exploreFrontiers, verifyFrontiers } from '../behavioral.frontier.ts'
import { sync, thread } from './helpers.ts'

const onType = (type: string) => ({
  type,
})

const createDeadlockReachableThreads = () => ({
  chooseA: thread([sync({ request: { type: 'A' } })]),
  chooseB: thread([sync({ request: { type: 'B' } })]),
  deadlockAfterA: thread([sync({ waitFor: onType('A') }), sync({ block: onType('B') })]),
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
        history: [{ type: 'A', source: 'request' }],
      }),
    )
    expect(result.report.findingCount).toBe(result.findings.length)
    expect(result.report.truncated).toBe(false)
  })

  test('returns truncated when exploration is cut off with no findings', () => {
    const result = verifyFrontiers({
      threads: {
        producer: thread([sync({ request: { type: 'tick' } })], true),
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
        watcher: thread([sync({ waitFor: onType('ping') })]),
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
    const normalize = (findings: typeof result.findings) =>
      findings.map((finding) => ({
        ...finding,
        candidates: finding.candidates.map((candidate) => ({
          ...candidate,
          thread: '<runtime-id>',
        })),
      }))
    expect(normalize(result.findings)).toEqual(normalize(explorerResult.findings))
  })
})
