import { DimensionValue, Formatter, ScalarDimensionValue } from '@plaited/token-types'
import { hasAlias } from '../resolve.js'
import { kebabCase } from '@plaited/utils'
import { getRem } from '../get-rem.js'

export const dimension: Formatter<DimensionValue> = (
  { tokenPath, $value, baseFontSize }
) => {
  if (hasAlias($value)) return ''
  if (typeof $value === 'number') {
    return (
      `:root { --${kebabCase(tokenPath.join(' '))}:${
        getRem($value, baseFontSize)
      }; }`
    )
  }
  const toRet = []
  for (const media in $value as ScalarDimensionValue) {
    const val = ($value as ScalarDimensionValue)[media]
    if (hasAlias(val)) continue
    toRet.push(
      `[data-media="${media}"]:root { --${kebabCase(tokenPath.join(' '))}:${
        getRem(val, baseFontSize)
      }; }`
    )
  }
  return toRet.join('\n')
}
