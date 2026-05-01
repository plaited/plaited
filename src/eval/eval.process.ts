import { SNAPSHOT_MESSAGE_KINDS, type SnapshotMessage } from '../behavioral.ts'
import type { EvalProcessSummary, EvalTrial } from './eval.schemas.ts'
import { EvalProcessSummarySchema } from './eval.schemas.ts'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

export const isWorkerSnapshotFailure = (snapshot: SnapshotMessage): boolean => {
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
  if (signalCode !== null && signalCode !== undefined) {
    return true
  }

  return false
}

const countSnapshotsByKind = (snapshots: SnapshotMessage[], kind: SnapshotMessage['kind']): number =>
  snapshots.filter((snapshot) => snapshot.kind === kind).length

const countRepeatedSelections = (
  selectedTypes: string[],
): { repeatedSelectionCount: number; maxRepeatedSelectionTypeCount: number } => {
  if (selectedTypes.length === 0) {
    return {
      repeatedSelectionCount: 0,
      maxRepeatedSelectionTypeCount: 0,
    }
  }

  let repeatedSelectionCount = 0
  let maxRepeatedSelectionTypeCount = 0
  let currentRun = 0
  let previousType: string | undefined

  for (const selectedType of selectedTypes) {
    if (selectedType === previousType) {
      currentRun += 1
      repeatedSelectionCount += 1
    } else {
      currentRun = 1
      previousType = selectedType
    }

    if (currentRun > maxRepeatedSelectionTypeCount) {
      maxRepeatedSelectionTypeCount = currentRun
    }
  }

  return {
    repeatedSelectionCount,
    maxRepeatedSelectionTypeCount,
  }
}

export const summarizeEvalTrialProcess = (trial: EvalTrial): EvalProcessSummary => {
  const snapshots = trial.snapshots
  const selectedTypes = snapshots
    .filter((snapshot): snapshot is Extract<SnapshotMessage, { kind: 'selection' }> => {
      return snapshot.kind === SNAPSHOT_MESSAGE_KINDS.selection
    })
    .map((snapshot) => snapshot.selected.type)

  const runtimeErrorCount = countSnapshotsByKind(snapshots, SNAPSHOT_MESSAGE_KINDS.runtime_error)
  const feedbackErrorCount = countSnapshotsByKind(snapshots, SNAPSHOT_MESSAGE_KINDS.feedback_error)
  const deadlockCount = countSnapshotsByKind(snapshots, SNAPSHOT_MESSAGE_KINDS.deadlock)
  const selectionCount = countSnapshotsByKind(snapshots, SNAPSHOT_MESSAGE_KINDS.selection)
  const workerFailureCount = snapshots.filter(isWorkerSnapshotFailure).length
  const { repeatedSelectionCount, maxRepeatedSelectionTypeCount } = countRepeatedSelections(selectedTypes)

  return EvalProcessSummarySchema.parse({
    snapshotCount: snapshots.length,
    selectionCount,
    runtimeErrorCount,
    feedbackErrorCount,
    deadlockCount,
    workerFailureCount,
    repeatedSelectionCount,
    maxRepeatedSelectionTypeCount,
    runtimeErrorDetected: runtimeErrorCount > 0 || workerFailureCount > 0,
    feedbackErrorDetected: feedbackErrorCount > 0,
    deadlockDetected: deadlockCount > 0,
    workerFailureDetected: workerFailureCount > 0,
  })
}
