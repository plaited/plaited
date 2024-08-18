/* eslint-disable @typescript-eslint/no-explicit-any */
import { Disconnect  } from "../shared/types.js";

export type BPEvent<T = any> = { type: string; detail?: T }

export type BPEventTemplate<T = any> = () => BPEvent<T>

export type BPListener<T = any> = string | ((args: { type: string; detail: T }) => boolean)

export interface DevtoolCallback<T> {
  (args: T): void | Promise<void>
}

export type SnapshotMessage = {
  thread: string
  selected: boolean
  type: string
  detail?: unknown
  priority: number
  blockedBy?: string
}[]

export type SnapshotFormatter = (args: {
    pending: Map<string, PendingBid>
    selectedEvent: CandidateBid
    candidates: CandidateBid[]
}) =>  SnapshotMessage

export type SnapshotListener = (msg: SnapshotMessage) => void | Promise<void>

export type Snapshot = (listener: SnapshotListener) =>  Disconnect

export type SynchronizationPoint<T = any> = {
  waitFor?: BPListener<T> | BPListener<T>[]
  interrupt?: BPListener<T> | BPListener<T>[]
  request?: BPEvent<T> | BPEventTemplate<T>
  block?: BPListener<T> | BPListener<T>[]
}

export type RulesFunction<T = any> = () => IterableIterator<SynchronizationPoint<T>>

export type RunningBid = {
  trigger?: true | 'object' | 'person'
  priority: number
  generator: IterableIterator<SynchronizationPoint>
}
export type PendingBid = SynchronizationPoint & RunningBid

export type CandidateBid = {
  thread: string
  priority: number
  type: string
  detail?: any
  trigger?: true | 'object' | 'person'
  template?: BPEventTemplate
}

export type Actions<T = any> = { [key: string]: (detail: T) => void | Promise<void> }

export type Feedback = (actions: Actions) => void
export type Rules = {
  // clear: () => void
  // delete: (thread: string) => boolean
  has:(thread: string) => boolean
  set:(threads: Record<string, RulesFunction>) => void
}
export type DeleteThread = (thread: string) => void
export type Trigger = <T = any>(args: BPEvent<T>) => void

export type Sync = <T = any>(syncPoint: SynchronizationPoint<T>) => RulesFunction<T>
export type Thread = (...rules: RulesFunction[]) => RulesFunction
export type Loop = (ruleOrCallback: RulesFunction | (() => boolean), ...rules: RulesFunction[]) => RulesFunction

export type BProgram = () => Readonly<{
  rules: Rules
  feedback: Feedback
  trigger: Trigger
  snapshot: Snapshot
}>
