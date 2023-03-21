import { AliasValue, Formatter } from '../types.ts'
import { hasAlias, resolveTSVar } from '../resolve.ts'
import { camelCase, kebabCase } from '../../deps.ts'

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
