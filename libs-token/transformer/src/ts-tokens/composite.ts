import { AliasValue, FlexToken, GridToken, TypographyToken } from '../../../types/dist/index.js'
import { Formatter } from '../types.js'
import { camelCase } from '@plaited/utils'
import { hasAlias, resolveTSVar } from '../resolve.js'

type CompositeToken = FlexToken | GridToken | TypographyToken

export const composite: Formatter<CompositeToken> = (token, { tokenPath, allTokens }) => {
  const { $value } = token
  if (hasAlias($value)) {
    return `export const ${camelCase(tokenPath.join(' '))} = ${resolveTSVar($value as AliasValue, allTokens)}`
  }
  const toRet = Object.entries($value).map(([key, val]) => `  ${key}: ${resolveTSVar(val, allTokens)},`)
  return [`export const ${camelCase(tokenPath.join(' '))} = {`, ...toRet, '}'].join('\n')
}
