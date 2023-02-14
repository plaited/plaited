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
  { type: requestEventName, data: requestPayload }: CandidateBid,
) => {
  return (
    {
      type: parameterEventName,
      assert: parameterAssertion,
    }: ParameterIdiom,
  ): boolean => (
    parameterAssertion
      ? parameterAssertion({
        data: requestPayload,
        type: requestEventName,
      })
      : requestEventName === parameterEventName
  )
}

export const plait = ({
  /** event selection strategy */
  strategy: eventSelectionStrategy = priorityStrategy,
  /** returns a stream with log events when set to true */
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
      const { logicStrand, priority, strandName } = bid
      const { value, done } = logicStrand.next()
      !done &&
        pending.add({
          strandName,
          priority,
          logicStrand,
          ...value,
        })
      running.delete(bid)
    }
    const _pending = [...pending]
    const candidates = _pending.reduce<CandidateBid[]>(
      (acc, { request, priority }) =>
        acc.concat(
          // Flatten bids' request arrays
          request
            ? request.map(
              (event) => ({ priority, ...event }), // create candidates for each request with current bids priority
            )
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
      const { request = [], waitFor = [], logicStrand } = bid
      const waitList = [...request, ...waitFor]
      if (
        waitList.some(requestInParameter(lastEvent)) && logicStrand
      ) {
        running.add(bid)
        pending.delete(bid)
      }
    }
    run()
  }
  const trigger: Trigger = ({
    type,
    data,
  }) => {
    const logicStrand = function* () {
      yield {
        request: [{ type, data }],
        waitFor: [{ type: '', assert: () => true }],
      }
    }
    running.add({
      strandName: type,
      priority: 0,
      logicStrand: logicStrand(),
    })
    if (dev) {
      const msg: ListenerMessage = {
        type: streamEvents.trigger,
        detail: {
          type: type,
        },
      }
      data && Object.assign(msg.detail, { data })
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
        const { type: key, data } = detail
        type &&
          Object.hasOwn(actions, key) &&
          actions[key](data)
      },
    )
  }
  const add = (logicStands: Record<string, RulesFunc>): void => {
    for (const strandName in logicStands) {
      running.add({
        strandName,
        priority: running.size + 1,
        logicStrand: logicStands[strandName](),
      })
    }
  }
  return Object.freeze({
    add,
    feedback,
    trigger,
    stream,
    lastEvent() {
      return { type: lastEvent.type, data: lastEvent.data }
    },
  })
}
