import { strategies } from './constants.js'
import { stateSnapshot } from './state-snapshot.js'
import { publisher } from '@plaited/utils'
import { selectionStrategies } from './selection-strategies.js'
import {
  CandidateBid,
  DevCallback,
  Feedback,
  ParameterIdiom,
  PendingBid,
  RulesFunc,
  RunningBid,
  SelectedMessage,
  SnapshotMessage,
  Strategy,
  Trigger,
} from './types.js'
import { loop, sync, thread } from './rules.js'

const requestInParameter = (
  { type: requestEventName, detail: requestDetail = {} }: CandidateBid
) => {
  return (
    {
      type: parameterEventName,
      cb: parameterAssertion,
    }: ParameterIdiom
  ): boolean => (
    parameterAssertion
      ? parameterAssertion({
        detail: requestDetail,
        type: requestEventName,
      })
      : requestEventName === parameterEventName
  )
}

export const bProgram = ({
  /** event selection strategy {@link Strategy}*/
  strategy = strategies.priority,
  /** When set to true returns a stream with log of state snapshots, last selected event and trigger */
  dev,
}: {
  strategy?: Strategy | keyof Omit<typeof strategies, 'custom'>
  dev?: DevCallback
} = {}) => {
  const eventSelectionStrategy: Strategy = typeof strategy === 'string'
    ? selectionStrategies[strategy]
    : strategy
  const pending = new Set<PendingBid>()
  const running = new Set<RunningBid>()
  const actionPublisher = publisher<SelectedMessage>()
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
    const bids = [ ...pending ]
    let candidates: CandidateBid[] = []
    for (const { request, priority } of bids) {
      if (Array.isArray(request)) {
        candidates = candidates.concat(request.map(
          event => ({ priority, ...event }) // create candidates for each request with current bids priority
        ))
        continue
      }
      if (request) {
        candidates.push({ priority, ...request }) // create candidates for each request with current bids priority
      }
    }
    const blocked = bids.flatMap<ParameterIdiom>(({ block }) => block || [])

    const filteredBids: CandidateBid[] | never[] = candidates.filter(
      request => !blocked.some(requestInParameter(request))
    )
    const selectedEvent = eventSelectionStrategy(filteredBids)
    if (selectedEvent) {
      dev && snapshotPublisher &&
        snapshotPublisher(stateSnapshot({ bids, selectedEvent }))
      nextStep(selectedEvent)
    }
  }
  // Queue up bids for next step of super step
  function nextStep(selectedEvent: CandidateBid) {
    for (const bid of pending) {
      const { request = [], waitFor = [], generator } = bid
      const waitList = [
        ...(Array.isArray(request) ? request : [ request ]),
        ...(Array.isArray(waitFor) ? waitFor : [ waitFor ]),
      ]
      if (
        waitList.some(requestInParameter(selectedEvent)) && generator
      ) {
        running.add(bid)
        pending.delete(bid)
      }
    }
    const { priority: _p, cb: _cb, ...detail } = selectedEvent
    // To avoid infinite loop with calling trigger from feedback always stream select event
    // checking if the request is in the parameter which can be a waitFor or pending request
    actionPublisher(detail)
    run()
  }
  const trigger: Trigger = ({
    type,
    detail,
  }) => {
    const thread = function* () {
      yield {
        request: [ { type, detail } ],
        waitFor: [ { type: '', cb: () => true } ],
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

  const feedback: Feedback = actions => {
    actionPublisher.subscribe(
      (data: SelectedMessage) => {
        const { type, detail = {} } = data
        Object.hasOwn(actions, type) &&
          actions[type](detail)
      }
    )
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

  if (dev && snapshotPublisher) {
    snapshotPublisher.subscribe(
      (data: SnapshotMessage) => dev(data)
    )
  }

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
