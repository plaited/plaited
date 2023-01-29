import { Formatter, AliasValue } from '../../../types.js'
import { resolveTSVar, hasAlias } from '../resolve.js'
import { kebabCase, camelCase } from 'lodash-es'

export const defaultFormat:Formatter = ({
  tokenPath,
  $value,
  allTokens,
}) => {
  const val = hasAlias($value)
    ? resolveTSVar($value as  AliasValue, allTokens)
    : `'var(--${kebabCase(tokenPath.join(' '))})'`
  return  `export const ${camelCase(tokenPath.join(' '))} = ${val}`
}
