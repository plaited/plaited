import type { ElementAttributeList } from './jsx.types.js'
import { createTemplate, Fragment } from './create-template.js'

/**
 * Production JSX Runtime exports.
 * Provides standardized entry points for JSX compilation and rendering.
 * @exports
 * - h: Hyperscript-compatible template creation (for tools like Babel)
 * - jsx: Standard JSX transformation entry point
 * - jsxDEV: Development mode JSX transformation (included for compatibility)
 * - jsxs: Static JSX transformation for optimized builds
 * - Fragment: Fragment component for wrapping multiple elements
 */
export { createTemplate as h, createTemplate as jsx, createTemplate as jsxDEV, createTemplate as jsxs, Fragment }

/**
 * TypeScript JSX namespace for production runtime.
 * Provides type definitions for JSX element validation.
 * @namespace JSX
 * @property {interface} IntrinsicElements - HTML element type definitions
 * extending ElementAttributeList for comprehensive attribute typing
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace JSX {
  interface IntrinsicElements extends ElementAttributeList {}
}
