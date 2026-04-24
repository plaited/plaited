/**
 * Tool-owned frontier replay, exploration, verification, and CLI contract.
 */
import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as z from 'zod'
import { BTHREAD_ID_PREFIX, EVENT_SOURCES, FRONTIER_STATUS } from '../../behavioral/behavioral.constants.ts'
import type { BPListener } from '../../behavioral/behavioral.schemas.ts'
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
} from '../../behavioral/behavioral.types.ts'
import {
  advanceRunningToPending,
  computeFrontier,
  resumePendingThreadsForSelectedEvent,
} from '../../behavioral/behavioral.utils.ts'
import { deepEqual } from '../../behavioral/deep-equal.ts'
import { ueid } from '../../utils.ts'
import { makeCli } from '../utils/cli.ts'
import {
  BEHAVIORAL_FRONTIER_COMMAND,
  BEHAVIORAL_FRONTIER_MODES,
  BEHAVIORAL_FRONTIER_STRATEGIES,
  BEHAVIORAL_FRONTIER_VERIFY_STATUSES,
} from './behavioral-frontier.constants.ts'
import {
  type BehavioralFrontierCandidate,
  type BehavioralFrontierDeadlockFinding,
  BehavioralFrontierHistoryEventSchema,
  type BehavioralFrontierInput,
  BehavioralFrontierInputSchema,
  type BehavioralFrontierOutput,
  BehavioralFrontierOutputSchema,
  type BehavioralFrontierPendingSummary,
  type BehavioralFrontierReplayInput,
} from './behavioral-frontier.schemas.ts'

type VerifyFrontiersCliResult = VerifyFrontiersResult & {
  frontierSummaries?: FrontierSummary[]
}

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
    const history = strategy === BEHAVIORAL_FRONTIER_STRATEGIES.bfs ? queue.shift()! : queue.pop()!
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
export const verifyFrontiers = (args: Parameters<ExploreFrontiers>[0]): VerifyFrontiersCliResult => {
  const { report, findings, frontierSummaries } = exploreFrontiers(args)

  if (findings.length > 0) {
    return {
      status: BEHAVIORAL_FRONTIER_VERIFY_STATUSES.failed,
      report,
      findings,
      ...(frontierSummaries ? { frontierSummaries } : {}),
    }
  }
  if (report.truncated) {
    return {
      status: BEHAVIORAL_FRONTIER_VERIFY_STATUSES.truncated,
      report,
      findings,
      ...(frontierSummaries ? { frontierSummaries } : {}),
    }
  }
  return {
    status: BEHAVIORAL_FRONTIER_VERIFY_STATUSES.verified,
    report,
    findings,
    ...(frontierSummaries ? { frontierSummaries } : {}),
  }
}

const toAbsolutePath = ({ cwd, path }: { cwd?: string; path: string }): string => {
  if (isAbsolute(path)) {
    return path
  }
  const base = cwd ? resolve(cwd) : process.cwd()
  return resolve(base, path)
}

const formatZodIssues = (issues: z.ZodIssue[]) =>
  issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '<root>'
      return `${path}: ${issue.message}`
    })
    .join('; ')

const parseReplayHistory = ({ source, value }: { source: string; value: unknown }): ReplayEvent[] => {
  const parsed = z.array(BehavioralFrontierHistoryEventSchema).safeParse(value)
  if (!parsed.success) {
    throw new Error(`Invalid replay history from ${source}: ${formatZodIssues(parsed.error.issues)}`)
  }
  return parsed.data as ReplayEvent[]
}

const loadHistoryFromPath = async ({
  cwd,
  historyPath,
}: {
  cwd?: string
  historyPath: string
}): Promise<ReplayEvent[]> => {
  const resolvedHistoryPath = toAbsolutePath({ cwd, path: historyPath })
  const historyFile = Bun.file(resolvedHistoryPath)
  if (!(await historyFile.exists())) {
    throw new Error(`History file does not exist: ${resolvedHistoryPath}`)
  }

  const raw = (await historyFile.text()).trim()
  if (raw.length === 0) {
    return []
  }

  try {
    const jsonValue = JSON.parse(raw)
    if (Array.isArray(jsonValue)) {
      return parseReplayHistory({ source: `historyPath ${resolvedHistoryPath}`, value: jsonValue })
    }
  } catch {
    // Fall through to JSONL parsing.
  }

  const rows: unknown[] = []
  const lines = raw.split(/\r?\n/).map((line) => line.trim())
  for (const [lineIndex, line] of lines.entries()) {
    if (line.length === 0) {
      continue
    }
    try {
      rows.push(JSON.parse(line))
    } catch {
      throw new Error(`Invalid JSON on historyPath line ${lineIndex + 1}: ${resolvedHistoryPath}`)
    }
  }

  return parseReplayHistory({ source: `historyPath ${resolvedHistoryPath}`, value: rows })
}

const resolveReplayHistory = async ({
  cwd,
  history,
  historyPath,
}: BehavioralFrontierReplayInput): Promise<ReplayEvent[]> => {
  if (historyPath) {
    return loadHistoryFromPath({ cwd, historyPath })
  }
  return (history ?? []) as ReplayEvent[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const ensureReplaySafeThreads = ({
  value,
  modulePath,
  exportName,
}: {
  value: unknown
  modulePath: string
  exportName: string
}): BThreads => {
  if (!isRecord(value)) {
    throw new Error(
      `Invalid thread export from ${modulePath}#${exportName}. Expected an object mapping labels to thread factories.`,
    )
  }

  const threads: BThreads = {}
  for (const [label, thread] of Object.entries(value)) {
    if (typeof thread !== 'function') {
      throw new Error(
        `Invalid thread export from ${modulePath}#${exportName}. Key "${label}" must be a replay-safe thread factory function.`,
      )
    }
    threads[label] = thread as ReturnType<Sync>
  }

  return threads
}

const loadReplaySafeThreads = async ({
  cwd,
  modulePath,
  exportName,
}: {
  cwd?: string
  modulePath: string
  exportName?: string
}): Promise<{ threads: BThreads; resolvedModulePath: string; resolvedExportName: string }> => {
  const resolvedModulePath = toAbsolutePath({ cwd, path: modulePath })
  const moduleUrl = pathToFileURL(resolvedModulePath).href

  let moduleExports: Record<string, unknown>
  try {
    moduleExports = (await import(moduleUrl)) as Record<string, unknown>
  } catch (error) {
    throw new Error(
      `Unable to load thread module ${resolvedModulePath}. ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const resolvedExportName = exportName ?? 'default'
  if (!(resolvedExportName in moduleExports)) {
    if (!exportName) {
      throw new Error(
        `Module ${resolvedModulePath} has no default export. Provide exportName for a named thread export.`,
      )
    }
    throw new Error(`Export "${resolvedExportName}" was not found in module ${resolvedModulePath}.`)
  }

  const selectedExport = moduleExports[resolvedExportName]
  let threadsValue = selectedExport

  if (typeof selectedExport === 'function') {
    try {
      threadsValue = await (selectedExport as () => unknown | Promise<unknown>)()
    } catch (error) {
      throw new Error(
        `Thread factory ${resolvedModulePath}#${resolvedExportName} threw while creating threads. ` +
          `${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  const threads = ensureReplaySafeThreads({
    value: threadsValue,
    modulePath: resolvedModulePath,
    exportName: resolvedExportName,
  })

  return {
    threads,
    resolvedModulePath,
    resolvedExportName,
  }
}

const asListenerArray = (listener?: BPListener | BPListener[]): BPListener[] => {
  if (!listener) {
    return []
  }
  return Array.isArray(listener) ? listener : [listener]
}

const buildThreadLabelById = (pending: Map<string, PendingBid>): Map<string, string> => {
  const labels = new Map<string, string>()
  for (const [threadId, bid] of pending) {
    labels.set(threadId, bid.label)
  }
  return labels
}

const sortCandidates = (candidates: BehavioralFrontierCandidate[]): BehavioralFrontierCandidate[] => {
  return candidates.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority
    }
    if (a.label !== b.label) {
      return a.label.localeCompare(b.label)
    }
    return a.type.localeCompare(b.type)
  })
}

const summarizeCandidate = ({
  candidate,
  labelsByThreadId,
}: {
  candidate: CandidateBid
  labelsByThreadId: Map<string, string>
}): BehavioralFrontierCandidate => {
  return {
    label: labelsByThreadId.get(candidate.thread) ?? candidate.thread,
    priority: candidate.priority,
    source: candidate.source,
    type: candidate.type,
    ...(candidate.detail !== undefined && { detail: candidate.detail }),
    ...(candidate.ingress && { ingress: true }),
  }
}

const summarizeFrontier = ({
  frontier,
  labelsByThreadId,
}: {
  frontier: Frontier
  labelsByThreadId: Map<string, string>
}) => {
  const candidates = sortCandidates(
    frontier.candidates.map((candidate) => summarizeCandidate({ candidate, labelsByThreadId })),
  )
  const enabled = sortCandidates(
    frontier.enabled.map((candidate) => summarizeCandidate({ candidate, labelsByThreadId })),
  )

  return {
    status: frontier.status,
    candidateCount: candidates.length,
    enabledCount: enabled.length,
    candidates,
    enabled,
  }
}

const summarizePending = (pending: Map<string, PendingBid>): BehavioralFrontierPendingSummary[] => {
  const summaries: BehavioralFrontierPendingSummary[] = []
  for (const [, bid] of pending) {
    summaries.push({
      label: bid.label,
      priority: bid.priority,
      source: bid.source,
      ...(bid.ingress && { ingress: true }),
      hasRequest: Boolean(bid.request),
      ...(bid.request?.type ? { requestType: bid.request.type } : {}),
      waitForTypes: asListenerArray(bid.waitFor).map((listener) => listener.type),
      blockTypes: asListenerArray(bid.block).map((listener) => listener.type),
      interruptTypes: asListenerArray(bid.interrupt).map((listener) => listener.type),
    })
  }

  return summaries.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority
    }
    return a.label.localeCompare(b.label)
  })
}

const summarizeFindings = ({
  findings,
  threads,
}: {
  findings: DeadlockFinding[]
  threads: BThreads
}): BehavioralFrontierDeadlockFinding[] => {
  const rows: BehavioralFrontierDeadlockFinding[] = []

  for (const finding of findings) {
    const { pending } = replayToFrontier({ threads, history: finding.history })
    const labelsByThreadId = buildThreadLabelById(pending)

    rows.push({
      code: finding.code,
      history: finding.history,
      status: 'deadlock',
      candidates: finding.candidates.map((candidate) => summarizeCandidate({ candidate, labelsByThreadId })),
      enabled: finding.enabled.map((candidate) => summarizeCandidate({ candidate, labelsByThreadId })),
      summary: finding.summary,
    })
  }

  return rows
}

const createModuleSummary = ({
  modulePath,
  resolvedModulePath,
  resolvedExportName,
}: {
  modulePath: string
  resolvedModulePath: string
  resolvedExportName: string
}) => ({
  modulePath,
  resolvedModulePath,
  exportName: resolvedExportName,
})

/**
 * Runs the behavioral-frontier operation selected by `mode`.
 *
 * @public
 */
export const runBehavioralFrontier = async (input: BehavioralFrontierInput): Promise<BehavioralFrontierOutput> => {
  const { threads, resolvedModulePath, resolvedExportName } = await loadReplaySafeThreads({
    cwd: input.cwd,
    modulePath: input.modulePath,
    exportName: input.exportName,
  })

  const module = createModuleSummary({
    modulePath: input.modulePath,
    resolvedModulePath,
    resolvedExportName,
  })

  if (input.mode === BEHAVIORAL_FRONTIER_MODES.replay) {
    const history = await resolveReplayHistory(input)
    const replayResult = replayToFrontier({
      history,
      threads,
    })
    const labelsByThreadId = buildThreadLabelById(replayResult.pending)

    return {
      mode: BEHAVIORAL_FRONTIER_MODES.replay,
      module,
      history,
      frontier: summarizeFrontier({
        frontier: replayResult.frontier,
        labelsByThreadId,
      }),
      pendingSummary: summarizePending(replayResult.pending),
    }
  }

  const args = {
    threads,
    strategy: input.strategy ?? BEHAVIORAL_FRONTIER_STRATEGIES.bfs,
    includeFrontierSummaries: input.includeFrontierSummaries ?? false,
    ...(input.maxDepth !== undefined && { maxDepth: input.maxDepth }),
  }

  if (input.mode === BEHAVIORAL_FRONTIER_MODES.explore) {
    const exploration = exploreFrontiers(args)

    return {
      mode: BEHAVIORAL_FRONTIER_MODES.explore,
      module,
      report: exploration.report,
      visitedHistories: exploration.visitedHistories,
      findings: summarizeFindings({
        findings: exploration.findings,
        threads,
      }),
      ...(exploration.frontierSummaries ? { frontierSummaries: exploration.frontierSummaries } : {}),
    }
  }

  const verification = verifyFrontiers(args)
  return {
    mode: BEHAVIORAL_FRONTIER_MODES.verify,
    module,
    status: verification.status,
    report: verification.report,
    findings: summarizeFindings({
      findings: verification.findings,
      threads,
    }),
    ...(verification.frontierSummaries ? { frontierSummaries: verification.frontierSummaries } : {}),
  }
}

/**
 * CLI handler for `behavioral-frontier`.
 *
 * @public
 */
export const behavioralFrontierCli = makeCli({
  name: BEHAVIORAL_FRONTIER_COMMAND,
  inputSchema: BehavioralFrontierInputSchema,
  outputSchema: BehavioralFrontierOutputSchema,
  help: [
    'Thread module contract:',
    '  - default export: BThreads object | () => BThreads | async () => BThreads',
    '  - named export: same shape, selected via exportName',
    'Replay history options:',
    '  - history: inline JSON array of replay events',
    '  - historyPath: JSON array file or JSONL file (one replay event per line)',
  ].join('\n'),
  run: runBehavioralFrontier,
})
