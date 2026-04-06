import type { BPEvent, BSyncReplaySafe, Frontier } from './behavioral.types.ts'
import { replayToFrontier } from './replay-to-frontier.ts'

/**
 * @internal
 * Replay-safe thread factories keyed by stable thread labels.
 */
type ReplayThreadFactories = Record<string, ReturnType<BSyncReplaySafe>>

type ExploreStrategy = 'dfs' | 'bfs'

type DeadlockFinding = {
  code: 'deadlock'
  history: BPEvent[]
  status: Frontier['status']
  candidates: Frontier['candidates']
  enabled: Frontier['enabled']
  summary: {
    candidateCount: number
    enabledCount: number
  }
}

type FrontierSummary = {
  history: BPEvent[]
  status: Frontier['status']
}

type ExploreFrontiersReport = {
  strategy: ExploreStrategy
  visitedCount: number
  findingCount: number
  /**
   * True only when the explorer encountered at least one `ready` frontier that it did not expand
   * because `maxDepth` was reached for that history.
   *
   * This does not indicate generic incompleteness: `idle`/`deadlock` terminal frontiers keep this false
   * even when `maxDepth` is set.
   */
  truncated: boolean
  maxDepth?: number
}

type ExploreFrontiersResult = {
  report: ExploreFrontiersReport
  visitedHistories: BPEvent[][]
  findings: DeadlockFinding[]
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
const cloneCandidates = (candidates: Frontier['candidates']): Frontier['candidates'] =>
  candidates.map((candidate) => ({
    thread: candidate.thread,
    priority: candidate.priority,
    type: candidate.type,
    ...(candidate.detail !== undefined && { detail: candidate.detail }),
    ...(candidate.trigger && { trigger: candidate.trigger }),
    ...(candidate.template && { template: candidate.template }),
  }))

/**
 * @internal
 * Explores replay-safe history space by repeatedly reconstructing frontiers from event traces.
 */
export const exploreFrontiers: ExploreFrontiers = ({ threads, strategy, maxDepth, includeFrontierSummaries }) => {
  const queue: BPEvent[][] = [[]]
  const seenHistories = new Set<string>()
  const visitedHistories: BPEvent[][] = []
  const findings: DeadlockFinding[] = []
  const frontierSummaries: FrontierSummary[] = []
  let truncated = false

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
      const candidates = cloneCandidates(frontier.candidates)
      const enabled = cloneCandidates(frontier.enabled)
      findings.push({
        code: 'deadlock',
        history: cloneHistory(history),
        status: frontier.status,
        candidates,
        enabled,
        summary: {
          candidateCount: candidates.length,
          enabledCount: enabled.length,
        },
      })
      continue
    }

    if (frontier.status === 'idle') {
      continue
    }

    if (maxDepth !== undefined && history.length >= maxDepth) {
      // `truncated` is specifically a depth-cutoff signal for explorable (`ready`) branches.
      truncated = true
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
    report: {
      strategy,
      visitedCount: visitedHistories.length,
      findingCount: findings.length,
      truncated,
      ...(maxDepth !== undefined && { maxDepth }),
    },
    visitedHistories,
    findings,
    ...(includeFrontierSummaries ? { frontierSummaries } : {}),
  }
}
