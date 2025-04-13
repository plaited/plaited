/**
 * Generates a unique enough identifier (UEID) for non-cryptographic purposes.
 * Combines timestamp and random values for practical uniqueness.
 *
 * Features:
 * - Optional prefix support
 * - Compact base36 encoding
 * - Time-based for sequential uniqueness
 * - Additional random component
 * - Lowercase for consistency
 *
 * @param prefix Optional string to prepend to the ID (default: '')
 * @returns String in format: prefix + base36(timestamp) + base36(random)
 *
 * @example
 * ueid()           // "lpf98qw2"
 * ueid('user_')    // "user_lpf98qw2"
 * ueid('temp-')    // "temp-lpf98qw2"
 *
 * @remarks
 * - Not cryptographically secure - use crypto.randomUUID() for that
 * - Collision possible but unlikely in normal usage
 * - Timestamp ensures basic sequential ordering
 * - Useful for temporary IDs, DOM elements, or non-critical uniqueness
 * - approximately 11 characters long (plus prefix)
 */
export const ueid = (prefix = '') => {
  const id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).toLowerCase()
  return String(prefix) + id
}
