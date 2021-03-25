import { streamEvents, selectionStrategies, baseDynamics } from './constants';
import { ValueOf } from '../utils/types'

export declare type FeedbackMessage = {
    eventName: string;
    payload?: any;
};
export declare type Callback = (args: FeedbackMessage) => boolean;
export interface RuleParameterValue {
    eventName?: string;
    payload?: any;
    callback?: Callback;
}
export interface IdiomSet {
    waitFor?: RuleParameterValue[];
    request?: FeedbackMessage[];
    block?: RuleParameterValue[];
}
export declare type ListenerMessage = {
    streamEvent: ValueOf<typeof streamEvents>;
    eventName?: string;
    [key: string]: unknown;
};
export declare type Listener = (msg: ListenerMessage) => ListenerMessage | void;
export interface CreatedStream {
    (value: ListenerMessage): void;
    subscribe: (listener: Listener) => CreatedStream;
}
export declare type Trigger = (args: {
    eventName: string;
    payload?: any;
    baseDynamic?: ValueOf<typeof baseDynamics>;
}) => void;
export declare type RuleGenerator = Generator<IdiomSet, void, unknown>;
export declare type RulesFunc = () => RuleGenerator;
export declare type RunningBid = {
    strandName: string;
    priority: number;
    logicStrand: RuleGenerator;
};
export declare type PendingBid = IdiomSet & RunningBid;
export declare type CandidateBid = RunningBid & FeedbackMessage & Omit<IdiomSet, 'request'>;
export declare type Strategy = ((candidateEvents: CandidateBid[], blockedEvents: RuleParameterValue[]) => CandidateBid);
export declare type SelectionStrategies = ValueOf<typeof selectionStrategies> | Strategy;
export interface Track {
    (strand: Record<string, RulesFunc>, options?: {
        strategy?: SelectionStrategies;
        debug?: boolean;
    }): {
        trigger: Trigger;
        feedback: (actions: Record<string, (obj: FeedbackMessage) => void>) => CreatedStream;
        stream: CreatedStream;
        add: (logicStands: Record<string, RulesFunc>) => void;
    };
}
export interface BProgram {
    (props: {
        strategy?: SelectionStrategies;
        stream: CreatedStream;
        debug?: boolean;
    }): {
        running: Set<RunningBid>;
        trigger: Trigger;
    };
}
export interface StateChart {
    (props: {
        candidates: CandidateBid[];
        blocked: RuleParameterValue[];
        pending: Set<PendingBid>;
    }): {
        streamEvent: 'stateSnapshot';
        logicStrands: string[];
        requestedEvents: {
            eventName: string | undefined;
            payload: unknown;
        }[];
        blockedEvents: (string | undefined)[];
    };
}
export declare type RequestIdiom = (...idioms: {
    eventName: string;
    payload?: unknown;
    callback?: Callback;
}[]) => {
    [x: string]: {
        eventName: string;
        payload?: unknown;
        callback?: Callback | undefined;
    }[];
};
