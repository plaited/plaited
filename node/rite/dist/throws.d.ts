type Throws = <U extends unknown[], V>(fn: (...args: U) => V, ...args: U) => unknown | Promise<unknown>;
export declare const throws: Throws;
export {};
