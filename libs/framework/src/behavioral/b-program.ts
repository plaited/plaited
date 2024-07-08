import { isTypeOf } from '@plaited/utils'
import {
  CandidateBid,
  Devtool,
  Feedback,
  BPListener,
  PendingBid,
  RunningBid,
  BPEvent,
  Trigger,
  BPEventTemplate,
  AddThreads,
  BProgram,
} from './types.js'
import { triggerWaitFor, isListeningFor, isPendingRequest, createPublisher, ensureArray } from './private-utils.js'
import { thread, sync, loop } from './rules.js'
/**
 * Creates a behavioral program that manages the execution of behavioral threads.
 *
 * @template T The type of the devtool's output.
 * @param {Devtool<T>} devtool - An optional devtool function or true to use default event log callback. It receives a stream of event selection snapshots.
 * @returns {Object} An object containing methods for managing the program and executing behavioral threads.
 */
export const bProgram: BProgram = <T>(devtool?: Devtool<T>) => {
  const pending = new Set<PendingBid>()
  const running = new Set<RunningBid>()
  const actionPublisher = createPublisher<BPEvent>()
  const snapshotPublisher = devtool && createPublisher<T>()
  function run() {
    running.size && step()
  }

  function step() {
    for (const bid of running) {
      const { generator, priority, thread, trigger } = bid
      const { value, done } = generator.next()
      !done &&
        pending.add({
          thread,
          priority,
          ...(trigger && { trigger }),
          generator,
          ...value,
        })
      running.delete(bid)
    }
    selectNextEvent()
  }
  // Select next event
  function selectNextEvent() {
    const blocked: BPListener[] = []
    const candidates: CandidateBid[] = []
    for (const { request, priority, block, thread, trigger } of pending) {
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
      snapshotPublisher && snapshotPublisher(devtool({ candidates, selectedEvent, pending }))
      nextStep(selectedEvent)
    }
  }
  // Queue up bids for next step of super step
  function nextStep(selectedEvent: CandidateBid) {
    for (const bid of pending) {
      const { waitFor, request, generator } = bid
      if (!generator) continue

      if (
        // Is a pending a event the selectedEvent
        (request && isPendingRequest(selectedEvent, request)) ||
        // Are we waiting for selectedEvent
        ensureArray(waitFor).some(isListeningFor(selectedEvent))
      ) {
        running.add(bid)
        pending.delete(bid)
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
    running.add({
      thread: request.type,
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

  const addThreads: AddThreads = (threads) => {
    for (const thread in threads) {
      running.add({
        thread,
        priority: running.size + 1,
        generator: threads[thread](),
      })
    }
  }

  if (snapshotPublisher) snapshotPublisher.subscribe((data) => devtool.callback(data))

  return Object.freeze({
    /** add thread function to behavioral program */
    addThreads,
    /** connect action function to behavioral program */
    feedback,
    /** trigger a run and event on behavioral program */
    trigger,
    thread,
    sync,
    loop,
  })
}
