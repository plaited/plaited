import { streamEvents } from './constants.ts'

type Singletons =
  | null
  | undefined
  | boolean
  | number
  | string
  | Date
  | RegExp
  | Blob
  | ArrayBuffer
  | ArrayBufferView
  | ImageBitmap
  | OffscreenCanvas
  | ImageData
  | Event
// Stream Types
export type EventDetail = {
  [key: string]:
    | Singletons
    | Map<EventDetail, EventDetail | Singletons>
    | Set<EventDetail | Singletons>
    | Record<string, EventDetail | Singletons>
    | (EventDetail | Singletons)[]
}

export interface StateSnapshot {
  (
    props: {
      bids: PendingBid[]
      selectedEvent: CandidateBid
    },
  ): {
    selectedEvent: CandidateBid
    bThreads: {
      name: string
      request?: RequestIdiom[]
      waitFor?: ParameterIdiom[]
      block?: ParameterIdiom[]
      priority: number
    }[]
  }
}

export type SnapshotMessage = {
  type: typeof streamEvents.snapshot
  data: ReturnType<StateSnapshot>
}

type EventMessage = {
  type: typeof streamEvents.select | typeof streamEvents.trigger
  data: {
    event: string
    detail?: unknown
  }
}

type EndMessage = {
  type: typeof streamEvents.end
  data: {
    strategy: string
  }
}

export type ListenerMessage = EventMessage | SnapshotMessage | EndMessage

export type Listener = (msg: ListenerMessage) => ListenerMessage | void

export interface Stream {
  (value: ListenerMessage): void
  subscribe: (listener: Listener) => Stream
}

export type Trigger = <T = unknown>(args: {
  event: string
  detail?: T
}) => void

export type TriggerArgs = Parameters<Trigger>[0]

// Rule types
type Callback<T = unknown> = (
  args: { event: string; detail?: T extends undefined ? never : T },
) => boolean

export type ParameterIdiom<T = unknown> = {
  event: string
  cb?: Callback<T>
} | {
  event?: string
  cb: Callback<T>
}

export type RequestIdiom<T = unknown> = {
  event: string
  detail: T
  cb?: Callback<T>
}

export type RuleSet<T = unknown> = {
  waitFor?: ParameterIdiom<T> | ParameterIdiom<T>[]
  request?: RequestIdiom<T> | RequestIdiom<T>[]
  block?: ParameterIdiom<T> | ParameterIdiom<T>[]
}

export type RulesFunc<T = unknown> = () => IterableIterator<
  RuleSet<T>
>

export type RunningBid = {
  name: string
  priority: number
  bThread: IterableIterator<RuleSet<EventDetail>>
}
export type PendingBid = RuleSet & RunningBid

export type CandidateBid = {
  priority: number
  event: string
  detail?: unknown
  cb?: Callback
}

export type Strategy = (
  filteredEvents: CandidateBid[] | never[],
) => CandidateBid | undefined

// Feedback Types
type Actions<T extends Record<string, (detail: EventDetail) => void>> = {
  [K in keyof T]: T[K] extends (detail: infer D) => void
    ? (detail: D extends EventDetail ? D : EventDetail) => void
    : never
}

// deno-lint-ignore no-explicit-any
export type Feedback = <T extends Record<string, (detail: any) => void>>(
  actions: Actions<T>,
) => void

export interface LogCallback {
  (args: {
    type: typeof streamEvents.trigger
    data: {
      event: string
      detail?: unknown
    }
  }): void
  (args: SnapshotMessage): void
  (args: EndMessage): void
}
