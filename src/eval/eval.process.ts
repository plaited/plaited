import { SNAPSHOT_MESSAGE_KINDS, type SnapshotMessage } from '../behavioral.ts'
import type { PlaitedTrace, ProcessTraceCoverage, TrialProcessSummary } from './eval.schema.ts'
import { TrialProcessSummarySchema } from './eval.schema.ts'

type SnapshotWithBids = Extract<SnapshotMessage, { bids: Array<{ blockedBy?: unknown; interrupts?: unknown }> }>
type SelectionSnapshotMessage = Extract<SnapshotMessage, { kind: 'selection' }>

const countSnapshotKind = (trace: PlaitedTrace | undefined, kind: SnapshotMessage['kind']): number =>
  (trace?.snapshots ?? []).filter((snapshot) => snapshot.kind === kind).length

const getSnapshotsWithBids = (trace?: PlaitedTrace): SnapshotWithBids[] =>
  (trace?.snapshots ?? []).filter((snapshot): snapshot is SnapshotWithBids => 'bids' in snapshot)

const getSelectionSnapshots = (trace?: PlaitedTrace): SelectionSnapshotMessage[] =>
  (trace?.snapshots ?? []).filter(
    (snapshot): snapshot is SelectionSnapshotMessage => snapshot.kind === SNAPSHOT_MESSAGE_KINDS.selection,
  )

const getSelectedEventTypes = (trace?: PlaitedTrace): string[] => {
  const explicitSelectedTypes = (trace?.selectedEvents ?? []).map((event) => event.type)
  if (explicitSelectedTypes.length > 0) {
    return explicitSelectedTypes
  }
  return getSelectionSnapshots(trace).flatMap((snapshot) =>
    snapshot.bids.filter((bid) => bid.selected).map((bid) => bid.type),
  )
}

const countRuntimeOutputErrors = (trace?: PlaitedTrace): number =>
  (trace?.runtimeOutputs ?? []).filter((output) => output.status === 'error' || Boolean(output.error)).length

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const isWorkerSnapshotFailure = (snapshot: SnapshotMessage): boolean => {
  if (snapshot.kind !== SNAPSHOT_MESSAGE_KINDS.worker) {
    return false
  }
  if (!isRecord(snapshot.response)) {
    return false
  }

  const exitCode = snapshot.response.exitCode
  if (typeof exitCode === 'number' && exitCode !== 0) {
    return true
  }

  const timedOut = snapshot.response.timedOut
  if (timedOut === true) {
    return true
  }

  const signalCode = snapshot.response.signalCode
  if (signalCode !== undefined && signalCode !== null) {
    return true
  }

  return false
}

const countWorkerSnapshotErrors = (trace?: PlaitedTrace): number =>
  (trace?.snapshots ?? []).filter(isWorkerSnapshotFailure).length

export const hasRuntimeErrors = ({
  trace,
  runnerError,
  timedOut,
}: {
  trace?: PlaitedTrace
  runnerError?: string
  timedOut?: boolean
}): boolean => {
  const runtimeOutputErrorCount = countRuntimeOutputErrors(trace)
  const runtimeSnapshotErrorCount = countSnapshotKind(trace, SNAPSHOT_MESSAGE_KINDS.runtime_error)
  const workerSnapshotErrorCount = countWorkerSnapshotErrors(trace)
  return (
    Boolean(runnerError) ||
    Boolean(timedOut) ||
    runtimeOutputErrorCount > 0 ||
    runtimeSnapshotErrorCount > 0 ||
    workerSnapshotErrorCount > 0
  )
}

export const hasFeedbackErrors = (trace?: PlaitedTrace): boolean =>
  countSnapshotKind(trace, SNAPSHOT_MESSAGE_KINDS.feedback_error) > 0

export const hasDeadlocks = (trace?: PlaitedTrace): boolean =>
  countSnapshotKind(trace, SNAPSHOT_MESSAGE_KINDS.deadlock) > 0

export const countSelectedEvents = (trace?: PlaitedTrace): number => {
  const explicitCount = trace?.selectedEvents?.length ?? 0
  if (explicitCount > 0) {
    return explicitCount
  }
  return getSelectionSnapshots(trace).reduce(
    (total, snapshot) => total + snapshot.bids.filter((bid) => bid.selected).length,
    0,
  )
}

export const detectTraceCoverage = (trace?: PlaitedTrace): ProcessTraceCoverage => {
  const snapshotCount = trace?.snapshots?.length ?? 0
  const adjacentEventCount = (trace?.selectedEvents?.length ?? 0) + (trace?.emittedEvents?.length ?? 0)
  const runtimeOutputCount = trace?.runtimeOutputs?.length ?? 0
  const adjacentEvidenceCount = adjacentEventCount + runtimeOutputCount

  if (snapshotCount === 0 && adjacentEvidenceCount === 0) {
    return 'none'
  }
  if (snapshotCount > 0 && adjacentEvidenceCount === 0) {
    return 'snapshots-only'
  }
  if (snapshotCount === 0 && adjacentEvidenceCount > 0) {
    return 'events-only'
  }
  return 'snapshots-and-events'
}

export const analyzeSelectionPatterns = (
  trace?: PlaitedTrace,
): Pick<TrialProcessSummary, 'repeatedSelectionCount' | 'maxConsecutiveSelectionTypeCount'> => {
  const selectedTypes = getSelectedEventTypes(trace)
  if (selectedTypes.length === 0) {
    return {
      repeatedSelectionCount: 0,
      maxConsecutiveSelectionTypeCount: 0,
    }
  }

  let previousType: string | undefined
  let repeatedSelectionCount = 0
  let currentConsecutiveCount = 0
  let maxConsecutiveSelectionTypeCount = 0

  for (const selectedType of selectedTypes) {
    if (selectedType === previousType) {
      currentConsecutiveCount += 1
      repeatedSelectionCount += 1
    } else {
      previousType = selectedType
      currentConsecutiveCount = 1
    }
    if (currentConsecutiveCount > maxConsecutiveSelectionTypeCount) {
      maxConsecutiveSelectionTypeCount = currentConsecutiveCount
    }
  }

  return {
    repeatedSelectionCount,
    maxConsecutiveSelectionTypeCount,
  }
}

export const countBlockedBids = (trace?: PlaitedTrace): number =>
  getSnapshotsWithBids(trace).reduce(
    (total, snapshot) => total + snapshot.bids.filter((bid) => bid.blockedBy).length,
    0,
  )

export const countInterruptedBids = (trace?: PlaitedTrace): number =>
  getSnapshotsWithBids(trace).reduce(
    (total, snapshot) => total + snapshot.bids.filter((bid) => bid.interrupts).length,
    0,
  )

export const summarizeTrialProcess = ({
  trace,
  runnerError,
  timedOut,
}: {
  trace?: PlaitedTrace
  runnerError?: string
  timedOut?: boolean
}): TrialProcessSummary => {
  const coverage = detectTraceCoverage(trace)
  const snapshotCount = trace?.snapshots?.length ?? 0
  const selectionCount = countSnapshotKind(trace, SNAPSHOT_MESSAGE_KINDS.selection)
  const selectedEventCount = countSelectedEvents(trace)
  const emittedEventCount = trace?.emittedEvents?.length ?? 0
  const deadlockCount = countSnapshotKind(trace, SNAPSHOT_MESSAGE_KINDS.deadlock)
  const feedbackErrorCount = countSnapshotKind(trace, SNAPSHOT_MESSAGE_KINDS.feedback_error)
  const runtimeSnapshotErrorCount = countSnapshotKind(trace, SNAPSHOT_MESSAGE_KINDS.runtime_error)
  const workerSnapshotErrorCount = countWorkerSnapshotErrors(trace)
  const runtimeOutputCount = trace?.runtimeOutputs?.length ?? 0
  const runtimeOutputErrorCount = countRuntimeOutputErrors(trace)
  const blockedBidCount = countBlockedBids(trace)
  const interruptedBidCount = countInterruptedBids(trace)
  const { repeatedSelectionCount, maxConsecutiveSelectionTypeCount } = analyzeSelectionPatterns(trace)
  const runnerErrorCount = runnerError ? 1 : 0
  const runnerTimeoutCount = timedOut ? 1 : 0
  const runtimeErrorCount =
    runtimeSnapshotErrorCount +
    runtimeOutputErrorCount +
    workerSnapshotErrorCount +
    runnerErrorCount +
    runnerTimeoutCount

  return TrialProcessSummarySchema.parse({
    coverage,
    snapshotCount,
    selectionCount,
    selectedEventCount,
    emittedEventCount,
    deadlockCount,
    feedbackErrorCount,
    runtimeErrorCount,
    runtimeOutputCount,
    runtimeOutputErrorCount,
    blockedBidCount,
    interruptedBidCount,
    repeatedSelectionCount,
    maxConsecutiveSelectionTypeCount,
    runnerErrorCount,
    runnerTimeoutCount,
    deadlockDetected: deadlockCount > 0,
    feedbackErrorDetected: feedbackErrorCount > 0,
    runtimeErrorDetected: hasRuntimeErrors({ trace, runnerError, timedOut }),
  })
}
