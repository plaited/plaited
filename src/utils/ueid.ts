/**
 * Generates "unique enough" IDs for UI elements.
 * Combines timestamp and random suffix with base36 encoding.
 *
 * ⚠️ **Not cryptographically secure** - use crypto.randomUUID() for security.
 *
 * @param prefix - Optional prefix string
 * @returns ~11 character ID with optional prefix
 *
 * @remarks
 * Best for: DOM IDs, cache keys, test data.
 * Not for: Security tokens, database IDs.
 * Collision risk: Low in normal usage.
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
