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
  const id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).toLowerCase()
  return String(prefix) + id
}
