import type { BPEvent, BSyncReplaySafe, Frontier } from './behavioral.types.ts'
import { replayToFrontier } from './replay-to-frontier.ts'

/**
 * @internal
 * Replay-safe thread factories keyed by stable thread labels.
 */
type ReplayThreadFactories = Record<string, ReturnType<BSyncReplaySafe>>

type ExploreStrategy = 'dfs' | 'bfs'

type FrontierFinding = {
  code: 'deadlock'
  history: BPEvent[]
}

type FrontierSummary = {
  history: BPEvent[]
  status: Frontier['status']
}

type ExploreFrontiersResult = {
  visitedHistories: BPEvent[][]
  findings: FrontierFinding[]
  frontierSummaries?: FrontierSummary[]
}

type ExploreFrontiers = (args: {
  threads: ReplayThreadFactories
  strategy: ExploreStrategy
  maxDepth?: number
  includeFrontierSummaries?: boolean
}) => ExploreFrontiersResult

const serializeEvent = ({ type, detail }: BPEvent) => {
  try {
    return JSON.stringify([type, detail])
  } catch {
    return `${type}:${String(detail)}`
  }
}

const historyKey = (history: BPEvent[]) => {
  if (history.length === 0) {
    return '[]'
  }
  return history.map(serializeEvent).join('|')
}

const cloneHistory = (history: BPEvent[]) => [...history]

/**
 * @internal
 * Explores replay-safe history space by repeatedly reconstructing frontiers from event traces.
 */
export const exploreFrontiers: ExploreFrontiers = ({ threads, strategy, maxDepth, includeFrontierSummaries }) => {
  const queue: BPEvent[][] = [[]]
  const seenHistories = new Set<string>()
  const visitedHistories: BPEvent[][] = []
  const findings: FrontierFinding[] = []
  const frontierSummaries: FrontierSummary[] = []

  while (queue.length > 0) {
    const history = strategy === 'bfs' ? queue.shift()! : queue.pop()!
    const key = historyKey(history)
    if (seenHistories.has(key)) {
      continue
    }
    seenHistories.add(key)

    visitedHistories.push(cloneHistory(history))

    const { frontier } = replayToFrontier({ threads, history })

    if (includeFrontierSummaries) {
      frontierSummaries.push({
        history: cloneHistory(history),
        status: frontier.status,
      })
    }

    if (frontier.status === 'deadlock') {
      findings.push({ code: 'deadlock', history: cloneHistory(history) })
      continue
    }

    if (frontier.status === 'idle') {
      continue
    }

    if (maxDepth !== undefined && history.length >= maxDepth) {
      continue
    }

    for (const candidate of frontier.enabled) {
      queue.push([
        ...history,
        {
          type: candidate.type,
          ...(candidate.detail !== undefined && { detail: candidate.detail }),
        },
      ])
    }
  }

  return {
    visitedHistories,
    findings,
    ...(includeFrontierSummaries ? { frontierSummaries } : {}),
  }
}
