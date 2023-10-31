import { DimensionLikeTokens, DimensionLikeValues } from '@plaited/token-types'
import { Formatter } from '../types.js'
import { hasAlias, resolveCSSVar } from '../resolve.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule, getRem } from '../utils.js'

export const dimension: Formatter<DimensionLikeTokens> = (
  token,
  { allTokens, tokenPath, baseFontSize, ...contexts },
) => {
  const prop = kebabCase(tokenPath.join(' '))
  if (isStaticToken<DimensionLikeTokens, DimensionLikeValues>(token)) {
    const { $value } = token
    if (hasAlias($value)) return ''
    return getRule({ prop, value: getRem($value, baseFontSize) })
  }
  const toRet: string[] = []
  if (isContextualToken<DimensionLikeTokens, DimensionLikeValues>(token)) {
    const {
      $value,
      $extensions: { 'plaited-context': $context },
    } = token
    for (const id in $value) {
      const contextValue = $value[id]
      if (hasAlias(contextValue)) {
        toRet.push(getRule({ prop, value: resolveCSSVar(contextValue, allTokens) }))
        continue
      }
      const context = { type: $context, id }
      if (isValidContext({ context, ...contexts })) {
        toRet.push(getRule({ prop, value: getRem(contextValue, baseFontSize), context, ...contexts }))
      }
    }
  }
  return toRet.join('\n')
}
