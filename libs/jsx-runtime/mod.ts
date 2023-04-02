import { Attrs, createTemplate, Fragment } from '../islandly/create-template.ts'

export {
  createTemplate as jsx,
  createTemplate as jsxDEV,
  createTemplate as jsxs,
  Fragment,
}

export declare namespace JSX {
  type IntrinsicAttributes = Attrs
  interface IntrinsicElements {
    [elemName: string]: IntrinsicAttributes
  }
}
