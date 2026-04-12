import { ueid } from '../utils.ts'
import {
  BTHREAD_ID_PREFIX,
  EVENT_SOURCES,
  EXPLORE_STRATEGIES,
  FRONTIER_STATUS,
  VERIFICATION_STATUSES,
} from './behavioral.constants.ts'
import { advanceRunningToPending, computeFrontier, resumePendingThreadsForSelectedEvent } from './behavioral.shared.ts'
import type {
  BSync,
  BThreads,
  CandidateBid,
  DeadlockFinding,
  ExploreFrontiers,
  Frontier,
  FrontierSummary,
  PendingBid,
  ReplayEvent,
  ReplayToFrontierResult,
  RunningBid,
  VerifyFrontiersResult,
} from './behavioral.types.ts'

const serializeEvent = ({ type, detail, source }: ReplayEvent) => {
  try {
    return JSON.stringify([type, detail, source])
  } catch {
    return `${type}:${String(detail)}:${String(source)}`
  }
}

const historyKey = (history: ReplayEvent[]) => {
  if (history.length === 0) {
    return '[]'
  }
  return history.map(serializeEvent).join('|')
}

const cloneHistory = (history: ReplayEvent[]) => [...history]

const cloneCandidates = (candidates: Frontier['candidates']): Frontier['candidates'] =>
  candidates.map((candidate) => ({
    thread: candidate.thread,
    priority: candidate.priority,
    type: candidate.type,
    ...(candidate.detail !== undefined && { detail: candidate.detail }),
    source: candidate.source,
    ...(candidate.ingress && { ingress: candidate.ingress }),
  }))

const hasSameDetail = ({ left, right }: { left: unknown; right: unknown }) => {
  if (Object.is(left, right)) {
    return true
  }
  try {
    return JSON.stringify(left) === JSON.stringify(right)
  } catch {
    return false
  }
}

/**
 * @internal
 * Reconstructs pending state and frontier from replay-safe thread factories and selected-event history.
 */
export const replayToFrontier = ({
  history,
  threads,
}: {
  threads: BThreads
  history: ReplayEvent[]
}): ReplayToFrontierResult => {
  const pending = new Map<string, PendingBid>()

  const bootstrapRunning = new Map<string, RunningBid>()
  const spawn = (label: string, thread: ReturnType<BSync>) => {
    const threadId = ueid(BTHREAD_ID_PREFIX)
    bootstrapRunning.set(threadId, {
      priority: bootstrapRunning.size + 1,
      source: EVENT_SOURCES.request,
      generator: thread(),
      label,
    })
  }
  for (const [label, thread] of Object.entries(threads)) {
    spawn(label, thread)
  }

  advanceRunningToPending(bootstrapRunning, pending)

  for (const event of history) {
    const selectedEvent: CandidateBid =
      event.source === EVENT_SOURCES.request
        ? (() => {
            const frontier = computeFrontier({ pending })
            const match = frontier.enabled
              .filter((candidate) => {
                return (
                  candidate.type === event.type &&
                  candidate.source === event.source &&
                  hasSameDetail({ left: candidate.detail, right: event.detail })
                )
              })
              .sort((a, b) => a.priority - b.priority)[0]
            if (match) {
              return match
            }
            return {
              priority: 0,
              thread: event.type,
              source: EVENT_SOURCES.request,
              type: event.type,
              detail: event.detail,
            }
          })()
        : {
            priority: 0,
            thread: event.type,
            source: event.source ?? EVENT_SOURCES.request,
            type: event.type,
            detail: event.detail,
            ingress: true,
          }
    const running = new Map<string, RunningBid>()

    resumePendingThreadsForSelectedEvent({
      running,
      pending,
      selectedEvent,
    })

    advanceRunningToPending(running, pending)
  }

  return {
    pending,
    frontier: computeFrontier({ pending }),
  }
}

/**
 * @internal
 * Explores replay-safe history space by repeatedly reconstructing frontiers from event traces.
 */
export const exploreFrontiers: ExploreFrontiers = ({ threads, strategy, maxDepth, includeFrontierSummaries }) => {
  const queue: ReplayEvent[][] = [[]]
  const seenHistories = new Set<string>()
  const visitedHistories: ReplayEvent[][] = []
  const findings: DeadlockFinding[] = []
  const frontierSummaries: FrontierSummary[] = []
  let truncated = false

  while (queue.length > 0) {
    const history = strategy === EXPLORE_STRATEGIES.bfs ? queue.shift()! : queue.pop()!
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

    if (frontier.status === FRONTIER_STATUS.deadlock) {
      const candidates = cloneCandidates(frontier.candidates)
      const enabled = cloneCandidates(frontier.enabled)
      findings.push({
        code: FRONTIER_STATUS.deadlock,
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

    if (frontier.status === FRONTIER_STATUS.idle) {
      continue
    }

    if (maxDepth !== undefined && history.length >= maxDepth) {
      truncated = true
      continue
    }

    for (const candidate of frontier.enabled) {
      queue.push([
        ...history,
        {
          type: candidate.type,
          source: candidate.source,
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

/**
 * @internal
 * Thin verification layer on top of replay-safe frontier exploration.
 */
export const verifyFrontiers = (args: Parameters<ExploreFrontiers>[0]): VerifyFrontiersResult => {
  const { report, findings } = exploreFrontiers(args)

  if (findings.length > 0) {
    return { status: VERIFICATION_STATUSES.failed, report, findings }
  }
  if (report.truncated) {
    return { status: VERIFICATION_STATUSES.truncated, report, findings }
  }
  return { status: VERIFICATION_STATUSES.verified, report, findings }
}
