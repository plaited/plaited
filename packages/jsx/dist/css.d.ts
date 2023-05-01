import { Primitive } from './types.js';
export declare const reduceWhitespace: (str: string) => string;
/** tagged template function for creating css module style styles and classNames objects */
export declare const css: (strings: TemplateStringsArray, ...expressions: Array<Primitive | Primitive[]>) => readonly [Record<string, string>, {
    stylesheet: string;
}];
