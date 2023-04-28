import { Attrs, createTemplate, Fragment } from './create-template.js';
export { createTemplate as jsx, createTemplate as jsxDEV, createTemplate as jsxs, Fragment, };
export declare namespace JSX {
    type IntrinsicAttributes = Attrs;
    interface IntrinsicElements {
        [elemName: string]: IntrinsicAttributes;
    }
}
