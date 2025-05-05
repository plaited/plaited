import type { ElementAttributeList } from './jsx/jsx.types.js'
import { createTemplate, Fragment } from './jsx/create-template.js'

/**
 *  * Plaited JSX Development Runtime
 *
 * Specialized JSX runtime for development environments with enhanced debugging and validation.
 * Shares core functionality with the production runtime but adds development-specific features.
 *
 * @packageDocumentation
 * @example
 * Basic JSX Usage
 * ```tsx
 * /** @jsxImportSource plaited *\/
 *
 * const element = (
 *   <div className="container">
 *     <h1>Hello World</h1>
 *     <p>Welcome to Plaited</p>
 *   </div>
 * )
 * ```
 *
 * @example
 * Fragment Usage
 * ```tsx
 * /** @jsxImportSource plaited *\/
 *
 * const list = (
 *   <>
 *     <li>Item 1</li>
 *     <li>Item 2</li>
 *   </>
 * )
 * ```
 *
 * @example
 * Manual Factory Usage
 * ```tsx
 * import { jsx, Fragment } from 'plaited/jsx-runtime'
 *
 * const element = jsx('div', {
 *   className: 'container',
 *   children: [
 *     jsx('h1', { children: 'Hello' }),
 *     jsx('p', { children: 'World' })
 *   ]
 * })
 *
 * const list = jsx(Fragment, {
 *   children: [
 *     jsx('li', { children: 'Item 1' }),
 *     jsx('li', { children: 'Item 2' })
 *   ]
 * })
 * ```
 *
 * @remarks
 * Configuration:
 * 1. TypeScript Setup
 *    ```json
 *    {
 *      "compilerOptions": {
 *        "jsx": "react-jsx",
 *        "jsxImportSource": "plaited"
 *      }
 *    }
 *    ```
 *
 * 2. Babel Setup
 *    ```json
 *    {
 *      "plugins": [
 *        ["@babel/plugin-transform-react-jsx", {
 *          "runtime": "automatic",
 *          "importSource": "plaited"
 *        }]
 *      ]
 *    }
 *    ```
 *
 * Key Features:
 * - Full JSX syntax support
 * - TypeScript type checking
 * - Fragment support
 * - Development mode hints
 * - Static optimization
 *
 * Factory Functions:
 * - jsx: Standard transformation
 * - jsxs: Static optimization
 * - jsxDEV: Development hints
 * - h: Hyperscript compatibility
 *
 * Types:
 * - IntrinsicElements: HTML/SVG element types
 * - ElementAttributeList: Attribute types
 * - JSX namespace: Global JSX types
 */
export { createTemplate as h, createTemplate as jsx, createTemplate as jsxDEV, createTemplate as jsxs, Fragment }
/**
 * TypeScript JSX namespace declaration.
 * Defines intrinsic elements interface for type checking JSX elements.
 * Extends ElementAttributeList to provide HTML element attribute typing.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace JSX {
  interface IntrinsicElements extends ElementAttributeList {}
}
