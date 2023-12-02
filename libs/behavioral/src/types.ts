export type BPEvent<T = unknown> = {type: string, detail?: T}

export type BPEventTemplate<T = unknown> = () => BPEvent<T>

export type BPListener<T = unknown> =  string |  ((args: { type: string; detail: T }) => boolean)

export interface SelectionSnapshot {
  (args: { pending: Set<PendingBid>, selectedEvent: CandidateBid, candidates: CandidateBid[]}): [{
    thread: string
    selected: boolean
    type: string
    detail?: unknown
    priority: number
    blockedBy?: string
  }[], ["thread", "selected", "type", "detail", "priority", "blockedBy"]]
}

export type LogMessage = ReturnType<SelectionSnapshot>

export type Trigger = <T = unknown>(args: BPEvent<T>) => void

export type RuleSet<T = unknown> = {
  waitFor?:  BPListener<T> | BPListener<T>[]
  request?: BPEvent<T> | BPEventTemplate<T>
  block?:  BPListener<T> | BPListener<T>[]
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
  (args: ReturnType<SelectionSnapshot>): void
}

export type Publisher<T extends BPEvent = BPEvent> = {
  (value: T): void
  subscribe(listener: (msg: T) => void): () => boolean
}