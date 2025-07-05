/**
 * @internal
 * @module jsx-runtime
 *
 * Purpose: JSX runtime entry point for TypeScript/Babel JSX transformation
 * Architecture: Re-exports createTemplate with standard JSX runtime names
 * Dependencies: createTemplate factory, Fragment component, JSX type definitions
 * Consumers: TypeScript compiler, Babel transforms, bundlers with JSX support
 *
 * Maintainer Notes:
 * - This file enables automatic JSX transformation in modern toolchains
 * - Multiple exports (h, jsx, jsxDEV, jsxs) support different JSX modes
 * - h: Classic transform (React.createElement style)
 * - jsx/jsxs: Automatic runtime transform (React 17+ style)
 * - jsxDEV: Development mode with additional debug info
 * - Fragment enables <></> syntax for grouping without wrapper elements
 * - JSX namespace declaration provides TypeScript IntelliSense
 *
 * Common modification scenarios:
 * - Custom JSX factories: Add specialized transforms for optimization
 * - Debug information: Enhance jsxDEV with source location tracking
 * - Performance monitoring: Wrap createTemplate with instrumentation
 * - Custom pragma support: Export additional factory variations
 *
 * Performance considerations:
 * - All exports are aliases - no runtime overhead
 * - Tree-shaking removes unused exports
 * - TypeScript compiles JSX at build time
 * - No runtime JSX parsing required
 *
 * Known limitations:
 * - No React compatibility mode
 * - No support for React-specific features (keys, refs)
 * - JSX namespace is global in TypeScript
 * - Development/production builds use same implementation
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
