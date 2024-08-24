import { isTypeOf } from '@plaited/utils'
import type {
  CandidateBid,
  SnapshotMessage,
  UseFeedback,
  BPListener,
  PendingBid,
  RunningBid,
  BPEvent,
  Trigger,
  BPEventTemplate,
  BProgram,
  BThreads,
  UseSnapshot,
} from './types.js'
import { triggerWaitFor, isListeningFor, isPendingRequest, createPublisher, ensureArray } from './private-utils.js'
import { snapshotFormatter } from './snapshot-formatter.js'

/**
 * Creates a behavioral program that manages the execution of behavioral threads.
 */
export const bProgram: BProgram = () => {
  const pending = new Map<string, PendingBid>()
  const running = new Map<string, RunningBid>()

  const actionPublisher = createPublisher<BPEvent>()
  let snapshotPublisher: {
    (value: SnapshotMessage): void;
    subscribe(listener: (msg: SnapshotMessage) => void | Promise<void>): () => void;
  } | undefined
  function run() {
    running.size && step()
  }

  function step() {
    for (const [thread, bid] of running) {
      const { generator, priority, trigger } = bid
      const { value, done } = generator.next()
      !done &&
        pending.set(thread, {
          priority,
          ...(trigger && { trigger }),
          generator,
          ...value,
        })
      running.delete(thread)
    }
    selectNextEvent()
  }
  // Select next event
  function selectNextEvent() {
    const blocked: BPListener[] = []
    const candidates: CandidateBid[] = []
    for (const [thread, { request, priority, block, trigger }] of pending) {
      block && blocked.push(...ensureArray(block))
      request &&
        candidates.push({
          priority,
          trigger,
          thread,
          ...(isTypeOf<BPEventTemplate>(request, 'function') ? { template: request, ...request() } : request),
        })
    }
    const filteredBids: CandidateBid[] = []
    const length = candidates.length
    for (let i = 0; i < length; i++) {
      const candidate = candidates[i]
      // Are we blocking the the candidate event
      if (!blocked.some(isListeningFor(candidate))) {
        filteredBids.push(candidate)
      }
    }
    /** @description Priority Queue BPEvent Selection Strategy */
    const selectedEvent = filteredBids.sort(
      ({ priority: priorityA }, { priority: priorityB }) => priorityA - priorityB,
    )[0]
    if (selectedEvent) {
      snapshotPublisher && snapshotPublisher(snapshotFormatter({ candidates, selectedEvent, pending }))
      nextStep(selectedEvent)
    }
  }
  // Queue up bids for next step of super step
  function nextStep(selectedEvent: CandidateBid) {
    for (const [thread, bid] of pending) {
      const { waitFor, request, generator, interrupt } = bid
      const isInterrupted = ensureArray(interrupt).some(isListeningFor(selectedEvent))
      const isWaitedFor = ensureArray(waitFor).some(isListeningFor(selectedEvent))
      const hasPendingRequest = request && isPendingRequest(selectedEvent, request)
      isInterrupted && generator.return?.()
      if (hasPendingRequest || isInterrupted || isWaitedFor) {
          running.set(thread, bid)
          pending.delete(thread)
      }
    }
    // To avoid infinite loop with calling trigger from feedback always publish select event
    // after checking if request(s) is waitList and before our next run
    actionPublisher({ type: selectedEvent.type, detail: selectedEvent.detail })
    run()
  }

  const trigger: Trigger = (request) => {
    const thread = function* () {
      yield {
        request,
        waitFor: [triggerWaitFor],
      }
    }
    running.set(request.type, {
      priority: 0,
      trigger:  true,
      generator: thread(),
    })
    run()
  }

  const useFeedback: UseFeedback = (actions) => {
   const disconnect = actionPublisher.subscribe((data: BPEvent) => {
      const { type, detail = {} } = data
      if (Object.hasOwn(actions, type)) {
        void actions[type](detail)
      }
    })
    return disconnect
  }

  const bThreads: BThreads = {
    set: (threads) => {
      for (const thread in threads) {
        running.set(thread, {
          priority: running.size + 1,
          generator: threads[thread](),
        })
      }
    },
    has: (thread) => ({running: running.has(thread), pending: pending.has(thread)}),
  }

  const useSnapshot: UseSnapshot = listener => {
    if(snapshotPublisher === undefined) (snapshotPublisher = createPublisher<SnapshotMessage>())
    return snapshotPublisher.subscribe(listener)
  }

  return Object.freeze({
    /** add threads functions to behavioral program and verify if there still active */
    bThreads,
    /** trigger a run and event on behavioral program */
    trigger,
    /** connect action function to behavioral program */
    useFeedback,
    /** connect a listener that receives state snapshots for each step of a running behavioral program */
    useSnapshot,
  })
}
