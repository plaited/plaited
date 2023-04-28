import { Assertion } from './assert.js';
declare class TestRunner {
    #private;
    add(testCase: () => Promise<boolean>): void;
    run(onAllTestsDone?: () => void): Promise<void>;
    logResults(): void;
}
export declare const testRunner: TestRunner;
type TestCallback = (t: Assertion) => Promise<void> | void;
export declare const test: (name: string, cb: TestCallback) => void;
export {};
