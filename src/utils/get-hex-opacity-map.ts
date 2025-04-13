/**
 * Creates a mapping between decimal opacity values and their hexadecimal equivalents.
 *
 * Features:
 * - Maps opacity values from 0 to 1 (in 0.01 increments)
 * - Converts to 2-digit uppercase hexadecimal values (00-FF)
 * - Handles rounding to prevent floating-point precision errors
 *
 * @returns Map<number, string> where:
 *  - Key: decimal opacity value (0.00 to 1.00)
 *  - Value: two-digit uppercase hex string (00 to FF)
 *
 * @example
 * const opacityMap = getHexOpacityMap();
 * opacityMap.get(1)    // Returns "FF" (fully opaque)
 * opacityMap.get(0.5)  // Returns "80" (50% opacity)
 * opacityMap.get(0)    // Returns "00" (fully transparent)
 *
 * @remarks
 * Useful for generating hex color codes with alpha channels (RGBA to RRGGBBAA)
 * Example: #FF0000 + 80 = #FF000080 (red at 50% opacity)
 */
export const getHexOpacityMap = () => {
  const map = new Map<number, string>()
  for (let i = 1; i >= 0; i -= 0.01) {
    i = Math.round(i * 100) / 100
    const alpha = Math.round(i * 255)
    const hex = (alpha + 0x10000).toString(16).substr(-2).toUpperCase()
    map.set(i, hex)
  }
  return map
}
