import { DimensionValue, Formatter, GapValue } from '@plaited/token-types'
import { hasAlias } from '../resolve.js'
import { kebabCase } from '../cases.js'
import { dimension } from './dimension.js'

export const gap: Formatter<GapValue> = (
  { tokenPath, $value, baseFontSize, allTokens }
) => {
  if (hasAlias($value)) return ''
  if (typeof $value === 'string') {
    return `:root { --${kebabCase(tokenPath.join(' '))}:${$value}; }`
  }
  return dimension({
    tokenPath,
    $value: $value as DimensionValue,
    baseFontSize,
    allTokens,
  })
}
