import { strategies, streamEvents } from './constants.ts'
import { stateSnapshot } from './state-snapshot.ts'
import { createStream } from './create-stream.ts'
import { selectionStrategies } from './selection-strategies.ts'
import {
  CandidateBid,
  Feedback,
  Logger,
  ParameterIdiom,
  PendingBid,
  RulesFunc,
  RunningBid,
  Strategy,
  StreamMessage,
  Trigger,
} from './types.ts'
import { loop, sync, thread } from './rules.ts'

const requestInParameter = (
  { event: requestEventName, detail: requestDetail = {} }: CandidateBid,
) => {
  return (
    {
      event: parameterEventName,
      cb: parameterAssertion,
    }: ParameterIdiom,
  ): boolean => (
    parameterAssertion
      ? parameterAssertion({
        detail: requestDetail,
        event: requestEventName,
      })
      : requestEventName === parameterEventName
  )
}

export const bProgram = ({
  /** event selection strategy {@link Strategy}*/
  strategy = strategies.priority,
  /** When set to true returns a stream with log of state snapshots, last selected event and trigger */
  logger,
}: {
  strategy?: Strategy | keyof Omit<typeof strategies, 'custom'>
  logger?: Logger
} = {}) => {
  const eventSelectionStrategy: Strategy = typeof strategy === 'string'
    ? selectionStrategies[strategy]
    : strategy
  const pending = new Set<PendingBid>()
  const running = new Set<RunningBid>()
  const stream = createStream()

  function run() {
    running.size && step()
  }

  function step() {
    for (const bid of running) {
      const { generator, priority, thread } = bid
      const { value, done } = generator.next()
      !done &&
        pending.add({
          thread,
          priority,
          generator,
          ...value,
        })
      running.delete(bid)
    }
    selectNextEvent()
  }
  // Select next event
  function selectNextEvent() {
    const bids = [...pending]
    const candidates = bids.reduce<CandidateBid[]>(
      (acc, { request, priority }) =>
        acc.concat(
          // Flatten bids' request arrays
          request && Array.isArray(request)
            ? request.map(
              (event) => ({ priority, ...event }), // create candidates for each request with current bids priority
            )
            : request
            ? [{ priority, ...request }]
            : [],
        ),
      [],
    )
    const blocked = bids.flatMap<ParameterIdiom>(({ block }) => block || [])

    const filteredBids: CandidateBid[] | never[] = candidates.filter(
      (request) => !blocked.some(requestInParameter(request)),
    )
    const selectedEvent = eventSelectionStrategy(filteredBids)
    if (selectedEvent) {
      logger && stream({
        type: streamEvents.snapshot,
        data: stateSnapshot({ bids, selectedEvent }),
      })
      nextStep(selectedEvent)
    } else {
      stream({
        type: streamEvents.end,
        data: {
          strategy: typeof strategy === 'string' ? strategy : strategies.custom,
        },
      })
    }
  }
  // Queue up bids for next step of super step
  function nextStep(selectedEvent: CandidateBid) {
    for (const bid of pending) {
      const { request = [], waitFor = [], generator } = bid
      const waitList = [
        ...(Array.isArray(request) ? request : [request]),
        ...(Array.isArray(waitFor) ? waitFor : [waitFor]),
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
    stream({
      type: streamEvents.select,
      data: detail,
    })
    run()
  }
  const trigger: Trigger = ({
    event,
    detail,
  }) => {
    const thread = function* () {
      yield {
        request: [{ event, detail }],
        waitFor: [{ event: '', cb: () => true }],
      }
    }
    running.add({
      thread: event,
      priority: 0,
      generator: thread(),
    })
    if (logger) {
      const msg: StreamMessage = {
        type: streamEvents.trigger,
        data: {
          event: event,
        },
      }
      detail && Object.assign(msg.data, { detail })
      stream(msg)
    }
    run()
  }

  const feedback: Feedback = (
    actions,
  ) => {
    stream.subscribe(
      ({ type, data }: StreamMessage) => {
        if (type !== streamEvents.select) return
        const { event: key, detail = {} } = data
        type &&
          Object.hasOwn(actions, key) &&
          actions[key](detail)
      },
    )
  }

  const addRules = (threads: Record<string, RulesFunc>): void => {
    for (const thread in threads) {
      running.add({
        thread,
        priority: running.size + 1,
        generator: threads[thread](),
      })
    }
  }

  if (logger) {
    stream.subscribe(
      ({ type, data }: StreamMessage) => {
        if (type === streamEvents.trigger) {
          logger({ type, data })
        }
        if (type === streamEvents.snapshot) {
          logger({ type, data })
        }
        if (type === streamEvents.end) {
          logger({ type, data })
        }
      },
    )
  }

  return Object.freeze({
    /** add thread function to behavioral program */
    addRules,
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
