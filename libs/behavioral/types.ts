import { streamEvents } from './constants.ts'

export interface StateSnapshot {
  (
    props: {
      bids: PendingBid[]
      selectedEvent: CandidateBid
    },
  ): {
    selectedEvent: CandidateBid
    ruleSets: {
      thread: string
      request?: RequestIdiom[]
      waitFor?: ParameterIdiom[]
      block?: ParameterIdiom[]
      priority: number
    }[]
  }
}

type SnapshotMessage = {
  type: typeof streamEvents.snapshot
  data: ReturnType<StateSnapshot>
}

type SelectMessage = {
  type: typeof streamEvents.select
  data: {
    event: string
    detail?: Record<string, unknown>
  }
}

type TriggerMessage = {
  type: typeof streamEvents.trigger
  data: {
    event: string
    detail?: Record<string, unknown>
  }
}

type EndMessage = {
  type: typeof streamEvents.end
  data: {
    strategy: string
  }
}

export type StreamMessage =
  | SelectMessage
  | TriggerMessage
  | SnapshotMessage
  | EndMessage

export type Listener = (msg: StreamMessage) => StreamMessage | void

export interface Stream {
  (value: StreamMessage): void
  subscribe: (listener: Listener) => Stream
}

export type Trigger = <
  T extends Record<string, unknown> = Record<string, unknown>,
>(args: {
  event: string
  detail?: T
}) => void

export type TriggerArgs = Parameters<Trigger>[0]

// Rule types
type Callback<
  T extends (Record<string, unknown> | Event) = Record<string, unknown>,
> = (
  args: { event: string; detail: T },
) => boolean

export type ParameterIdiom<
  T extends (Record<string, unknown> | Event) = Record<string, unknown>,
> = {
  event: string
  cb?: Callback<T>
} | {
  event?: string
  cb: Callback<T>
}

export type RequestIdiom<
  T extends (Record<string, unknown> | Event) = Record<string, unknown>,
> = {
  event: string
  detail?: T
  cb?: Callback<T>
}

export type RuleSet<
  T extends (Record<string, unknown> | Event) = Record<string, unknown>,
> = {
  waitFor?: ParameterIdiom<T> | ParameterIdiom<T>[]
  request?: RequestIdiom<T> | RequestIdiom<T>[]
  block?: ParameterIdiom<T> | ParameterIdiom<T>[]
}

export type RulesFunc<
  T extends (Record<string, unknown> | Event) = Record<string, unknown>,
> = () => IterableIterator<
  RuleSet<T>
>

export type RunningBid = {
  thread: string
  priority: number
  generator: IterableIterator<RuleSet>
}
export type PendingBid = RuleSet & RunningBid

export type CandidateBid = {
  priority: number
  event: string
  detail?: Record<string, unknown>
  cb?: Callback
}

export type Strategy = (
  filteredEvents: CandidateBid[] | never[],
) => CandidateBid | undefined

// Feedback Types
type Actions<
  T extends Record<string, (detail: Record<string, unknown>) => void>,
> = {
  [K in keyof T]: T[K] extends (detail: infer D) => void ? (
      detail: D extends Record<string, unknown> ? D : Record<string, unknown>,
    ) => void
    : never
}

// deno-lint-ignore no-explicit-any
export type Feedback = <T extends Record<string, (detail: any) => void>>(
  actions: Actions<T>,
) => void

export interface Logger {
  (args: TriggerMessage): void
  (args: SnapshotMessage): void
  (args: EndMessage): void
}

export type LogMessage =
  | TriggerMessage
  | SnapshotMessage
  | EndMessage
