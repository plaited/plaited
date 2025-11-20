/**
 * @internal
 * @module jsx-dev-runtime
 *
 * Purpose: JSX development runtime entry point for TypeScript/Babel JSX transformation.
 * Architecture: Re-exports createTemplate with standard JSX runtime names, similar to production runtime.
 * Dependencies: createTemplate factory, Fragment component, JSX type definitions.
 * Consumers: TypeScript compiler, Babel transforms, bundlers with JSX support (in development mode).
 */

import { createTemplate, Fragment } from './main/create-template.js'
import type { ElementAttributeList, TemplateObject } from './main/create-template.types.js'

/**
 * @internal
 * JSX factory exports supporting multiple transform modes:
 * - h: Hyperscript-style factory (classic transform)
 * - jsx: Automatic runtime for single children
 * - jsxs: Automatic runtime for multiple children
 * - jsxDEV: Development mode (currently maps to the same production createTemplate)
 * All map to the same createTemplate for consistency.
 */
export { createTemplate as h, createTemplate as jsx, createTemplate as jsxDEV, createTemplate as jsxs, Fragment }

/**
 * @internal
 * TypeScript JSX namespace declaration.
 * Maps intrinsic elements to Plaited's attribute types.
 * Enables type checking and IntelliSense for JSX elements in development.
 * IntrinsicElements extends ElementAttributeList which includes
 * all HTML/SVG elements with proper attribute typing.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace JSX {
  interface IntrinsicElements extends ElementAttributeList {}
  type Element = TemplateObject
}
