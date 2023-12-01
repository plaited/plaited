export type BPEvent<T = unknown> = {
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
export type SnapshotMessage = ReturnType<StateSnapshot>

export type Trigger = <T = unknown>(args: BPEvent<T>) => void

// Rule types
type Callback<T = unknown> = (args: { type: string; detail: T }) => boolean

export type ParameterSet<T = unknown> =  string |  Callback<T>

export type RequestIdiom<T = unknown> = {
  type: string
  detail?: T
}

export type RuleSet<T = unknown> = {
  waitFor?: ParameterSet<T> | ParameterSet<T>[]
  request?: RequestIdiom<T> | RequestIdiom<T>[]
  block?: ParameterSet<T> | ParameterSet<T>[]
}

export type RulesFunc<T = unknown> = () => IterableIterator<RuleSet<T>>

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
  detail?: unknown
  thread: string
}

export type Strategy = (filteredEvents: CandidateBid[] | never[]) => CandidateBid | undefined


type Actions = {
  [key:string]: (detail: unknown) => void | Promise<void>
}

export type Feedback = (actions: Actions) => void

export interface DevCallback {
  (args: ReturnType<StateSnapshot>): void
}

export type Log = ReturnType<StateSnapshot>

export type Publisher<T extends BPEvent = BPEvent> = {
  (value: T): void
  subscribe(listener: (msg: T) => void): () => boolean
}