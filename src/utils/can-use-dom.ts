/// <reference lib="dom" />
/**
 * Checks if the current environment has access to the DOM API.
 * Useful for conditional execution of DOM-dependent code in isomorphic applications.
 *
 * Verifies:
 * - Window object exists
 * - Document object exists
 * - createElement method is available
 *
 * @returns {boolean} true if running in a browser environment with DOM access,
 *                    false if in a non-DOM environment (e.g., server-side rendering)
 *
 * @example
 * if (canUseDOM()) {
 *   // Safe to use DOM APIs
 *   document.getElementById('app')
 * } else {
 *   // Handle non-DOM environment
 *   console.log('DOM not available')
 * }
 */
export const canUseDOM = () => {
  return !!(typeof window !== 'undefined' && window.document && window.document.createElement)
}
