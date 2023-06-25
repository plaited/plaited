import { AliasValue } from '@plaited/token-types'
import { Formatter } from '../types.js'
import { camelCase, kebabCase } from '@plaited/utils'
import { hasAlias, resolveTSVar } from '../resolve.js'

export const defaultFormat: Formatter = ({
  tokenPath,
  $value,
  allTokens,
}) => {
  const val = hasAlias($value)
    ? resolveTSVar($value as AliasValue, allTokens)
    : `'var(--${kebabCase(tokenPath.join(' '))})'`
  return `export const ${camelCase(tokenPath.join(' '))} = ${val}`
}
