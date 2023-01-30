import { Formatter, AliasValue } from '../../token-types.ts'
import { resolveTSVar, hasAlias } from '../resolve.ts'
import { kebabCase, camelCase } from '../../deps.ts'

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
