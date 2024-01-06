/* eslint-disable @typescript-eslint/no-explicit-any */
// type StructuredCloneable =
//   | string
//   | number
//   | boolean
//   | null
//   | undefined
//   | Date
//   | RegExp
//   | Blob
//   | File
//   | FileList
//   | ArrayBuffer
//   | ArrayBufferView
//   | Map<StructuredCloneable, StructuredCloneable>
//   | Set<StructuredCloneable>
//   | Array<StructuredCloneable>
//   | {
//     [key: string]: StructuredCloneable;
//   };


export type BPEvent<T = any> = { type: string; detail?: T }

export type BPEventTemplate<T = any> = () => BPEvent<T>

export type BPListener<T = any> = string | ((args: { type: string; detail: T }) => boolean)

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

export type RuleSet<T = any> = {
  waitFor?: BPListener<T> | BPListener<T>[]
  request?: BPEvent<T> | BPEventTemplate<T>
  block?: BPListener<T> | BPListener<T>[]
}

export type RulesFunction<T = any> = () => IterableIterator<RuleSet<T>>

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
  detail?: any
  template?: BPEventTemplate
}

export type Actions<T = any> = { [key: string]: (detail: T) => void | Promise<void> }

export type Feedback = (actions: Actions) => void
export type AddThreads = (threads: Record<string, RulesFunction>) => void
export type Trigger = <T = any>(args: BPEvent<T>) => void

export type Sync = <T = any>(set: RuleSet<T>) => RulesFunction<T>
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
