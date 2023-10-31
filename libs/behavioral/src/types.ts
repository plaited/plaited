export interface StateSnapshot {
  (props: { bids: PendingBid[]; selectedEvent: CandidateBid }): {
    thread: string
    request?: RequestIdiom[]
    waitFor?: ParameterIdiom[]
    block?: ParameterIdiom[]
    priority: number
  }[]
}

export type Detail = unknown | (() => unknown) | Event

export type SnapshotMessage = ReturnType<StateSnapshot>

export type SelectedMessage = {
  type: string
  detail?: Detail
}

export type Trigger = <T extends Detail = Detail>(args: TriggerArgs<T>) => void

export type TriggerArgs<T extends Detail = Detail> = {
  type: string
  detail?: T
}
// Rule types
type Callback<T extends Detail = Detail> = (args: { type: string; detail: T }) => boolean

export type ParameterIdiom<T extends Detail = Detail> =
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
  waitFor?: ParameterIdiom<T> | ParameterIdiom<T>[]
  request?: RequestIdiom<T> | RequestIdiom<T>[]
  block?: ParameterIdiom<T> | ParameterIdiom<T>[]
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
  cb?: Callback
}

export type Strategy = (filteredEvents: CandidateBid[] | never[]) => CandidateBid | undefined

// Feedback Types
type Actions<T extends Record<string, (detail: Detail) => void>> = {
  [K in keyof T]: T[K] extends (detail: infer D) => void ? (detail: D extends Detail ? D : Detail) => void : never
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Feedback = <T extends Record<string, (detail: any) => void>>(actions: Actions<T>) => void

export interface DevCallback {
  (args: ReturnType<StateSnapshot>): void
}

export type Log = ReturnType<StateSnapshot>
