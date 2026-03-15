/**
 * Modnet utility functions.
 *
 * @public
 */

// ============================================================================
// Constitution Hashing
// ============================================================================

/**
 * Compute a non-cryptographic hash of a constitution source for comparison.
 *
 * @remarks
 * Uses `Bun.hash()` (Wyhash) for fast, non-cryptographic hashing suitable
 * for comparing constitutions between nodes. For cryptographic attestation
 * (e.g., signing Agent Cards), use `crypto.subtle` instead.
 *
 * @param source - The constitution source text
 * @returns Hash string in `wyhash:<hex>` format
 *
 * @public
 */
export const hashConstitution = (source: string): string => {
  const hash = Bun.hash(source)
  return `wyhash:${hash.toString(16)}`
}
