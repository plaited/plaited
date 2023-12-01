export type BPEvent<T = unknown> = {type: string, detail?: T}

export type BPEventTemplate<T = unknown> = () => BPEvent<T>

export type Parameter<T = unknown> =  string |  ((args: { type: string; detail: T }) => boolean)

export interface StateSnapshot {
  (props: { bids: PendingBid[]; selectedEvent: CandidateBid }): {
    thread: string
    request?: BPEvent[]
    waitFor?: Parameter[]
    block?: Parameter[]
    priority: number
  }[]
}

export type SnapshotMessage = ReturnType<StateSnapshot>

export type Trigger = <T = unknown>(args: BPEvent<T>) => void

export type RuleSet<T = unknown> = {
  waitFor?:  Parameter<T> | Parameter<T>[]
  request?: BPEvent<T> | BPEventTemplate<T>
  block?:  Parameter<T> | Parameter<T>[]
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
  thread: string
  priority: number
  type: string
  detail?: unknown
  template?: BPEventTemplate
}

export type Strategy = (filteredEvents: CandidateBid[] | never[]) => CandidateBid | undefined

export type Feedback = (actions: {
  [key:string]: (detail: unknown) => void | Promise<void>
}) => void

export interface DevCallback {
  (args: ReturnType<StateSnapshot>): void
}

export type Publisher<T extends BPEvent = BPEvent> = {
  (value: T): void
  subscribe(listener: (msg: T) => void): () => boolean
}