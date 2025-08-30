/// <reference lib="dom" />
/**
 * Detects DOM API availability for isomorphic code.
 * Essential for SSR and universal JavaScript applications.
 *
 * @returns true if DOM APIs are available, false otherwise
 *
 * @example Browser vs Server
 * ```ts
 * if (canUseDOM()) {
 *   // Browser-only code
 *   document.getElementById('app');
 * } else {
 *   // Server/Node.js code
 *   console.log('No DOM available');
 * }
 * ```
 *
 * @example Conditional imports
 * ```ts
 * const handler = canUseDOM()
 *   ? () => window.addEventListener('resize', callback)
 *   : () => {}; // noop on server
 * ```
 *
 * @remarks
 * Checks for window, document, and createElement.
 * Used to guard DOM operations in universal code.
 *
 * @see {@link createDocumentFragment} for DOM manipulation
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
