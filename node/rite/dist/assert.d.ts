import { wait } from '@plaited/utils';
import { throws } from './throws.js';
import { match } from './match.js';
import { findByAttribute } from './find-by-attribute.js';
import { findByText } from './find-by-text.js';
import { fireEvent } from './fire-event.js';
export interface Assertion {
    <T>(param: {
        given: string;
        should: string;
        actual: T;
        expected: T;
    }): void;
    findByAttribute: typeof findByAttribute;
    findByText: typeof findByText;
    fireEvent: typeof fireEvent;
    match: typeof match;
    throws: typeof throws;
    wait: typeof wait;
}
export declare class AssertionError extends Error {
    name: string;
    constructor(message: string);
}
export declare const assert: Assertion;
export declare const t: Assertion;
