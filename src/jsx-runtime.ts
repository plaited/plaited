/**
 * @internal
 * @module jsx-runtime
 *
 * Purpose: JSX runtime entry point for TypeScript/Babel JSX transformation
 * Architecture: Re-exports createTemplate with standard JSX runtime names
 * Dependencies: createTemplate factory, Fragment component, JSX type definitions
 * Consumers: TypeScript compiler, Babel transforms, bundlers with JSX support

 */

import type { ElementAttributeList } from './main/jsx.types.js'
import { createTemplate, Fragment } from './main/create-template.js'

/**
 * @internal
 * JSX factory exports supporting multiple transform modes:
 * - h: Hyperscript-style factory (classic transform)
 * - jsx: Automatic runtime for single children
 * - jsxs: Automatic runtime for multiple children
 * - jsxDEV: Development mode (same as production currently)
 * All map to same createTemplate for consistency.
 */
export { createTemplate as h, createTemplate as jsx, createTemplate as jsxDEV, createTemplate as jsxs, Fragment }

/**
 * @internal
 * TypeScript JSX namespace declaration.
 * Maps intrinsic elements to Plaited's attribute types.
 * Enables type checking and IntelliSense for JSX elements.
 * IntrinsicElements extends ElementAttributeList which includes
 * all HTML/SVG elements with proper attribute typing.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace JSX {
  interface IntrinsicElements extends ElementAttributeList {}
}
