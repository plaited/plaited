/* eslint-disable @typescript-eslint/no-use-before-define */
// import { stateSnapshot } from './state-snapshot.js'
import { ensureArray, isTypeOf } from '@plaited/utils'
import { priorityStrategy } from './selection-strategies.js'
import { publisher } from './publisher.js'
import {
  CandidateBid,
  DevCallback,
  Feedback,
  Parameter,
  PendingBid,
  RulesFunc,
  RunningBid,
  BPEvent,
  SnapshotMessage,
  Strategy,
  Trigger,
  BPEventTemplate,
} from './types.js'
import { loop, sync, thread } from './rules.js'
import { triggerWaitFor, log, isInParameter, isPendingRequest } from './utils.js'



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
  const snapshotPublisher = dev && publisher<SnapshotMessage>()
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
    const blocked: Parameter[] = []
    const candidates: CandidateBid[] = []
    for (const bid of pending) {
      const { request, priority, block, thread } = bid
      block && blocked.push(...ensureArray(block))
      if (request) {
        Array.isArray(request) ?
          candidates.push(
            ...request.map(
              (event) => ({ priority, thread,  ...(isTypeOf<BPEventTemplate>(event, 'function') ? {template: event, ...event()} : event) }), // create candidates for each request with current bids priority
            ),
          )
        : candidates.push({ priority, thread, ...(isTypeOf<BPEventTemplate>(request, 'function') ? {template: request, ...request()} : request) })
      }
    }
    const filteredBids: CandidateBid[] = []
    const length = candidates.length
    for (let i = 0; i < length; i++) {
      const candidate = candidates[i]
       // Checking if candidate is in block Parameter
      if (!blocked.some(isInParameter(candidate))) {
        filteredBids.push(candidate)
      }
    }
    const selectedEvent = strategy(filteredBids)
    if (selectedEvent) {
      // snapshotPublisher && snapshotPublisher(stateSnapshot({ bids: [...pending], selectedEvent }))
      nextStep(selectedEvent)
    }
  }
  // Queue up bids for next step of super step
  function nextStep(selectedEvent: CandidateBid) {
    for (const bid of pending) {
      if (!bid.generator) continue
      if (
        // Checking if pending event is selectedEvent
        ensureArray(bid.request).some(isPendingRequest(selectedEvent)) ||
        // Checking if selectedEvent is in waitFor Parameter
        ensureArray(bid.waitFor).some(isInParameter(selectedEvent))
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
  
  const trigger: Trigger = ({ type, detail }) => {
    const thread = function* () {
      yield {
        request: [{ type, detail }],
        waitFor: [triggerWaitFor],
      }
    }
    running.add({
      thread: type,
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

  snapshotPublisher && snapshotPublisher.subscribe((data: SnapshotMessage) => dev(data))

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
