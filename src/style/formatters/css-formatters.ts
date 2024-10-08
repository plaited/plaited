import type { GetFormatters } from './formatters.types.js'
import { color } from './css/color.js'
import { gradient } from './css/gradient.js'
import { defaultFormatter } from './css/default-formatter.js'

/**
 * This formatter object will return formatters that will create content for an
 * optimized css stylesheet of css custom properties to be applied to
 */
export const cssFormatters: GetFormatters = (token, details) => {
  const { $type } = token
  if ($type === 'color') return color(token, details)
  if ($type === 'gradient') return gradient(token, details)
  if ($type === 'angle' || $type === 'amount' || $type === undefined || $type === 'size')
    return defaultFormatter(token, details)
  return ''
}
