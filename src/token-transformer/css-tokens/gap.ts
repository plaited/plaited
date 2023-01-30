import { Formatter, GapValue, DimensionValue } from '../../token-types.ts'
import { hasAlias } from '../resolve.ts'
import { kebabCase } from '../../deps.ts'
import { dimension } from './dimension.ts'

export const gap:Formatter<GapValue> = ({ tokenPath, $value, baseFontSize, allTokens }) => {
  if (hasAlias($value)) return ''
  if(typeof $value === 'string') {
    return `:root { --${kebabCase(tokenPath.join(' '))}:${$value}; }`
  }
  return dimension({ tokenPath, $value: $value as DimensionValue , baseFontSize, allTokens })
}
