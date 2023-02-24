import { streamEvents } from './constants.ts'
import { stateChart } from './state-chart.ts'
import { createStream } from './create-stream.ts'
import { priorityStrategy } from './strategies.ts'
import {
  CandidateBid,
  Feedback,
  ListenerMessage,
  ParameterIdiom,
  PendingBid,
  RulesFunc,
  RunningBid,
  Strategy,
  Trigger,
} from './types.ts'

const requestInParameter = (
  { event: requestEventName, payload: requestPayload }: CandidateBid,
) => {
  return (
    {
      event: parameterEventName,
      assert: parameterAssertion,
    }: ParameterIdiom,
  ): boolean => (
    parameterAssertion
      ? parameterAssertion({
        payload: requestPayload,
        event: requestEventName,
      })
      : requestEventName === parameterEventName
  )
}

export const bProgram = ({
  /** event selection strategy {@link Strategy}*/
  strategy: eventSelectionStrategy = priorityStrategy,
  /** When set to true returns a stream with log of state snapshots, last selected event and trigger */
  dev = false,
}: {
  strategy?: Strategy
  dev?: boolean
}) => {
  const pending = new Set<PendingBid>()
  const running = new Set<RunningBid>()
  let lastEvent: CandidateBid
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
    const _pending = [...pending]
    const candidates = _pending.reduce<CandidateBid[]>(
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
    const blocked = _pending.flatMap<ParameterIdiom>(({ block }) => block || [])
    const filteredBids = candidates.filter(
      (request) => !blocked.some(requestInParameter(request)),
    )
    dev && stream({
      type: streamEvents.state,
      detail: stateChart({ candidates, blocked, pending: _pending }),
    })
    lastEvent = eventSelectionStrategy(filteredBids)
    lastEvent && nextStep()
  }
  function nextStep() {
    const { priority: _p, assert: _a, ...detail } = lastEvent
    stream({
      type: streamEvents.select,
      detail,
    })
    for (const bid of pending) {
      const { request = [], waitFor = [], bThread } = bid
      const waitList = [
        ...(Array.isArray(request) ? request : [request]),
        ...(Array.isArray(waitFor) ? waitFor : [waitFor]),
      ]
      if (
        waitList.some(requestInParameter(lastEvent)) && bThread
      ) {
        running.add(bid)
        pending.delete(bid)
      }
    }
    run()
  }
  const trigger: Trigger = ({
    event,
    payload,
  }) => {
    const bThread = function* () {
      yield {
        request: [{ event, payload }],
        waitFor: [{ event: '', assert: () => true }],
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
        detail: {
          event: event,
        },
      }
      payload && Object.assign(msg.detail, { payload })
      stream(msg)
    }
    run()
  }

  const feedback: Feedback = (
    actions,
  ) => {
    return stream.subscribe(
      ({ type, detail }: ListenerMessage) => {
        if (type !== streamEvents.select) return
        const { event: key, payload } = detail
        type &&
          Object.hasOwn(actions, key) &&
          actions[key](payload)
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
  const lastPayload = <T = unknown>(): T => lastEvent.payload as T
  return Object.freeze({
    /** add rule function to behavioral program */
    add,
    /** connect action function to behavioral program */
    feedback,
    /** trigger a run and event on behavioral program */
    trigger,
    /** reactive stream for capturing selected events, state snapshots, and trigger events */
    stream,
    /** a callback function to get the value of the last selected event's payload */
    lastPayload,
  })
}
