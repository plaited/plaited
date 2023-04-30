type EventArguments = {
    bubbles?: boolean;
    composed?: boolean;
    cancelable?: boolean;
    detail?: Record<string, unknown>;
};
export declare const fireEvent: <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(element: T, eventName: string, options?: EventArguments) => Promise<void>;
export {};
