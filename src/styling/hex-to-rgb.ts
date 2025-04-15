import { getHexOpacityMap } from './get-hex-opacity-map.js'

/**
 * Converts hexadecimal color codes to RGB/RGBA color strings.
 *
 * Supports:
 * - 6-digit hex (#RRGGBB → rgb(r,g,b))
 * - 8-digit hex (#RRGGBBAA → rgba(r,g,b,a))
 *
 * @param hex Hexadecimal color string (must start with #)
 * @returns
 * - rgb(r,g,b) for 6-digit hex
 * - rgba(r,g,b,a) for 8-digit hex with alpha
 * - undefined for invalid formats
 *
 * @example
 * hexToRgb('#FF0000')     // returns "rgb(255,0,0)"
 * hexToRgb('#FF000080')   // returns "rgba(255,0,0,0.5)"
 * hexToRgb('invalid')     // returns undefined
 *
 * @remarks
 * - Requires # prefix
 * - RGB values are converted to decimal (0-255)
 * - Alpha values are converted to decimal (0-1)
 * - Returns undefined for invalid hex codes
 */
export const hexToRgb = (hex: string) => {
  if (!hex.startsWith('#')) return
  const sixDigits = `${parseInt(`${hex[1]}${hex[2]}`, 16)},${parseInt(`${hex[3]}${hex[4]}`, 16)},${parseInt(
    `${hex[5]}${hex[6]}`,
    16,
  )}`
  if (hex.length === 7) {
    return `rgb(${sixDigits})`
  }
  if (hex.length === 9) {
    const value = [...getHexOpacityMap()].find(([, last2]) => last2 === hex.slice(7, 9))
    return value ? `rgba(${sixDigits},${value[0]})` : undefined
  }
}
