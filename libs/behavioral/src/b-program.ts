/* eslint-disable @typescript-eslint/no-use-before-define */
import { selectionSnapshot } from './selection-snapshot.js'
import { ensureArray, isTypeOf } from '@plaited/utils'
import { priorityStrategy } from './public-utils.js'
import { publisher } from './publisher.js'
import {
  CandidateBid,
  DevCallback,
  Feedback,
  BPListener,
  PendingBid,
  RulesFunc,
  RunningBid,
  BPEvent,
  SelectionSnapshot,
  Strategy,
  Trigger,
  BPEventTemplate,
} from './types.js'
import { loop, sync, thread } from './rules.js'
import { triggerWaitFor, log, isListeningFor, isPendingRequest } from './utils.js'

/**
 * Creates a behavioral program that manages the execution of behavioral threads.
 * @param options An object containing optional parameters for the program.
 * @param options.strategy The event selection strategy to use. Defaults to `strategies.priority`.
 * @param options.dev A callback function that receives a stream of state snapshots, last selected event, and trigger.
 * @returns An object containing methods for managing the program and executing behavioral threads.
 */
export const bProgram = ({
  /** event selection strategy {@link Strategy}*/
  strategy = priorityStrategy,
  /** When set to true returns a stream with log of state snapshots, last selected event and trigger */
  dev: _dev,
}: {
  strategy?: Strategy
  dev?: DevCallback | true
} = {}) => {
  const dev = _dev === true ? log : _dev
  const pending = new Set<PendingBid>()
  const running = new Set<RunningBid>()
  const actionPublisher = publisher<BPEvent>()
  const snapshotPublisher = dev && publisher<ReturnType<SelectionSnapshot>>()
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
    for (const bid of pending) {
      const { request, priority, block, thread } = bid
      block && blocked.push(...ensureArray(block))
      request &&
        candidates.push({
          priority,
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
    const selectedEvent = strategy(filteredBids)
    if (selectedEvent) {
      snapshotPublisher && snapshotPublisher(selectionSnapshot({ candidates, selectedEvent, pending }))
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

  const trigger: Trigger = (request) => {
    const thread = function* () {
      yield {
        request,
        waitFor: [triggerWaitFor],
      }
    }
    running.add({
      thread: request.type,
      priority: 0,
      trigger: true,
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

  const addThreads = (threads: Record<string, RulesFunc>): void => {
    for (const thread in threads) {
      running.add({
        thread,
        priority: running.size + 1,
        generator: threads[thread](),
      })
    }
  }

  snapshotPublisher && snapshotPublisher.subscribe((data) => dev(data))

  return Object.freeze({
    /** add thread function to behavioral program */
    addThreads,
    /** connect action function to behavioral program */
    feedback,
    /** trigger a run and event on behavioral program */
    trigger,
    /**
     * A behavioral thread that loops infinitely or until some callback condition is false
     * like a mode change open -> close. This function returns a threads
     */
    loop,
    /**
     * At synchronization points, each behavioral thread specifies three sets of events:
     * requested events: the threads proposes that these be considered for triggering,
     * and asks to be notified when any of them occurs; waitFor events: the threads does not request these, but
     * asks to be notified when any of them is triggered; and blocked events: the
     * threads currently forbids triggering
     * any of these events.
     */
    sync,
    /**
     * creates a behavioral thread from synchronization sets and/or other  behavioral threads
     */
    thread,
  })
}
