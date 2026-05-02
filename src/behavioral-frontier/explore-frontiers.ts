import type {
  BPEvent,
  Frontier,
  FrontierSnapshot,
  PendingBid,
  SelectionSnapshot,
  SnapshotMessage,
  Spec,
} from '../behavioral.ts'
import { ensureArray, FRONTIER_STATUS, isListeningFor, SNAPSHOT_MESSAGE_KINDS } from '../behavioral.ts'
import { deepEqual } from '../utils.ts'

import {
  BEHAVIORAL_FRONTIER_SELECTION_POLICIES,
  BEHAVIORAL_FRONTIER_STRATEGIES,
} from './behavioral-frontier.constants.ts'
import { replayToFrontier } from './replay-to-frontier.ts'

export type ExploreFrontiersArgs = {
  specs: Spec[]
  snapshotMessages?: SnapshotMessage[]
  triggers?: BPEvent[]
  strategy?: 'bfs' | 'dfs'
  selectionPolicy?: 'all-enabled' | 'scheduler'
  maxDepth?: number
}

export type FrontierTrace = {
  snapshotMessages: SnapshotMessage[]
}

export type DeadlockFinding = {
  code: 'deadlock'
  snapshotMessages: SnapshotMessage[]
}

export type ExploreFrontiersResult = {
  traces: FrontierTrace[]
  findings: DeadlockFinding[]
  report: {
    strategy: 'bfs' | 'dfs'
    selectionPolicy: 'all-enabled' | 'scheduler'
    visitedCount: number
    findingCount: number
    truncated: boolean
    maxDepth?: number
  }
}

const countSelectionSnapshots = ({ snapshotMessages }: { snapshotMessages: SnapshotMessage[] }) =>
  snapshotMessages.reduce((count, snapshot) => count + (snapshot.kind === 'selection' ? 1 : 0), 0)

const createFrontierSnapshot = ({ frontier, step }: { frontier: Frontier; step: number }): FrontierSnapshot => ({
  kind: SNAPSHOT_MESSAGE_KINDS.frontier,
  step,
  status: frontier.status,
  candidates: frontier.candidates.map((candidate) => ({
    priority: candidate.priority,
    type: candidate.type,
    ...(candidate.detail === undefined ? {} : { detail: candidate.detail }),
    ...(candidate.ingress === undefined ? {} : { ingress: candidate.ingress }),
  })),
  enabled: frontier.enabled.map((candidate) => ({
    priority: candidate.priority,
    type: candidate.type,
    ...(candidate.detail === undefined ? {} : { detail: candidate.detail }),
    ...(candidate.ingress === undefined ? {} : { ingress: candidate.ingress }),
  })),
})

const createSelectionSnapshot = ({
  event,
  step,
}: {
  event: BPEvent & { ingress?: true }
  step: number
}): SelectionSnapshot => ({
  kind: SNAPSHOT_MESSAGE_KINDS.selection,
  step,
  selected: {
    type: event.type,
    ...(event.detail === undefined ? {} : { detail: event.detail }),
    ...(event.ingress === undefined ? {} : { ingress: event.ingress }),
  },
})

const createDeadlockSnapshot = ({ step }: { step: number }): SnapshotMessage => ({
  kind: SNAPSHOT_MESSAGE_KINDS.deadlock,
  step,
})

const triggerAffectsPendingBid = ({ pendingBid, trigger }: { pendingBid: PendingBid; trigger: BPEvent }) => {
  if (pendingBid.ingress === true) {
    return false
  }

  const candidate = {
    priority: 0,
    type: trigger.type,
    ...(trigger.detail === undefined ? {} : { detail: trigger.detail }),
    ingress: true as const,
  }

  return (
    (pendingBid.request !== undefined &&
      pendingBid.request.type === trigger.type &&
      deepEqual(pendingBid.request.detail, trigger.detail)) ||
    ensureArray(pendingBid.waitFor).some(isListeningFor(candidate)) ||
    ensureArray(pendingBid.interrupt).some(isListeningFor(candidate))
  )
}

const getRequestSuccessors = ({
  frontier,
  selectionPolicy,
  step,
}: {
  frontier: Frontier
  selectionPolicy: 'all-enabled' | 'scheduler'
  step: number
}) => {
  if (frontier.status !== FRONTIER_STATUS.ready) {
    return []
  }

  const enabled =
    selectionPolicy === BEHAVIORAL_FRONTIER_SELECTION_POLICIES.scheduler
      ? [...frontier.enabled].sort((left, right) => left.priority - right.priority).slice(0, 1)
      : frontier.enabled

  return enabled.map((candidate) =>
    createSelectionSnapshot({
      step,
      event: {
        type: candidate.type,
        ...(candidate.detail === undefined ? {} : { detail: candidate.detail }),
        ...(candidate.ingress === undefined ? {} : { ingress: candidate.ingress }),
      },
    }),
  )
}

const getTriggerSuccessors = ({
  pending,
  snapshotMessages,
  specs,
  step,
  triggers,
}: {
  pending: Set<PendingBid>
  snapshotMessages: SnapshotMessage[]
  specs: Spec[]
  step: number
  triggers: BPEvent[]
}) => {
  const successors: SelectionSnapshot[] = []

  for (const trigger of triggers) {
    if (![...pending].some((pendingBid) => triggerAffectsPendingBid({ pendingBid, trigger }))) {
      continue
    }

    const selection = createSelectionSnapshot({
      step,
      event: {
        type: trigger.type,
        ...(trigger.detail === undefined ? {} : { detail: trigger.detail }),
        ingress: true,
      },
    })

    try {
      replayToFrontier({
        specs,
        snapshotMessages: [...snapshotMessages, selection],
      })
      successors.push(selection)
    } catch {}
  }

  return successors
}

export const exploreFrontiers = ({
  specs,
  snapshotMessages = [],
  triggers = [],
  strategy = BEHAVIORAL_FRONTIER_STRATEGIES.bfs,
  selectionPolicy = BEHAVIORAL_FRONTIER_SELECTION_POLICIES['all-enabled'],
  maxDepth,
}: ExploreFrontiersArgs): ExploreFrontiersResult => {
  if (strategy !== BEHAVIORAL_FRONTIER_STRATEGIES.bfs && strategy !== BEHAVIORAL_FRONTIER_STRATEGIES.dfs) {
    throw new Error(`Unsupported frontier exploration strategy "${String(strategy)}".`)
  }

  const pending = [snapshotMessages]
  const visited = new Set<string>()
  const traces: FrontierTrace[] = []
  const findings: DeadlockFinding[] = []
  let truncated = false

  while (pending.length > 0) {
    const current = strategy === BEHAVIORAL_FRONTIER_STRATEGIES.bfs ? pending.shift()! : pending.pop()!
    const key = JSON.stringify(current)

    if (visited.has(key)) {
      continue
    }
    visited.add(key)

    const { frontier, pending: currentPending } = replayToFrontier({ specs, snapshotMessages: current })
    const step = countSelectionSnapshots({ snapshotMessages: current })
    const frontierSnapshot = createFrontierSnapshot({ frontier, step })

    traces.push({
      snapshotMessages: [...current, frontierSnapshot],
    })

    const requestSuccessors = getRequestSuccessors({
      frontier,
      selectionPolicy,
      step,
    })
    const triggerSuccessors = getTriggerSuccessors({
      pending: currentPending,
      snapshotMessages: current,
      specs,
      step,
      triggers,
    })
    const successors = [...requestSuccessors, ...triggerSuccessors]

    if (frontier.status === FRONTIER_STATUS.deadlock && triggerSuccessors.length === 0) {
      findings.push({
        code: 'deadlock',
        snapshotMessages: [...current, frontierSnapshot, createDeadlockSnapshot({ step })],
      })
    }

    if (maxDepth !== undefined && step >= maxDepth) {
      if (successors.length > 0) {
        truncated = true
      }
      continue
    }

    for (const successor of successors) {
      pending.push([...current, successor])
    }
  }

  return {
    traces,
    findings,
    report: {
      strategy,
      selectionPolicy,
      visitedCount: traces.length,
      findingCount: findings.length,
      truncated,
      ...(maxDepth === undefined ? {} : { maxDepth }),
    },
  }
}
