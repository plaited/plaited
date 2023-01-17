import { Formatter, DimensionValue, ScalarDimensionValue } from '../../types.js'
import { hasAlias } from '../resolve'
import { kebabCase } from 'lodash-es'

export const dimension:Formatter<DimensionValue> = ({ tokenPath, $value, baseFontSize, _allTokens }) => {
  const aliased = typeof $value === 'string' && hasAlias($value)
  if (aliased) return ''
  if(typeof $value === 'number') return  `${$value/baseFontSize}rem`
  // let toRet = ''
  // for(const dim in $value as ScalarDimensionValue) {

  // }
  return ''
}
