import { DimensionValue, Formatter, ScalarDimensionValue } from '../types.ts'
import { hasAlias } from '../resolve.ts'
import { kebabCase } from '../../deps.ts'
import { getRem } from '../get-rem.ts'

export const dimension: Formatter<DimensionValue> = (
  { tokenPath, $value, baseFontSize },
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
      }; }`,
    )
  }
  return toRet.join('\n')
}
