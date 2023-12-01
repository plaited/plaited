export type BPEvent<T extends Detail = Detail> = {
  type: string
  detail?: T
}

export interface StateSnapshot {
  (props: { bids: PendingBid[]; selectedEvent: CandidateBid }): {
    thread: string
    request?: RequestIdiom[]
    waitFor?: ParameterSet[]
    block?: ParameterSet[]
    priority: number
  }[]
}

export type Detail = unknown | (() => unknown) | Event

export type SnapshotMessage = ReturnType<StateSnapshot>

export type Trigger = <T extends Detail = Detail>(args: BPEvent<T>) => void

// Rule types
type Callback<T extends Detail = Detail> = (args: { type: string; detail: T }) => boolean

export type ParameterSet<T extends Detail = Detail> =
  | {
      type: string
      cb?: Callback<T>
    }
  | {
      type?: string
      cb: Callback<T>
    }

export type RequestIdiom<T extends Detail = Detail> = {
  type: string
  detail?: T
}

export type RuleSet<T extends Detail = Detail> = {
  waitFor?: ParameterSet<T> | ParameterSet<T>[]
  request?: RequestIdiom<T> | RequestIdiom<T>[]
  block?: ParameterSet<T> | ParameterSet<T>[]
}

export type RulesFunc<T extends Detail = Detail> = () => IterableIterator<RuleSet<T>>

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
  detail?: Detail
  thread: string
}

export type Strategy = (filteredEvents: CandidateBid[] | never[]) => CandidateBid | undefined

// Feedback Types
type Actions<T extends Record<string, (detail: Detail) => void | Promise<void>>> = {
  [K in keyof T]: T[K] extends (detail: infer D) => void ? (detail: D extends Detail ? D : Detail) => void : never
}

export type Publisher<T extends BPEvent = BPEvent> = {
  (value: T): void
  subscribe(listener: (msg: T) => void): () => boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Feedback = <T extends Record<string, (detail: any) => void>>(actions: Actions<T>) => void

export interface DevCallback {
  (args: ReturnType<StateSnapshot>): void
}

export type Log = ReturnType<StateSnapshot>
