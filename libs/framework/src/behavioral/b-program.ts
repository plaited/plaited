import { isTypeOf } from '@plaited/utils'
import type {
  CandidateBid,
  SnapshotMessage,
  Feedback,
  BPListener,
  PendingBid,
  RunningBid,
  BPEvent,
  Trigger,
  BPEventTemplate,
  Rules,
  BProgram,
  Snapshot
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
      const { waitFor, request, generator } = bid
      if (!generator) continue

      if (
        // Is a pending a event the selectedEvent
        (request && isPendingRequest(selectedEvent, request)) ||
        // Are we waiting for selectedEvent
        ensureArray(waitFor).some(isListeningFor(selectedEvent))
      ) {
        running.set(thread, bid)
        pending.delete(thread)
      }
    }
    // To avoid infinite loop with calling trigger from feedback always publish select event
    // after checking if request(s) is waitList and before our next run
    actionPublisher({ type: selectedEvent.type, detail: selectedEvent.detail })
    run()
  }

  const trigger: Trigger = (request, triggerType) => {
    const thread = function* () {
      yield {
        request,
        waitFor: [triggerWaitFor],
      }
    }
    running.set(request.type, {
      priority: 0,
      trigger: triggerType ?? true,
      generator: thread(),
    })
    run()
  }

  const feedback: Feedback = (actions) => {
    actionPublisher.subscribe((data: BPEvent) => {
      const { type, detail = {} } = data
      if (Object.hasOwn(actions, type)) {
        void actions[type](detail)
      }
    })
  }

  const rules: Rules = {
    set: (threads) => {
      for (const thread in threads) {
        running.set(thread, {
          priority: running.size + 1,
          generator: threads[thread](),
        })
      }
    },
    has: (thread) => running.has(thread) || pending.has(thread),
    clear: () => {
      running.clear()
      pending.clear()
    },
    delete: (thread) => running.delete(thread) || pending.delete(thread),
  }

  const snapshot: Snapshot = listener => {
    if(snapshotPublisher === undefined) (snapshotPublisher = createPublisher<SnapshotMessage>())
    return snapshotPublisher.subscribe(listener)
  }

  return Object.freeze({
    /** add and delete rules functions of behavioral program */
    rules,
    /** connect action function to behavioral program */
    feedback,
    /** trigger a run and event on behavioral program */
    trigger,
    /** connect a listener that receives state snapshots for each step of a running behavioral program */
    snapshot,
  })
}
