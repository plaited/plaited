import {streamEvents, baseDynamics} from './constants'
import {stateChart} from './stateChart'
import {createStream} from './createStream'
import {priorityStrategy} from './strategies'
import {
  ValueOf,
  CandidateBid,
  RunningBid,
  PendingBid,
  Strategy,
  CreatedStream,
  ListenerMessage,
  FeedbackMessage,
  RulesFunc,
  RuleParameterValue,
} from './types'

const requestInParameter = ({eventName: requestEventName, payload: requestPayload}: CandidateBid) => {
  return ({eventName: parameterEventName, callback: parameterCallback}: RuleParameterValue): boolean => (
    parameterCallback
      ? parameterCallback({payload: requestPayload, eventName: requestEventName})
      : requestEventName === parameterEventName
  )
}

export const track = (strands: Record<string, RulesFunc>,
  {strategy = priorityStrategy, dev = false}:
    { strategy?: Strategy; dev?: boolean; } = {},
) => {
  const pending = new Set<PendingBid>()
  const running = new Set<RunningBid>()
  let lastEvent: CandidateBid = {} as CandidateBid
  const stream = createStream()

  const nextStep = () => {
    for (const bid of pending) {
      const {request = [], waitFor = [], logicStrand} = bid
      const waitList = [...request, ...waitFor]
      if (waitList.some(requestInParameter(lastEvent)) && logicStrand) {
        running.add(bid)
        pending.delete(bid)
      }
    }
    const {eventName, payload} = lastEvent
    stream({
      streamEvent: streamEvents.select,
      eventName,
      payload,
    })
    run()
  }

  const step = () => {
    for (const bid of running) {
      const {logicStrand, priority, strandName} = bid
      const {value, done} = logicStrand.next()
      !done &&
        pending.add({
          strandName,
          priority,
          logicStrand,
          ...value,
        })
      running.delete(bid)
    }
    const nextPending = [...pending]
    const nextCandidates = nextPending.reduce<CandidateBid[]>(
      (acc, {request, priority}) => acc.concat(
        // Flatten bids' request arrays
        request ? request.map(
          event => ({priority, ...event}), // create candidates for each request with current bids priority
        ) : [],
      ),
      [],
    )
    const blocked = nextPending.flatMap<RuleParameterValue>(({block}) => block || [])
    const filteredBids = nextCandidates.filter(
      request => !blocked.some(requestInParameter(request)),
    )
    lastEvent = strategy(filteredBids)
    dev && stream(stateChart({candidates: nextCandidates, blocked, pending: nextPending}))
    lastEvent && nextStep()
  }

  function run(): void {
    running.size && step()
  }

  const feedback = (actions: Record<string, (payload?: any) => void>): CreatedStream => {
    return stream.subscribe(({streamEvent, ...rest}: ListenerMessage) => {
      if (streamEvent !== streamEvents.select) return
      const {eventName, payload} = rest as FeedbackMessage
      actions[eventName] && actions[eventName](payload)
    })
  }

  const add = (logicStands: Record<string, RulesFunc>): void => {
    for (const strandName in logicStands)
      running.add({
        strandName,
        priority: running.size + 1,
        logicStrand: logicStands[strandName](),
      })

  }

  add(strands)

  const trigger = ({
    eventName, payload, baseDynamic,
  }: {
    eventName: string;
    payload?: any;
    baseDynamic?: ValueOf<typeof baseDynamics>;
  }): void => {
    const logicStrand = function* () {
      yield {
        request: [{eventName, payload}],
        waitFor: [{eventName: '', callback: () => true}],
      }
    }
    running.add({
      strandName: `Trigger(${eventName})`,
      priority: 0,
      logicStrand: logicStrand(),
    })
    dev && stream({
      streamEvent: streamEvents.trigger,
      baseDynamic,
      eventName: `Trigger(${eventName})`,
      payload,
    })
    run()
  }
  return Object.freeze({add, feedback, trigger, stream})
}
