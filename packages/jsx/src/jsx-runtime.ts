import { createTemplate, Fragment } from './create-template.js'
import { Attrs } from './types.js'
export {
  createTemplate as h,
  createTemplate as jsx,
  createTemplate as jsxDEV,
  createTemplate as jsxs,
  Fragment,
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace JSX {
  type IntrinsicAttributes = Attrs;
  interface IntrinsicElements {
    [elemName: string]: IntrinsicAttributes;
  }
}