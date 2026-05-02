import type {
  CandidateBid,
  PendingBid,
  ReplayToFrontierResult,
  RunningBid,
  SnapshotEvent,
  SnapshotMessage,
  Spec,
} from '../behavioral.ts'
import {
  advanceRunningToPending,
  computeFrontier,
  resumePendingThreadsForSelectedEvent,
  useSpec,
} from '../behavioral.ts'
import { deepEqual } from '../utils/deep-equal.ts'

const matchesSelectedEvent = ({ candidate, selected }: { candidate: CandidateBid; selected: SnapshotEvent }) =>
  candidate.type === selected.type && deepEqual(candidate.detail, selected.detail)

const addIngressTriggerToPending = ({ pending, selected }: { pending: Set<PendingBid>; selected: SnapshotEvent }) => {
  const triggerThread = function* () {
    yield {
      request: {
        type: selected.type,
        ...(selected.detail === undefined ? {} : { detail: selected.detail }),
      },
    }
  }
  const generator = triggerThread()
  const yielded = generator.next()

  if (!yielded.done) {
    pending.add({
      priority: 0,
      generator,
      ingress: true,
      label: selected.type,
      ...yielded.value,
    })
  }
}

const getSelectedEvents = ({ snapshotMessages }: { snapshotMessages: SnapshotMessage[] }) =>
  snapshotMessages.flatMap((snapshot) => (snapshot.kind === 'selection' ? [snapshot.selected] : []))

export const replayToFrontier = ({
  specs,
  snapshotMessages,
}: {
  specs: Spec[]
  snapshotMessages: SnapshotMessage[]
}): ReplayToFrontierResult => {
  const pending = new Set<PendingBid>()
  const running = new Set<RunningBid>()

  for (const [index, spec] of specs.entries()) {
    const [label, thread] = useSpec(spec)
    running.add({
      priority: index + 1,
      generator: thread(),
      label,
    })
  }

  advanceRunningToPending(running, pending)

  for (const [step, selected] of getSelectedEvents({ snapshotMessages }).entries()) {
    if (selected.ingress === true) {
      addIngressTriggerToPending({ pending, selected })
    }

    const frontier = computeFrontier({ pending })
    const enabled = [...frontier.enabled].sort((left, right) => left.priority - right.priority)
    const matched = enabled.find((candidate) => matchesSelectedEvent({ candidate, selected }))

    if (!matched) {
      throw new Error(`Selected event "${selected.type}" was not enabled at replay step ${step}.`)
    }

    const resumed = new Set<RunningBid>()
    resumePendingThreadsForSelectedEvent({
      running: resumed,
      pending,
      selectedEvent: matched,
    })
    advanceRunningToPending(resumed, pending)
  }

  return {
    pending,
    frontier: computeFrontier({ pending }),
  }
}
