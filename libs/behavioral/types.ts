import { streamEvents } from './constants.ts'

// Stream Types
type Snapshot = {
  bThread: { name: string; priority: number }[]
  requestedEvents: {
    type: string | undefined
    data?: unknown
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
    type: string
    data?: unknown
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
  type: string
  data?: T
}

export type Trigger = <T = unknown>(args: TriggerArgs<T>) => void

// Rule types
type Assertion<T = unknown> = (
  args: { type: string; data: T extends undefined ? never : T },
) => boolean

export type ParameterIdiom<T = unknown> = {
  type: string
  assert?: Assertion<T>
} | {
  type?: string
  assert: Assertion<T>
}

type RequestIdiom<T = unknown> = {
  type: string
  data?: T
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
  type: string
  data?: unknown
  assert?: Assertion
}

export type Strategy = (filteredEvents: CandidateBid[]) => CandidateBid

// Feedback Types
// deno-lint-ignore no-explicit-any
type Actions<T extends Record<string, (data: any) => void>> = {
  [K in keyof T]: (data: Parameters<T[K]>[0]) => void
}

// deno-lint-ignore no-explicit-any
export type Feedback = <T extends Record<string, (data: any) => void>>(
  actions: Actions<T>,
) => Stream

// deno-lint-ignore no-explicit-any
export type ActionRequest<T extends Record<string, (data: any) => void>> = {
  [K in keyof T]: {
    type: K
    data: Parameters<T[K]>[0]
  }
}
