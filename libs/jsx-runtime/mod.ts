import { createTemplate, Props } from '../islandly/create-template.ts'

export {
  createTemplate as jsx,
  createTemplate as jsxDEV,
  createTemplate as jsxs,
}

export declare namespace JSX {
  type IntrinsicAttributes = Props
  interface IntrinsicElements {
    [elemName: string]: IntrinsicAttributes
  }
}
