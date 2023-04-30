/* eslint-disable no-console */
import { deepEqual, wait } from '@plaited/utils';
import { throws } from './throws.js';
import { match } from './match.js';
import { findByAttribute } from './find-by-attribute.js';
import { findByText } from './find-by-text.js';
import { fireEvent } from './fire-event.js';
export class AssertionError extends Error {
    name = 'AssertionError';
    constructor(message) {
        super(message);
    }
}
const requiredKeys = ['given', 'should', 'actual', 'expected'];
export const assert = param => {
    const args = param ?? {};
    const missing = requiredKeys.filter(k => !Object.keys(args).includes(k));
    if (missing.length) {
        const msg = [
            `The following parameters are required by 'assert': (`,
            `  ${missing.join(', ')}`,
            ')',
        ].join('\n');
        throw new Error(msg);
    }
    const { given = undefined, should = '', actual = undefined, expected = undefined, } = args;
    if (!deepEqual(actual, expected)) {
        const message = `Given ${given}: should ${should}`;
        throw new AssertionError(JSON.stringify({ message, actual, expected }));
    }
};
assert['match'] = match;
assert['throws'] = throws;
assert['wait'] = wait;
assert['findByAttribute'] = findByAttribute;
assert['findByText'] = findByText;
assert['fireEvent'] = fireEvent;
export const t = assert;
