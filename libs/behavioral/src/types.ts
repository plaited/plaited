export type BPEvent<T = unknown> = { type: string; detail?: T }

export type BPEventTemplate<T = unknown> = () => BPEvent<T>

export type BPListener<T = unknown> = string | ((args: { type: string; detail: T }) => boolean)

export interface LogCallback<T> {
  (args: T): void
}

export type DefaultLogCallbackParams = {
  thread: string
  selected: boolean
  type: string
  detail?: unknown
  priority: number
  blockedBy?: string
}[]

export interface DefaultLogger {
  (args: {
    pending: Set<PendingBid>
    selectedEvent: CandidateBid
    candidates: CandidateBid[]
  }): DefaultLogCallbackParams
  callback: LogCallback<DefaultLogCallbackParams>
}

export type Logger<T> = {
  (args: { pending: Set<PendingBid>; selectedEvent: CandidateBid; candidates: CandidateBid[] }): T
  callback: LogCallback<T>
}

export type RuleSet<T = unknown> = {
  waitFor?: BPListener<T> | BPListener<T>[]
  request?: BPEvent<T> | BPEventTemplate<T>
  block?: BPListener<T> | BPListener<T>[]
}

export type RulesFunction<T = unknown> = () => IterableIterator<RuleSet<T>>

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Actions<T = any> = { [key: string]: (detail: T) => void | Promise<void> }

export type Feedback = (actions: Actions) => void
export type AddThreads = (threads: Record<string, RulesFunction>) => void
export type Trigger = <T = unknown>(args: BPEvent<T>) => void

export type Sync = <T = unknown>(set: RuleSet<T>) => RulesFunction<T>
export type Thread = (...rules: RulesFunction[]) => RulesFunction
export type Loop = (ruleOrCallback: RulesFunction | (() => boolean), ...rules: RulesFunction[]) => RulesFunction

export type BProgram = <T>(logger?: Logger<T> | undefined) => Readonly<{
  addThreads: AddThreads
  feedback: Feedback
  trigger: Trigger
  thread: Thread
  loop: Loop
  sync: Sync
}>

export type Publisher<T extends BPEvent = BPEvent> = {
  (value: T): void
  subscribe(listener: (msg: T) => void): () => boolean
  type: 'publisher'
}
