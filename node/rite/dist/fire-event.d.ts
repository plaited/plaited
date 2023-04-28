type EventArguments = {
    bubbles?: boolean;
    composed?: boolean;
    cancelable?: boolean;
    detail?: Record<string, unknown>;
};
export declare const fireEvent: (element: HTMLElement | SVGElement, eventName: string, options?: EventArguments) => Promise<void>;
export {};
