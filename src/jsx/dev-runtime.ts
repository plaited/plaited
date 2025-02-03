import type { ElementAttributeList } from './jsx.types.js'
import { createTemplate, Fragment } from './create-template.js'

/**
 * JSX Runtime exports for development environments.
 * Provides aliases for the template creation function to support various build tools and JSX configurations.
 * @exports
 * - h: Hyperscript-style template creation
 * - jsx: Standard JSX runtime
 * - jsxDEV: Development-specific JSX runtime
 * - jsxs: Static JSX runtime
 * - Fragment: Support for fragment syntax
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
