/// <reference lib="dom" />
/**
 * @description Checks if the current JavaScript environment has access to the standard DOM APIs.
 * This is useful for creating isomorphic (universal) applications that can run on both the server and the client.
 *
 * @returns {boolean} Returns `true` if the code is running in a browser-like environment
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
  return !!(typeof window !== 'undefined' && window.document && window.document.createElement)
}
