import {streamEvents} from './constants'


export type ValueOf<T> = T[keyof T]

export type FeedbackMessage = {eventName: string, payload?: any}
export type Callback = (args: FeedbackMessage) => boolean;
export interface RuleParameterValue {
  eventName?: string
  callback?: Callback
}

export interface IdiomSet {
  waitFor?: RuleParameterValue[]
  request?: FeedbackMessage[]
  block?: RuleParameterValue[]
}

export type ListenerMessage = {
  streamEvent: ValueOf<typeof streamEvents>
  eventName?: string
  [key: string]: unknown
}
export type Listener = (msg: ListenerMessage) => ListenerMessage | void
export interface CreatedStream {
  (value: ListenerMessage): void
  subscribe: (listener: Listener) => CreatedStream
}

export type RuleGenerator =  Generator<IdiomSet, void, unknown>
export type RulesFunc = () => RuleGenerator


export type RunningBid = {
  strandName: string
  priority: number
  logicStrand: RuleGenerator
}
export type PendingBid = IdiomSet & RunningBid

export type CandidateBid =  { 
  priority: number;
  eventName: string;
  payload?: any;
  callback?: Callback;
}

export type Strategy = ((filteredEvents: CandidateBid[]) => CandidateBid)

// stateChart.ts 
export interface StateChart {
  (props: {candidates: CandidateBid[], blocked: RuleParameterValue[], pending: PendingBid[]}): {
    streamEvent: 'stateSnapshot';
    logicStrands: {strandName: string, priority: number}[];
    requestedEvents: {
        eventName: string | undefined;
        payload: unknown;
    }[];
    blockedEvents: (string | undefined)[];
  }
}
