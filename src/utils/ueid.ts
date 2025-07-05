/**
 * @internal
 * @module ueid
 *
 * Purpose: Fast, non-cryptographic unique identifier generation for UI elements
 * Architecture: Timestamp + random suffix pattern with base36 encoding
 * Dependencies: None - uses native Date and Math APIs only
 * Consumers: Component systems, DOM manipulation, caching layers, test utilities
 *
 * Maintainer Notes:
 * - "Unique Enough" means suitable for UI, not security or persistence
 * - Base36 chosen for compact alphanumeric output (0-9, a-z)
 * - Timestamp component provides rough chronological ordering
 * - Random suffix reduces collision probability within same millisecond
 * - String prefix support enables namespacing and type identification
 * - Total length ~11 chars keeps IDs short for DOM/CSS usage
 *
 * Common modification scenarios:
 * - Increasing uniqueness: Add more random characters or use crypto API
 * - Sequential IDs: Replace random with incrementing counter
 * - Custom alphabets: Replace base36 with custom encoding
 * - Collision tracking: Add Set to track and regenerate on collision
 *
 * Performance considerations:
 * - Date.now() and Math.random() are fast native operations
 * - String concatenation creates temporary strings
 * - No state maintained between calls (stateless)
 * - Consider memoization if generating many IDs in tight loop
 *
 * Known limitations:
 * - Not cryptographically secure (predictable patterns)
 * - Collision possible within same millisecond (1 in ~46k chance)
 * - No guaranteed uniqueness across processes/machines
 * - Sequential component reveals creation time
 */

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
  /**
   * @internal
   * ID generation algorithm:
   * 1. Date.now() - milliseconds since epoch (13 digits decimal)
   * 2. toString(36) - converts to base36 (0-9, a-z), ~8 chars
   * 3. Math.random() - generates 0-1 float (e.g., 0.123456789)
   * 4. toString(36) - converts to base36 (e.g., "0.4fzyo82")
   * 5. slice(2, 5) - takes 3 chars after "0." for suffix
   * 6. toLowerCase() - ensures consistent casing (redundant for base36)
   * 7. String(prefix) - ensures prefix is string type
   */
  const id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).toLowerCase()
  return String(prefix) + id
}
