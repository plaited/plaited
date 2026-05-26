/// <reference lib="dom" />
/**
 * Detects DOM API availability for isomorphic code.
 * Essential for SSR and universal JavaScript applications.
 *
 * @returns `true` if DOM APIs are available, otherwise `false`.
 *
 * @remarks
 * Checks for window, document, and createElement.
 * Used to guard DOM operations in universal code.
 *
 * @see {@link document.createElement} for the DOM capability being checked
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
