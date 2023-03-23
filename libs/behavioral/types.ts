import { streamEvents } from './constants.ts'

export interface StateSnapshot {
  (
    props: {
      bids: PendingBid[]
      selectedEvent: CandidateBid
    },
  ): {
    thread: string
    request?: RequestIdiom[]
    waitFor?: ParameterIdiom[]
    block?: ParameterIdiom[]
    priority: number
  }[]
}
export type Message = {
  kind: typeof streamEvents.select
  data: {
    type: string
    detail?: Record<string, unknown> | Event
  }
} | {
  kind: typeof streamEvents.snapshot
  data: ReturnType<StateSnapshot>
}

export type Subscriber = (msg: Message) => void

export type Trigger = <
  T extends (Record<string, unknown> | Event) =
    (Record<string, unknown> | Event),
>(args: {
  type: string
  detail?: T
}) => void

export type TriggerArgs = Parameters<Trigger>[0]

// Rule types
type Callback<
  T extends (Record<string, unknown> | Event) =
    (Record<string, unknown> | Event),
> = (
  args: { type: string; detail: T },
) => boolean

export type ParameterIdiom<
  T extends (Record<string, unknown> | Event) =
    (Record<string, unknown> | Event),
> = {
  type: string
  cb?: Callback<T>
} | {
  type?: string
  cb: Callback<T>
}

export type RequestIdiom<
  T extends (Record<string, unknown> | Event) =
    (Record<string, unknown> | Event),
> = {
  type: string
  detail?: T
  // cb?: Callback<T>
}

export type RuleSet<
  T extends (Record<string, unknown> | Event) =
    (Record<string, unknown> | Event),
> = {
  waitFor?: ParameterIdiom<T> | ParameterIdiom<T>[]
  request?: RequestIdiom<T> | RequestIdiom<T>[]
  block?: ParameterIdiom<T> | ParameterIdiom<T>[]
}

export type RulesFunc<
  T extends (Record<string, unknown> | Event) =
    (Record<string, unknown> | Event),
> = () => IterableIterator<
  RuleSet<T>
>

export type RunningBid = {
  trigger?: true
  thread: string
  priority: number
  generator: IterableIterator<RuleSet>
}
export type PendingBid = RuleSet & RunningBid

export type CandidateBid = {
  priority: number
  type: string
  detail?: Record<string, unknown> | Event
  cb?: Callback
}

export type Strategy = (
  filteredEvents: CandidateBid[] | never[],
) => CandidateBid | undefined

// Feedback Types
type Actions<
  T extends Record<string, (detail: Record<string, unknown> | Event) => void>,
> = {
  [K in keyof T]: T[K] extends (detail: infer D) => void ? (
      detail: D extends (Record<string, unknown> | Event) ? D
        : (Record<string, unknown> | Event),
    ) => void
    : never
}

// deno-lint-ignore no-explicit-any
export type Feedback = <T extends Record<string, (detail: any) => void>>(
  actions: Actions<T>,
) => void

export interface DevCallback {
  (args: ReturnType<StateSnapshot>): void
}
