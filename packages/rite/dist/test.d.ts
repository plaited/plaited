import { TestResultError, TestResult, BrowserSessionResult } from '@web/test-runner-core/browser/session.js';
import { Assertion } from './assert.js';
type TestCallback = (t: Assertion) => Promise<void> | void;
interface Test {
    (name: string, cb: TestCallback): void;
    skip: (name: string, cb: TestCallback) => void;
}
type TestCase = (() => Promise<boolean> | boolean);
declare class TestRunner {
    #private;
    updateTimeout(time: number): void;
    get timeout(): number;
    addCase(test: TestCase): void;
    addResult(result: TestResult): void;
    addError(obj: TestResultError): void;
    run(name: string): Promise<BrowserSessionResult>;
}
declare global {
    interface Window {
        __rite_test_runner?: TestRunner;
    }
}
export declare const test: Test;
export {};
