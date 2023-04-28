import { PlaitedElement } from './create-template.js';
/**
 * Forked from  memoize-one
 * (c) Alexander Reardon - MIT
 * {@see https://github.com/alexreardon/memoize-one}
 * In this mode we constrain arguments to a single props object that extends TemplateProps
 * We also do a basic shallow comparison on the object to cache function result.
 */
export declare const memo: <T extends Record<string, any> = Record<string, any>>(resultFn: PlaitedElement<T>) => PlaitedElement<T>;
