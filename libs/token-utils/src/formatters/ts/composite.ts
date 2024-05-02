import { camelCase } from '@plaited/utils'
import { Formatter, AliasValue, FlexToken, GridToken, TypographyToken } from '../../types.js'
import { hasAlias } from '../has-alias.js'
import { resolveTSVar } from '../ts-utils.js'

type CompositeToken = FlexToken | GridToken | TypographyToken

export const composite: Formatter<CompositeToken> = (token, { tokenPath, allTokens }) => {
  const { $value } = token
  if (hasAlias($value)) {
    return `export const ${camelCase(tokenPath.join(' '))} = ${resolveTSVar($value as AliasValue, allTokens)}`
  }
  const toRet = Object.entries($value).map(([key, val]) => `  ${key}: ${resolveTSVar(val, allTokens)},`)
  return [`export const ${camelCase(tokenPath.join(' '))} = {`, ...toRet, '}'].join('\n')
}
