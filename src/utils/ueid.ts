/**
 * Generates a Unique Enough Identifier (UEID) for non-cryptographic purposes.
 * Combines timestamp and random components for practical uniqueness in everyday applications.
 *
 * @param prefix - Optional string to prepend to the generated ID (default: '')
 * @returns A string combining prefix, base36 timestamp, and random value
 *
 * Features:
 * - ~11 characters (plus optional prefix)
 * - Time-based sequential component
 * - Random suffix for uniqueness
 * - Base36 encoding for compactness
 * - Consistent lowercase format
 * - Optional prefix support
 *
 * @example
 * Basic Usage
 * ```ts
 * const id = ueid();           // "lpf98qw2"
 * const userId = ueid('user_'); // "user_lpf98qw2"
 * const tempId = ueid('temp-'); // "temp-lpf98qw2"
 * ```
 *
 * @example
 * DOM Element IDs
 * ```ts
 * const element = document.createElement('div');
 * element.id = ueid('input-');  // "input-lpf98qw2"
 * ```
 *
 * @example
 * Temporary Cache Keys
 * ```ts
 * const cache = new Map();
 * const cacheKey = ueid('cache-');
 * cache.set(cacheKey, data);
 * ```
 *
 * @example
 * React Key Props
 * ```ts
 * const items = data.map(item => (
 *   <li key={ueid('item-')}>{item.name}</li>
 * ));
 * ```
 *
 * @remarks
 * Important Considerations:
 * 1. Security: Not cryptographically secure
 *    - Use crypto.randomUUID() for security-critical identifiers
 *    - Suitable for non-sensitive temporary IDs
 *
 * 2. Uniqueness:
 *    - Combines timestamp and random values
 *    - Collisions possible but rare in normal usage
 *    - Timestamp provides basic sequential ordering
 *
 * 3. Best Used For:
 *    - Temporary DOM element IDs
 *    - Cache keys
 *    - Debug/logging identifiers
 *    - Test data generation
 *
 * 4. Performance:
 *    - Lightweight computation
 *    - No external dependencies
 *    - No async operations
 */
export const ueid = (prefix = '') => {
  const id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).toLowerCase()
  return String(prefix) + id
}
