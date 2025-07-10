/**
 * @internal
 * @module can-use-dom
 *
 * Purpose: Runtime detection of DOM availability for isomorphic code execution
 * Architecture: Simple feature detection pattern using window object presence
 * Dependencies: None - pure JavaScript implementation
 * Consumers: SSR components, utility functions, conditional DOM operations
 *
 * Maintainer Notes:
 * - This is a critical utility for SSR/isomorphic applications
 * - Checks three levels: window, document, and createElement for robustness
 * - The !! converts truthy/falsy to explicit boolean
 * - Reference directive ensures DOM types are available in TypeScript
 * - Used to guard DOM-dependent code paths in universal components
 *
 * Common modification scenarios:
 * - Adding more DOM feature checks: Extend the condition chain
 * - Supporting DOM polyfills: Add specific polyfill detection
 * - Worker environment detection: Check for WorkerGlobalScope
 *
 * Performance considerations:
 * - Function call is extremely lightweight
 * - Result could be cached but environment rarely changes
 * - Inlined by most bundlers due to simplicity
 *
 * Known limitations:
 * - Cannot detect partial DOM implementations
 * - Some test environments may provide fake DOM
 * - Does not check for specific DOM features beyond basics
 */
/// <reference lib="dom" />
/**
 * Checks if the current JavaScript environment has access to the standard DOM APIs.
 * This is useful for creating isomorphic (universal) applications that can run on both the server and the client.
 *
 * @returns Returns `true` if the code is running in a browser-like environment
 * where `window`, `window.document`, and `window.document.createElement` are available.
 * Returns `false` otherwise (e.g., in a Node.js environment without a DOM simulation library).
 *
 * @example
 * ```typescript
 * import { canUseDOM } from 'plaited/utils';
 *
 * if (canUseDOM()) {
 *   // This code runs only in the browser
 *   const element = document.getElementById('my-element');
 *   element?.addEventListener('click', () => console.log('Clicked!'));
 * } else {
 *   // This code runs only on the server (or non-DOM environment)
 *   console.log('DOM APIs are not available.');
 * }
 * ```
 */
export const canUseDOM = () => {
  /**
   * @internal
   * Feature detection chain checks for DOM API availability.
   * Order matters: check window existence before accessing properties.
   * - typeof check prevents ReferenceError in non-browser environments
   * - window.document ensures document object exists
   * - document.createElement verifies core DOM functionality
   * Double negation (!!) ensures boolean return type.
   */
  return !!(typeof window !== 'undefined' && window.document && window.document.createElement)
}
