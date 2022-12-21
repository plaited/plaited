import { streamEvents } from './constants.js'
import { stateChart } from './state-chart.js'
import { createStream } from './create-stream.js'
import { priorityStrategy } from './strategies.js'
import {
  CandidateBid,
  RunningBid,
  PendingBid,
  Strategy,
  CreatedStream,
  ListenerMessage,
  FeedbackMessage,
  RulesFunc,
  RuleParameterValue,
  TriggerArgs,
} from './types'


export class Plait {
  // Check if requested event is in the Parameter (waitFor, request, block)
  static requestInParameter({ eventName: requestEventName, payload: requestPayload }: CandidateBid) {
    return ({ eventName: parameterEventName, callback: parameterCallback }: RuleParameterValue): boolean => (
      parameterCallback
        ? parameterCallback({ payload: requestPayload, eventName: requestEventName })
        : requestEventName === parameterEventName
    )
  }
  #eventSelectionStrategy: Strategy
  #pending = new Set<PendingBid>()
  #running = new Set<RunningBid>()
  #lastEvent: CandidateBid = {} as CandidateBid
  stream: CreatedStream
  #dev?: boolean
  constructor(
    strands: Record<string, RulesFunc>,
    { strategy = priorityStrategy, dev = false }:
      { strategy?: Strategy; dev?: boolean; } = {}
  ) {
    this.#eventSelectionStrategy = strategy
    this.#dev = dev
    this.stream = createStream()
    this.trigger = this.trigger.bind(this)
    this.feedback = this.feedback.bind(this)
    this.add = this.add.bind(this)
    this.add(strands)
  }
  #run(): void {
    this.#running.size && this.#step()
  }
  #step(): void {
    for (const bid of this.#running) {
      const { logicStrand, priority, strandName } = bid
      const { value, done } = logicStrand.next()
      !done &&
        this.#pending.add({
          strandName,
          priority,
          logicStrand,
          ...value,
        })
      this.#running.delete(bid)
    }
    const pending = [ ...this.#pending ]
    const candidates = pending.reduce<CandidateBid[]>(
      (acc, { request, priority }) => acc.concat(
        // Flatten bids' request arrays
        request ? request.map(
          event => ({ priority, ...event }) // create candidates for each request with current bids priority
        ) : []
      ),
      []
    )
    const blocked = pending.flatMap<RuleParameterValue>(({ block }) => block || [])
    const filteredBids = candidates.filter(
      request => !blocked.some(Plait.requestInParameter(request))
    )
    this.#lastEvent = this.#eventSelectionStrategy(filteredBids)
    this.#dev && this.stream(stateChart({ candidates, blocked, pending }))
    this.#lastEvent && this.#nextStep()
  }
  #nextStep(): void {
    for (const bid of this.#pending) {
      const { request = [], waitFor = [], logicStrand } = bid
      const waitList = [ ...request, ...waitFor ]
      if (waitList.some(Plait.requestInParameter(this.#lastEvent)) && logicStrand) {
        this.#running.add(bid)
        this.#pending.delete(bid)
      }
    }
    const { eventName, payload } = this.#lastEvent
    this.stream({
      streamEvent: streamEvents.select,
      eventName,
      payload,
    })
    this.#run()
  }
  trigger({
    eventName, payload, baseDynamic,
  }: TriggerArgs): void {
    const logicStrand = function* () {
      yield {
        request: [ { eventName, payload } ],
        waitFor: [ { eventName: '', callback: () => true } ],
      }
    }
    this.#running.add({
      strandName: `Trigger(${eventName})`,
      priority: 0,
      logicStrand: logicStrand(),
    })
    this.#dev && this.stream({
      streamEvent: streamEvents.trigger,
      baseDynamic,
      eventName: `Trigger(${eventName})`,
      payload,
    })
    this.#run()
  }
  feedback(actions: Record<string, (payload?: any) => void>): CreatedStream {
    return this.stream.subscribe(({ streamEvent, ...rest }: ListenerMessage) => {
      if (streamEvent !== streamEvents.select) return
      const { eventName, payload } = rest as FeedbackMessage
      actions[eventName] && actions[eventName](payload)
    })
  }
  add(logicStands: Record<string, RulesFunc>): void {
    for (const strandName in logicStands)
      this.#running.add({
        strandName,
        priority: this.#running.size + 1,
        logicStrand: logicStands[strandName](),
      })
  }
}
