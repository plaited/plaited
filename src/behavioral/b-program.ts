import type { BPEvent, BPEventTemplate, BPListener, Idioms, RulesFunction } from './b-thread.js'
import { isTypeOf } from '../utils/is-type-of.js'

type RunningBid = {
  trigger?: true | 'object' | 'person'
  priority: number
  generator: IterableIterator<Idioms>
}
type PendingBid = Idioms & RunningBid

type CandidateBid = {
  thread: string
  priority: number
  type: string
  detail?: unknown
  trigger?: true | 'object' | 'person'
  template?: BPEventTemplate
}

export type Disconnect = () => void

export type SnapshotMessage = {
  thread: string
  selected: boolean
  type: string
  detail?: unknown
  priority: number
  blockedBy?: string
}[]

type SnapshotFormatter = (args: {
  pending: Map<string, PendingBid>
  selectedEvent: CandidateBid
  candidates: CandidateBid[]
}) => SnapshotMessage

export type SnapshotListener = (msg: SnapshotMessage) => void | Promise<void>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DefaultHandlers = Record<string, (detail: any) => void | Promise<void>>

export type Handlers<T = DefaultHandlers> = DefaultHandlers & T
export type UseFeedback = <T = DefaultHandlers>(handlers: Handlers<T>) => Disconnect
export type UseSnapshot = (listener: SnapshotListener) => Disconnect
export type BThreads = {
  has: (thread: string) => { running: boolean; pending: boolean }
  set: (threads: Record<string, RulesFunction>) => void
}

export type Trigger = <T>(args: BPEvent<T>) => void

export type BProgram = () => Readonly<{
  bThreads: BThreads
  trigger: Trigger
  useFeedback: UseFeedback
  useSnapshot: UseSnapshot
}>

const triggerWaitFor = () => true

const createPublisher = <T>() => {
  const listeners = new Set<(value: T) => void | Promise<void>>()
  function publisher(value: T) {
    for (const cb of listeners) {
      void cb(value)
    }
  }
  publisher.subscribe = (listener: (msg: T) => void | Promise<void>) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
  return publisher
}

const ensureArray = <T>(obj: T | T[] = []) => (Array.isArray(obj) ? obj : [obj])

const isListeningFor = ({ type, detail }: CandidateBid) => {
  return (listener: BPListener): boolean =>
    typeof listener !== 'string' ?
      listener({
        detail,
        type,
      })
    : listener === type
}

const isPendingRequest = (selectedEvent: CandidateBid, event: BPEvent | BPEventTemplate) =>
  isTypeOf<BPEventTemplate>(event, 'function') ? event === selectedEvent?.template : event.type == selectedEvent.type

const snapshotFormatter: SnapshotFormatter = ({ candidates, selectedEvent, pending }) => {
  const blockingThreads = [...pending].flatMap(([thread, { block }]) =>
    block && Array.isArray(block) ? block.map((listener) => ({ block: listener, thread }))
    : block ? [{ block, thread }]
    : [],
  )
  const ruleSets: {
    thread: string
    selected: boolean
    type: string
    detail?: unknown
    priority: number
    blockedBy?: string
    trigger?: true | 'object' | 'person'
  }[] = []
  for (const bid of candidates) {
    const blockedCB = isListeningFor(bid)
    ruleSets.push({
      thread: bid.thread,
      selected: isPendingRequest(selectedEvent, bid),
      type: bid.type,
      priority: bid.priority,
      detail: bid.detail,
      blockedBy: blockingThreads.find(({ block }) => blockedCB(block))?.thread,
      trigger: bid.trigger,
    })
  }
  return ruleSets.sort((a, b) => a.priority - b.priority)
}
/**
 * Creates a behavioral program that manages the execution of behavioral threads.
 */
export const bProgram: BProgram = () => {
  const pending = new Map<string, PendingBid>()
  const running = new Map<string, RunningBid>()

  const actionPublisher = createPublisher<BPEvent>()
  let snapshotPublisher:
    | {
        (value: SnapshotMessage): void
        subscribe(listener: (msg: SnapshotMessage) => void | Promise<void>): () => void
      }
    | undefined
  function run() {
    running.size && step()
  }

  function step() {
    for (const [thread, bid] of running) {
      const { generator, priority, trigger } = bid
      const { value, done } = generator.next()
      !done &&
        pending.set(thread, {
          priority,
          ...(trigger && { trigger }),
          generator,
          ...value,
        })
      running.delete(thread)
    }
    selectNextEvent()
  }
  // Select next event
  function selectNextEvent() {
    const blocked: BPListener[] = []
    const candidates: CandidateBid[] = []
    for (const [thread, { request, priority, block, trigger }] of pending) {
      block && blocked.push(...ensureArray(block))
      request &&
        candidates.push({
          priority,
          trigger,
          thread,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(isTypeOf<BPEventTemplate<any>>(request, 'function') ? { template: request, ...request() } : request),
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
      snapshotPublisher && snapshotPublisher(snapshotFormatter({ candidates, selectedEvent, pending }))
      nextStep(selectedEvent)
    }
  }
  // Queue up bids for next step of super step
  function nextStep(selectedEvent: CandidateBid) {
    for (const [thread, bid] of pending) {
      const { waitFor, request, generator, interrupt } = bid
      const isInterrupted = ensureArray(interrupt).some(isListeningFor(selectedEvent))
      const isWaitedFor = ensureArray(waitFor).some(isListeningFor(selectedEvent))
      const hasPendingRequest = request && isPendingRequest(selectedEvent, request)
      isInterrupted && generator.return?.()
      if (hasPendingRequest || isInterrupted || isWaitedFor) {
        running.set(thread, bid)
        pending.delete(thread)
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
    running.set(request.type, {
      priority: 0,
      trigger: true,
      generator: thread(),
    })
    run()
  }

  const useFeedback: UseFeedback = (handlers) => {
    const disconnect = actionPublisher.subscribe((data: BPEvent) => {
      const { type, detail = {} } = data
      if (Object.hasOwn(handlers, type)) {
        void handlers[type](detail)
      }
    })
    return disconnect
  }

  const bThreads: BThreads = {
    set: (threads) => {
      for (const thread in threads) {
        running.set(thread, {
          priority: running.size + 1,
          generator: threads[thread](),
        })
      }
    },
    has: (thread) => ({ running: running.has(thread), pending: pending.has(thread) }),
  }

  const useSnapshot: UseSnapshot = (listener) => {
    if (snapshotPublisher === undefined) snapshotPublisher = createPublisher<SnapshotMessage>()
    return snapshotPublisher.subscribe(listener)
  }

  return Object.freeze({
    /** add threads functions to behavioral program and verify if there still active */
    bThreads,
    /** trigger a run and event on behavioral program */
    trigger,
    /** connect action function to behavioral program */
    useFeedback,
    /** connect a listener that receives state snapshots for each step of a running behavioral program */
    useSnapshot,
  })
}
