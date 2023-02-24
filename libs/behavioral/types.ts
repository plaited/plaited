import { streamEvents } from './constants.ts'

// Stream Types
type Snapshot = {
  bThread: { name: string; priority: number }[]
  requestedEvents: {
    event: string | undefined
    payload?: unknown
  }[]
  blockedEvents: (string | undefined)[]
}

export interface StateChart {
  (
    props: {
      candidates: CandidateBid[]
      blocked: {
        type?: string
        assert?: Assertion
      }[]
      pending: PendingBid[]
    },
  ): Snapshot
}

type SnapshotMessage = {
  type: typeof streamEvents.state
  detail: Snapshot
}

type EventEventMessage = {
  type: typeof streamEvents.select | typeof streamEvents.trigger
  detail: {
    event: string
    payload?: unknown
  }
}

export type ListenerMessage = EventEventMessage | SnapshotMessage

export type Listener = (msg: ListenerMessage) => ListenerMessage | void

export interface Stream {
  (value: ListenerMessage): void
  subscribe: (listener: Listener) => Stream
}

// Trigger types
export type TriggerArgs<T = unknown> = {
  event: string
  payload?: T
}

export type Trigger = <T = unknown>(args: TriggerArgs<T>) => void

// Rule types
type Assertion<T = unknown> = (
  args: { event: string; payload: T extends undefined ? never : T },
) => boolean

export type ParameterIdiom<T = unknown> = {
  event: string
  assert?: Assertion<T>
} | {
  event?: string
  assert: Assertion<T>
}

type RequestIdiom<T = unknown> = {
  event: string
  payload?: T
}

export type RuleSet<T = unknown> = {
  waitFor?: ParameterIdiom<T> | ParameterIdiom<T>[]
  request?: RequestIdiom<T> | RequestIdiom<T>[]
  block?: ParameterIdiom<T> | ParameterIdiom<T>[]
}

export type RuleGenerator<T = unknown> = IterableIterator<RuleSet<T>>
export type RulesFunc<T = unknown> = () => RuleGenerator<T>

export type RunningBid = {
  name: string
  priority: number
  bThread: RuleGenerator
}
export type PendingBid = RuleSet & RunningBid

export type CandidateBid = {
  priority: number
  event: string
  payload?: unknown
  assert?: Assertion
}

export type Strategy = (filteredEvents: CandidateBid[]) => CandidateBid

// Feedback Types
// deno-lint-ignore no-explicit-any
type Actions<T extends Record<string, (payload: any) => void>> = {
  [K in keyof T]: (payload: Parameters<T[K]>[0]) => void
}

// deno-lint-ignore no-explicit-any
export type Feedback = <T extends Record<string, (payload: any) => void>>(
  actions: Actions<T>,
) => Stream
