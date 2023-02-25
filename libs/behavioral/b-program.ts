import { strategies, streamEvents } from './constants.ts'
import { stateSnapshot } from './state-snapshot.ts'
import { createStream } from './create-stream.ts'
import { selectionStrategies } from './selection-strategies.ts'
import {
  CandidateBid,
  Feedback,
  ListenerMessage,
  LogCallback,
  ParameterIdiom,
  PendingBid,
  RulesFunc,
  RunningBid,
  Strategy,
  Trigger,
} from './types.ts'

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
  dev = false,
}: {
  strategy?: Strategy | keyof Omit<typeof strategies, 'custom'>
  dev?: boolean
}) => {
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
      const { bThread, priority, name } = bid
      const { value, done } = bThread.next()
      !done &&
        pending.add({
          name,
          priority,
          bThread,
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
      dev && stream({
        type: streamEvents.snapshot,
        data: stateSnapshot({ bids, selectedEvent }),
      })
      const { priority: _p, cb: _a, ...detail } = selectedEvent
      stream({
        type: streamEvents.select,
        data: detail,
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
      const { request = [], waitFor = [], bThread } = bid
      const waitList = [
        ...(Array.isArray(request) ? request : [request]),
        ...(Array.isArray(waitFor) ? waitFor : [waitFor]),
      ]
      if (
        waitList.some(requestInParameter(selectedEvent)) && bThread
      ) {
        running.add(bid)
        pending.delete(bid)
      }
    }
    run()
  }
  const trigger: Trigger = ({
    event,
    detail = {},
  }) => {
    const bThread = function* () {
      yield {
        request: [{ event, detail }],
        waitFor: [{ event: '', cb: () => true }],
      }
    }
    running.add({
      name: event,
      priority: 0,
      bThread: bThread(),
    })
    if (dev) {
      const msg: ListenerMessage = {
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
      ({ type, data }: ListenerMessage) => {
        if (type !== streamEvents.select) return
        const { event: key, detail = {} } = data
        type &&
          Object.hasOwn(actions, key) &&
          actions[key](detail)
      },
    )
  }

  const add = (logicStands: Record<string, RulesFunc>): void => {
    for (const name in logicStands) {
      running.add({
        name,
        priority: running.size + 1,
        bThread: logicStands[name](),
      })
    }
  }

  const log = (callback: LogCallback) => {
    stream.subscribe(
      ({ type, data }: ListenerMessage) => {
        if (type === streamEvents.trigger) {
          callback({ type, data })
        }
        if (type === streamEvents.snapshot) {
          callback({ type, data })
        }
        if (type === streamEvents.end) {
          callback({ type, data })
        }
      },
    )
  }
  return Object.freeze({
    /** add rule function to behavioral program */
    add,
    /** connect action function to behavioral program */
    feedback,
    /** trigger a run and event on behavioral program */
    trigger,
    /** reactive stream for logging selected events, state snapshots, and trigger events */
    log,
  })
}
