import { ueid } from '../utils.ts'
import {
  BTHREAD_ID_PREFIX,
  EVENT_SOURCES,
  EXPLORE_STRATEGIES,
  FRONTIER_STATUS,
  VERIFICATION_STATUSES,
} from './behavioral.constants.ts'
import type {
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
  Sync,
  VerifyFrontiersResult,
} from './behavioral.types.ts'
import { advanceRunningToPending, computeFrontier, resumePendingThreadsForSelectedEvent } from './behavioral.utils.ts'
import { deepEqual } from './deep-equal.ts'

const serializeValue = (value: unknown, seen: Map<object, number>): string => {
  if (value === null) {
    return 'null'
  }
  if (value === undefined) {
    return 'undefined'
  }

  const type = typeof value
  if (type === 'string') {
    return `string:${JSON.stringify(value)}`
  }
  if (type === 'number') {
    return `number:${Number.isNaN(value) ? 'NaN' : String(value)}`
  }
  if (type === 'boolean') {
    return `boolean:${String(value)}`
  }
  if (type === 'bigint') {
    return `bigint:${String(value)}`
  }
  if (type === 'symbol') {
    return `symbol:${String((value as symbol).description ?? '')}`
  }
  if (type === 'function') {
    const fn = value as (...args: unknown[]) => unknown
    return `function:${fn.name || 'anonymous'}`
  }

  const objectValue = value as object
  const seenId = seen.get(objectValue)
  if (seenId !== undefined) {
    return `ref:${seenId}`
  }
  const nextId = seen.size + 1
  seen.set(objectValue, nextId)

  if (Array.isArray(value)) {
    return `array:[${value.map((item) => serializeValue(item, seen)).join(',')}]`
  }
  if (value instanceof Date) {
    return `date:${Number.isNaN(value.getTime()) ? 'invalid' : value.toISOString()}`
  }
  if (value instanceof RegExp) {
    return `regexp:${String(value)}`
  }
  if (value instanceof Set) {
    const items = [...value].map((item) => serializeValue(item, seen)).sort()
    return `set:{${items.join(',')}}`
  }
  if (value instanceof Map) {
    const entries = [...value]
      .map(([key, mapValue]) => `${serializeValue(key, seen)}=>${serializeValue(mapValue, seen)}`)
      .sort()
    return `map:{${entries.join(',')}}`
  }

  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  const fields = keys.map((key) => `${JSON.stringify(key)}:${serializeValue(record[key], seen)}`)
  return `object:{${fields.join(',')}}`
}

const serializeEvent = ({ type, detail, source }: ReplayEvent) =>
  `[${JSON.stringify(type)},${JSON.stringify(source)},${serializeValue(detail, new Map<object, number>())}]`

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
  const spawn = (label: string, thread: ReturnType<Sync>) => {
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

  for (const [eventIndex, event] of history.entries()) {
    const selectedEvent: CandidateBid = (() => {
      if (event.source !== EVENT_SOURCES.request) {
        return {
          priority: 0,
          thread: event.type,
          source: event.source,
          type: event.type,
          detail: event.detail,
          ingress: true,
        }
      }

      const frontier = computeFrontier({ pending })
      const match = frontier.enabled
        .filter((candidate) => {
          return (
            candidate.type === event.type &&
            candidate.source === event.source &&
            deepEqual(candidate.detail, event.detail)
          )
        })
        .sort((a, b) => a.priority - b.priority)[0]

      if (match) {
        return match
      }

      throw new Error(
        `replayToFrontier encountered invalid request history event "${event.type}" (${event.source}). ` +
          `No enabled candidate matched this event detail at step ${eventIndex}.`,
      )
    })()
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
