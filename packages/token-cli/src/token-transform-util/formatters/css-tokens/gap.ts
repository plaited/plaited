import { Formatter, GapValue, DimensionValue } from '../../types.js'
import { hasAlias } from '../resolve.js'
import { kebabCase } from 'lodash-es'
import { dimension } from './dimension.js'

export const gap:Formatter<GapValue> = ({ tokenPath, $value, baseFontSize, _allTokens }) => {
  if (hasAlias($value)) return ''
  if(typeof $value === 'string') {
    return `:root { --${kebabCase(tokenPath.join(' '))}:${$value}; }`
  }
  return dimension({ tokenPath, $value: $value as DimensionValue , baseFontSize, _allTokens })
}
