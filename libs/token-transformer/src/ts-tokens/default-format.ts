import { AliasValue, Formatter } from '@plaited/token-types'
import { camelCase, kebabCase } from 'lodash-es'
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
