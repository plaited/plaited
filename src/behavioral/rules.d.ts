import { Callback, RequestIdiom } from './types';
export declare const waitFor: (...idioms: {
    eventName?: string;
    payload?: unknown;
    callback?: Callback;
}[]) => {
    [x: string]: {
        eventName?: string | undefined;
        payload?: unknown;
        callback?: Callback | undefined;
    }[];
};
export declare const block: (...idioms: {
    eventName?: string;
    payload?: unknown;
    callback?: Callback;
}[]) => {
    [x: string]: {
        eventName?: string | undefined;
        payload?: unknown;
        callback?: Callback | undefined;
    }[];
};
export declare const request: RequestIdiom;
