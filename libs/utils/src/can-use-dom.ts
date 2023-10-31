/// <reference lib="dom" />
/**
 * Check if the DOM is available
 * @returns {boolean} - Returns true if the DOM is available, false otherwise.
 */
export const canUseDOM = () => {
  return !!(typeof window !== 'undefined' && window.document && window.document.createElement)
}
