import type { ElementAttributeList } from './jsx/jsx.types.js'
import { createTemplate, Fragment } from './jsx/create-template.js'

export { createTemplate as h, createTemplate as jsx, createTemplate as jsxDEV, createTemplate as jsxs, Fragment }

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace JSX {
  interface IntrinsicElements extends ElementAttributeList {}
}
