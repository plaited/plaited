/* eslint-disable @typescript-eslint/no-explicit-any */
import { Disconnect  } from "../shared/types.js";

export type BPEvent<T = any> = { type: string; detail?: T }

export type BPEventTemplate<T = any> = () => BPEvent<T>

export type BPListener<T = any> = string | ((args: { type: string; detail: T}) => boolean)

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

export type UseSnapshot = (listener: SnapshotListener) =>  Disconnect

export type Idioms<T = any> = {
  waitFor?: BPListener<T> | BPListener<T>[]
  interrupt?: BPListener<T> | BPListener<T>[]
  request?: BPEvent<T> | BPEventTemplate<T>
  block?: BPListener<T> | BPListener<T>[]
}

export type RulesFunction<T = any> = () => IterableIterator<Idioms<T>>

export type RunningBid = {
  trigger?: true | 'object' | 'person'
  priority: number
  generator: IterableIterator<Idioms>
}
export type PendingBid = Idioms & RunningBid

export type CandidateBid = {
  thread: string
  priority: number
  type: string
  detail?: any
  trigger?: true | 'object' | 'person'
  template?: BPEventTemplate
}

export type Actions<T = any> = { [key: string]: (detail: T) => void | Promise<void> }

export type UseFeedback = (actions: Actions) => Disconnect
export type Repeat = true | ((ctx?: (id: string) => unknown) => boolean)

export type BThreads = {
  has:(thread: string) => {running: boolean, pending: boolean}
  set:(threads: Record<string, RulesFunction>) => void
}
export type DeleteThread = (thread: string) => void
export type Trigger = <T = any>(args: BPEvent<T>) => void
export type SynchronizationPoint = <T = any>(arg: Idioms<T>) => RulesFunction<T>
export type Synchronize = (rules: RulesFunction[], repeat?: Repeat) => RulesFunction

export type BProgram = () => Readonly<{
  bThreads: BThreads
  trigger: Trigger
  useFeedback: UseFeedback
  useSnapshot: UseSnapshot
}>
