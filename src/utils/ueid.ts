/**
 * Generates "unique enough" IDs for protocol messages.
 * Combines timestamp and random suffix with base36 encoding.
 *
 * @remarks
 * Not cryptographically secure — use `crypto.randomUUID()` for security.
 * Best for: protocol message IDs, cache keys, event correlation.
 * Not for: security tokens, database primary keys.
 *
 * @param prefix - Optional prefix string
 * @returns ~11 character ID with optional prefix
 *
 * @public
 */
export const ueid = (prefix = '') => {
  const id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).toLowerCase()
  return String(prefix) + id
}
